import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {defineConfig} from 'vite';
import type {Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {describePythonSpawnFailure, summarizeVoiceoverAlignFailure, toVoiceoverErrorPayload} from './voiceover-align-diagnostics';
import {describeRenderSpawnFailure, summarizeRenderFailure} from './render-diagnostics';

const editorRoot = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
process.stdout.setDefaultEncoding?.('utf8');
process.stderr.setDefaultEncoding?.('utf8');
process.env.PYTHONUTF8 ??= '1';
process.env.PYTHONIOENCODING ??= 'utf-8';
process.env.NO_COLOR ??= '1';
process.env.FORCE_COLOR ??= '0';

const stripAnsi = (value: string) => value.replace(/\x1b\[[0-9;]*m/g, '');
const normalizeConsoleText = (value: string) => stripAnsi(value).replace(/\r/g, '');
const compactConsoleText = (value: string) => normalizeConsoleText(value).trim();
const createUtf8Env = (overrides?: Record<string, string | undefined>) => ({
  ...process.env,
  PYTHONUTF8: '1',
  PYTHONIOENCODING: 'utf-8',
  NO_COLOR: '1',
  FORCE_COLOR: '0',
  ...overrides,
});

type DebugLogLevel = 'info' | 'warn' | 'error';

const formatDebugDetails = (details: unknown) => {
  if (typeof details === 'undefined') {
    return '';
  }

  const raw = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
  return normalizeConsoleText(raw)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .map((line) => `  ${line}`)
    .join('\n');
};

const getDebugLogLevel = (scope: string, message: string) => {
  const normalizedScope = scope.toLowerCase();
  const normalizedMessage = message.toLowerCase();

  if (/(失败|异常|错误)/.test(message) || /\berror\b|\bfailed\b|\bexception\b/.test(normalizedMessage)) {
    return 'error' satisfies DebugLogLevel;
  }

  if (normalizedScope.endsWith(':stderr') || /(取消|跳过|忽略|警告)/.test(message) || /\bwarn\b|\bcancel\b|\bskipp?ed\b|\bignore\b/.test(normalizedMessage)) {
    return 'warn' satisfies DebugLogLevel;
  }

  return 'info' satisfies DebugLogLevel;
};

const appendDebugLog = (scope: string, message: string, details?: unknown) => {
  const normalizedMessage = compactConsoleText(String(message || ''));
  const formattedDetails = formatDebugDetails(details);
  if (!normalizedMessage && !formattedDetails) {
    return;
  }

  const timestamp = new Date().toISOString();
  const level = getDebugLogLevel(scope, normalizedMessage);
  const writer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  const header = `${timestamp} [${level.toUpperCase()}] [${scope}] ${normalizedMessage || 'details'}`;

  writer(formattedDetails ? `${header}\n${formattedDetails}` : header);
};

const appendConsoleChunk = (scope: string, chunk: string) => {
  normalizeConsoleText(chunk)
    .split('\n')
    .map((line) => compactConsoleText(line))
    .filter(Boolean)
    .forEach((line) => appendDebugLog(scope, line));
};

const safeRemovePath = (targetPath: string, scope: string) => {
  try {
    fs.rmSync(targetPath, {recursive: true, force: true});
  } catch (error) {
    appendDebugLog(scope, '清理临时目录失败', {
      targetPath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const sanitizeFileName = (value?: string) => {
  const normalized = (value || 'account-project')
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const trimmed = (normalized || 'account-project').slice(0, 80).replace(/-+$/g, '');
  const lower = trimmed.toLowerCase();
  const reserved = new Set([
    'con',
    'prn',
    'aux',
    'nul',
    ...Array.from({length: 9}, (_, index) => `com${index + 1}`),
    ...Array.from({length: 9}, (_, index) => `lpt${index + 1}`),
  ]);
  const safe = reserved.has(lower) ? `_${trimmed}` : trimmed;
  return safe || 'account-project';
};

const ensureWritableDir = (targetDir: string, scope: string) => {
  try {
    fs.mkdirSync(targetDir, {recursive: true});
    const probePath = path.join(targetDir, `.write-test-${process.pid}-${Date.now()}.tmp`);
    fs.writeFileSync(probePath, 'ok', 'utf-8');
    fs.rmSync(probePath, {force: true});
    return true;
  } catch (error) {
    appendDebugLog(scope, '输出目录不可写', {
      targetDir,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

const chooseOutputDir = (scope: string) => {
  const candidates = [
    path.resolve(projectRoot, 'out'),
    path.resolve(projectRoot, 'output'),
    path.join(os.tmpdir(), 'oxecho-renders'),
  ];

  for (const candidate of candidates) {
    if (ensureWritableDir(candidate, scope)) {
      return candidate;
    }
  }

  return path.resolve(projectRoot, 'out');
};

type RenderJobStatus = 'queued' | 'rendering' | 'encoding' | 'done' | 'error' | 'canceled';

type RenderJob = {
  id: string;
  status: RenderJobStatus;
  progress: number;
  phaseText: string;
  message: string;
  outputPath?: string;
  outputName?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  currentFrame?: number;
  totalFrames?: number;
  targetLabel?: string;
  logTail?: string;
  resolutionSteps?: string[];
  runtimeHint?: string;
};

const RENDER_JOB_TTL_MS = 30 * 60 * 1000;
const MAX_RENDER_JOBS = 40;
const MAX_JSON_BODY_BYTES = 10 * 1024 * 1024;

class HttpError extends Error {
  statusCode: number;
  details?: string;

  constructor(statusCode: number, message: string, details?: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const getErrorDetails = (error: unknown) => (error instanceof Error ? error.message : String(error));

const toApiErrorResponse = (error: unknown, fallbackError: string) => {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      payload: {
        error: error.message,
        details: error.details ?? error.message,
      },
    };
  }

  return {
    statusCode: 500,
    payload: {
      error: fallbackError,
      details: getErrorDetails(error),
    },
  };
};

const readJsonBody = async <T,>(req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new HttpError(413, '请求体过大', `当前请求体大小约 ${(totalBytes / 1024 / 1024).toFixed(2)} MB，超过 ${(MAX_JSON_BODY_BYTES / 1024 / 1024).toFixed(0)} MB 限制。请缩小导入内容或拆分请求。`);
    }
    chunks.push(buffer);
  }

  const rawText = Buffer.concat(chunks).toString('utf-8').replace(/^﻿/, '').trim();
  if (!rawText) {
    throw new HttpError(400, '请求体为空', '请确认前端已按 JSON 发送请求体。');
  }

  try {
    return JSON.parse(rawText) as T;
  } catch (error) {
    throw new HttpError(400, '请求体不是合法 JSON', getErrorDetails(error));
  }
};

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload, null, 2));
};

const openOutputDirectory = (outputPath: string) => {
  const normalizedPath = path.resolve(outputPath);
  const targetDir = fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isDirectory() ? normalizedPath : path.dirname(normalizedPath);

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    throw new HttpError(404, '输出目录不存在', `目标目录不存在：${targetDir}`);
  }

  if (process.platform === 'win32') {
    const child = spawn('explorer.exe', [targetDir], {detached: true, stdio: 'ignore'});
    child.unref();
    return targetDir;
  }

  if (process.platform === 'darwin') {
    const child = spawn('open', [targetDir], {detached: true, stdio: 'ignore'});
    child.unref();
    return targetDir;
  }

  const child = spawn('xdg-open', [targetDir], {detached: true, stdio: 'ignore'});
  child.unref();
  return targetDir;
};

const sendRawJson = (res: ServerResponse, statusCode: number, payload: string) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(payload);
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const decodeRequiredBase64 = (value: string, fieldLabel: string) => {
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.byteLength) {
    throw new HttpError(400, '音频内容为空', `${fieldLabel} 解码后为空，请检查上传的音频文件。`);
  }

  return buffer;
};

const readValidatedJsonOutput = (outputPath: string, errorMessage: string) => {
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size <= 0) {
    throw new HttpError(500, errorMessage, `结果文件不存在或为空: ${outputPath}`);
  }

  const rawOutput = fs.readFileSync(outputPath, 'utf-8');
  if (!rawOutput.trim()) {
    throw new HttpError(500, errorMessage, `结果文件为空字符串: ${outputPath}`);
  }

  try {
    JSON.parse(rawOutput);
  } catch (error) {
    throw new HttpError(500, errorMessage, `结果文件不是合法 JSON: ${getErrorDetails(error)}`);
  }

  return rawOutput;
};

type VoiceoverProcessOptions = {
  scope: string;
  errorMessage: string;
  successLogMessage: string;
  softSuccessLogMessage: string;
  failureLogMessage: string;
  tempDir: string;
  outputPath: string;
  pythonArgs: string[];
  model: string;
  device: string;
  computeType: string;
  res: ServerResponse;
};

const runVoiceoverPythonProcess = (options: VoiceoverProcessOptions) => {
  const child = spawn('python', options.pythonArgs, {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: createUtf8Env(),
  });

  let settled = false;
  const finishJson = (statusCode: number, payload: unknown) => {
    if (settled || options.res.writableEnded) {
      return;
    }
    settled = true;
    sendJson(options.res, statusCode, payload);
    safeRemovePath(options.tempDir, options.scope);
  };

  const finishRawJson = (statusCode: number, payload: string) => {
    if (settled || options.res.writableEnded) {
      return;
    }
    settled = true;
    sendRawJson(options.res, statusCode, payload);
    safeRemovePath(options.tempDir, options.scope);
  };

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    appendConsoleChunk(`${options.scope}:stdout`, chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
    appendConsoleChunk(`${options.scope}:stderr`, chunk);
  });

  child.on('close', (code) => {
    let outputText: string | null = null;
    let outputValidationError: string | null = null;

    try {
      outputText = readValidatedJsonOutput(options.outputPath, options.errorMessage);
    } catch (error) {
      outputValidationError = error instanceof HttpError ? error.details ?? error.message : getErrorDetails(error);
    }

    if (code !== 0) {
      if (outputText !== null) {
        appendDebugLog(options.scope, options.softSuccessLogMessage, {code, outputPath: options.outputPath});
        finishRawJson(200, outputText);
        return;
      }

      const failure = summarizeVoiceoverAlignFailure({
        code,
        stdout,
        stderr,
        outputPath: options.outputPath,
        model: options.model,
        device: options.device,
        computeType: options.computeType,
        outputValidationError,
      });
      appendDebugLog(options.scope, options.failureLogMessage, {
        code,
        failure,
        stderr: stderr.slice(-2000),
        stdout: stdout.slice(-2000),
      });
      finishJson(failure.statusCode, toVoiceoverErrorPayload(options.errorMessage, failure));
      return;
    }


    if (outputText === null) {
      const failure = summarizeVoiceoverAlignFailure({
        code,
        stdout,
        stderr,
        outputPath: options.outputPath,
        model: options.model,
        device: options.device,
        computeType: options.computeType,
        outputValidationError,
      });
      appendDebugLog(options.scope, '对齐结果不可用', {code, failure, outputPath: options.outputPath});
      finishJson(failure.statusCode, toVoiceoverErrorPayload(options.errorMessage, failure));
      return;
    }

    appendDebugLog(options.scope, options.successLogMessage, {code, outputPath: options.outputPath});
    finishRawJson(200, outputText);
  });

  child.on('error', (error) => {
    const failure = describePythonSpawnFailure(error);
    appendDebugLog(options.scope, 'Python 进程启动失败', {error: error.message, failure});
    finishJson(failure.statusCode, toVoiceoverErrorPayload(options.errorMessage, failure));
  });
};

const voiceoverAlignPlugin = (): Plugin => {
  return {
    name: 'voiceover-align-api',
    configureServer(server) {
      server.middlewares.use('/api/align-voiceover', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        (async () => {
          try {
            const payload = await readJsonBody<{
              fileName?: string;
              audioBase64?: string;
              mimeType?: string;
              project?: unknown;
              language?: string;
              model?: string;
              device?: string;
              computeType?: string;
            }>(req);

            if (!isNonEmptyString(payload.fileName)) {
              throw new HttpError(400, '缺少 fileName', '请求体需要包含上传文件名。');
            }
            if (!isNonEmptyString(payload.audioBase64)) {
              throw new HttpError(400, '缺少 audioBase64', '请求体需要包含 base64 音频内容。');
            }
            if (!payload.project || typeof payload.project !== 'object' || Array.isArray(payload.project)) {
              throw new HttpError(400, '缺少 project', '请求体需要包含 project 对象。');
            }

            const model = isNonEmptyString(payload.model) ? payload.model : 'large-v3-turbo';
            const language = isNonEmptyString(payload.language) ? payload.language : 'zh';
            const device = isNonEmptyString(payload.device) ? payload.device : 'cuda';
            const computeType = isNonEmptyString(payload.computeType) ? payload.computeType : 'float16';

            appendDebugLog('align-single', '收到单条口播对齐请求', {
              fileName: payload.fileName,
              model,
              device,
              computeType,
            });

            const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const tempDir = path.resolve(projectRoot, '.tmp', 'voiceover-align', jobId);
            fs.mkdirSync(tempDir, {recursive: true});

            const extension = path.extname(payload.fileName) || '.bin';
            const audioPath = path.join(tempDir, `voiceover${extension}`);
            const projectPath = path.join(tempDir, 'project.json');
            const outputPath = path.join(tempDir, 'alignment.json');

            fs.writeFileSync(audioPath, decodeRequiredBase64(payload.audioBase64, 'audioBase64'));
            fs.writeFileSync(projectPath, JSON.stringify(payload.project, null, 2), 'utf-8');

            runVoiceoverPythonProcess({
              scope: 'align-single',
              errorMessage: '口播对齐失败',
              successLogMessage: '口播对齐完成',
              softSuccessLogMessage: 'Python 进程异常退出但结果文件可用, 按成功处理',
              failureLogMessage: 'Python 进程异常退出',
              tempDir,
              outputPath,
              model,
              device,
              computeType,
              res,
              pythonArgs: [
                '-u',
                path.resolve(projectRoot, 'scripts', 'align_voiceover.py'),
                '--audio',
                audioPath,
                '--project',
                projectPath,
                '--output',
                outputPath,
                '--language',
                language,
                '--model',
                model,
                '--device',
                device,
                '--compute-type',
                computeType,
              ],
            });
          } catch (error) {
            appendDebugLog('align-single', '接口异常', {error: error instanceof Error ? error.message : String(error)});
            const response = toApiErrorResponse(error, '口播对齐接口异常');
            sendJson(res, response.statusCode, response.payload);
          }
        })();
      });

      server.middlewares.use('/api/align-voiceover-batch', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        (async () => {
          try {
            const payload = await readJsonBody<{
              files?: Array<{fileName?: string; audioBase64?: string; mimeType?: string; segmentId?: string; label?: string; voiceoverText?: string}>;
              language?: string;
              model?: string;
              device?: string;
              computeType?: string;
              fps?: number;
            }>(req);

            if (!Array.isArray(payload.files) || payload.files.length === 0) {
              throw new HttpError(400, '缺少 files', '请求体需要包含至少一个待对齐音频文件。');
            }
            if (typeof payload.fps !== 'undefined' && (!Number.isFinite(payload.fps) || payload.fps <= 0)) {
              throw new HttpError(400, '非法 fps', 'fps 必须是大于 0 的数字。');
            }

            const model = isNonEmptyString(payload.model) ? payload.model : 'large-v3-turbo';
            const language = isNonEmptyString(payload.language) ? payload.language : 'zh';
            const device = isNonEmptyString(payload.device) ? payload.device : 'cuda';
            const computeType = isNonEmptyString(payload.computeType) ? payload.computeType : 'float16';
            const fps = typeof payload.fps === 'number' ? payload.fps : 30;

            appendDebugLog('align-batch', '收到批量口播对齐请求', {
              fileCount: payload.files.length,
              model,
              device,
              computeType,
              fileNames: payload.files.map((file) => file.fileName),
              segmentIds: payload.files.map((file) => file.segmentId),
            });

            const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const tempDir = path.resolve(projectRoot, '.tmp', 'voiceover-align-batch', jobId);
            fs.mkdirSync(tempDir, {recursive: true});

            const batchItems = payload.files.map((file, index) => {
              if (!isNonEmptyString(file.fileName)) {
                throw new HttpError(400, '缺少 files[].fileName', `第 ${index + 1} 个音频缺少文件名。`);
              }
              if (!isNonEmptyString(file.audioBase64)) {
                throw new HttpError(400, '缺少 files[].audioBase64', `第 ${index + 1} 个音频缺少 base64 内容。`);
              }
              if (!isNonEmptyString(file.segmentId)) {
                throw new HttpError(400, '缺少 files[].segmentId', `第 ${index + 1} 个音频缺少 segmentId。`);
              }

              const extension = path.extname(file.fileName) || '.bin';
              const audioPath = path.join(tempDir, `voiceover-${index + 1}${extension}`);
              fs.writeFileSync(audioPath, decodeRequiredBase64(file.audioBase64, `files[${index}].audioBase64`));
              return {
                id: file.segmentId,
                label: isNonEmptyString(file.label) ? file.label : file.segmentId,
                voiceoverText: typeof file.voiceoverText === 'string' ? file.voiceoverText : '',
                file_path: audioPath,
              };
            });

            const batchPath = path.join(tempDir, 'batch.json');
            const outputPath = path.join(tempDir, 'alignment-batch.json');
            fs.writeFileSync(
              batchPath,
              JSON.stringify(
                {
                  meta: {fps},
                  runtime: {
                    model,
                    language,
                    device,
                    compute_type: computeType,
                  },
                  items: batchItems,
                },
                null,
                2,
              ),
              'utf-8',
            );

            runVoiceoverPythonProcess({
              scope: 'align-batch',
              errorMessage: '批量口播对齐失败',
              successLogMessage: '批量口播对齐完成',
              softSuccessLogMessage: 'Python 进程异常退出但批量结果文件可用, 按成功处理',
              failureLogMessage: 'Python 进程异常退出',
              tempDir,
              outputPath,
              model,
              device,
              computeType,
              res,
              pythonArgs: [
                '-u',
                path.resolve(projectRoot, 'scripts', 'align_voiceover_batch.py'),
                '--batch',
                batchPath,
                '--output',
                outputPath,
                '--language',
                language,
                '--model',
                model,
                '--device',
                device,
                '--compute-type',
                computeType,
              ],
            });
          } catch (error) {
            appendDebugLog('align-batch', '接口异常', {error: error instanceof Error ? error.message : String(error)});
            const response = toApiErrorResponse(error, '批量口播对齐接口异常');
            sendJson(res, response.statusCode, response.payload);
          }
        })();
      });
    }
  };
};

const renderMp4Plugin = (): Plugin => {
  const renderJobs = new Map<string, RenderJob>();
  const runningRenderProcesses = new Map<string, {child: ReturnType<typeof spawn>; tempDir: string; outputPath: string}>();
  const isTerminalRenderJobStatus = (status: RenderJobStatus) => status === 'done' || status === 'error' || status === 'canceled';

  const pruneRenderJobs = () => {
    const now = Date.now();
    for (const [jobId, job] of renderJobs.entries()) {
      if ((job.status === 'done' || job.status === 'error' || job.status === 'canceled') && now - job.updatedAt > RENDER_JOB_TTL_MS) {
        renderJobs.delete(jobId);
      }
    }

    if (renderJobs.size <= MAX_RENDER_JOBS) {
      return;
    }

      const completedJobs = [...renderJobs.values()]
      .filter((job) => job.status === 'done' || job.status === 'error' || job.status === 'canceled')
      .sort((left, right) => left.updatedAt - right.updatedAt);

    for (const job of completedJobs) {
      if (renderJobs.size <= MAX_RENDER_JOBS) {
        break;
      }
      renderJobs.delete(job.id);
    }
  };

  const updateRenderJob = (jobId: string, patch: Partial<RenderJob>) => {
    const current = renderJobs.get(jobId);
    if (!current) {
      return;
    }

    if (patch.status && isTerminalRenderJobStatus(current.status) && !isTerminalRenderJobStatus(patch.status)) {
      return;
    }

    renderJobs.set(jobId, {
      ...current,
      ...patch,
      updatedAt: Date.now()
    });
    pruneRenderJobs();
  };

  const parseProgress = (jobId: string, text: string) => {
    const currentJob = renderJobs.get(jobId);
    if (!currentJob || isTerminalRenderJobStatus(currentJob.status)) {
      return;
    }

    const renderedMatches = [...text.matchAll(/Rendered\s+(\d+)\/(\d+)/g)];
    const encodedMatches = [...text.matchAll(/Encoded\s+(\d+)\/(\d+)/g)];

    if (renderedMatches.length) {
      const [, currentText, totalText] = renderedMatches[renderedMatches.length - 1];
      const currentFrame = Number(currentText);
      const totalFrames = Number(totalText);
      if (Number.isFinite(currentFrame) && Number.isFinite(totalFrames) && totalFrames > 0) {
        updateRenderJob(jobId, {
          status: 'rendering',
          progress: Math.min(0.92, currentFrame / totalFrames * 0.92),
          phaseText: '渲染帧',
          message: `正在渲染画面 ${currentFrame} / ${totalFrames}`,
          currentFrame,
          totalFrames
        });
      }
    }

    if (encodedMatches.length) {
      const [, currentText, totalText] = encodedMatches[encodedMatches.length - 1];
      const currentFrame = Number(currentText);
      const totalFrames = Number(totalText);
      if (Number.isFinite(currentFrame) && Number.isFinite(totalFrames) && totalFrames > 0) {
        updateRenderJob(jobId, {
          status: 'encoding',
          progress: 0.92 + Math.min(0.08, currentFrame / totalFrames * 0.08),
          phaseText: '编码中',
          message: `正在编码视频 ${currentFrame} / ${totalFrames}`,
          currentFrame,
          totalFrames
        });
      }
    }
  };



  return {
    name: 'render-mp4-api',
    configureServer(server) {
      server.middlewares.use('/api/render-mp4', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        (async () => {
          try {
            const payload = await readJsonBody<{
              suggestedName?: string;
              project?: unknown;
              targetLabel?: string;
              encoder?: 'x264' | 'nvenc' | 'nvenc-fast';
            }>(req);

            if (!payload.project || typeof payload.project !== 'object' || Array.isArray(payload.project)) {
              throw new HttpError(400, '缺少 project', '请求体需要包含 project 对象。');
            }

            const projectForLog = payload.project as {meta?: {fps?: number}; segments?: Array<{id?: string; durationInFrames?: number}>};
            const fpsForLog = typeof projectForLog.meta?.fps === 'number' ? projectForLog.meta.fps : 30;
            const segmentDurations = Array.isArray(projectForLog.segments)
              ? projectForLog.segments.map((segment) => ({id: segment.id, durationInFrames: segment.durationInFrames ?? null}))
              : [];
            const totalFrames = segmentDurations.reduce((sum, segment) => sum + (typeof segment.durationInFrames === 'number' ? segment.durationInFrames : 0), 0);

            appendDebugLog('render', '收到渲染请求', {
              suggestedName: payload.suggestedName,
              targetLabel: payload.targetLabel,
              fps: fpsForLog,
              totalFrames,
              totalSeconds: Number((totalFrames / fpsForLog).toFixed(3)),
              segmentDurations,
            });

            const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const tempDir = path.resolve(projectRoot, '.tmp', 'render', jobId);
            const safeName = sanitizeFileName(payload.suggestedName);
            const outputDir = chooseOutputDir('render');
            const outputPath = path.join(outputDir, `${safeName}-${jobId}.mp4`);
            const projectPath = path.join(tempDir, 'project.json');
            fs.mkdirSync(tempDir, {recursive: true});
            fs.writeFileSync(projectPath, JSON.stringify(payload.project, null, 2), 'utf-8');

            renderJobs.set(jobId, {
              id: jobId,
              status: 'queued',
              progress: 0.01,
              phaseText: '排队中',
              message: payload.targetLabel ? `已创建渲染任务：${payload.targetLabel}` : '已创建渲染任务',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              outputPath,
              outputName: path.basename(outputPath),
              targetLabel: payload.targetLabel
            });
            pruneRenderJobs();

            const renderScriptArgs = [
              path.resolve(projectRoot, 'scripts', 'render-account-from-json.mjs'),
              projectPath,
              outputPath,
              payload.encoder ? `--encoder=${payload.encoder}` : undefined,
              payload.targetLabel?.includes('性能') ? '--profile=performance' : undefined,
            ].filter((item): item is string => Boolean(item));

            const child = spawn(process.execPath, renderScriptArgs, {
              cwd: projectRoot,
              stdio: ['ignore', 'pipe', 'pipe'],
              env: createUtf8Env(),
            });
            runningRenderProcesses.set(jobId, {child, tempDir, outputPath});

            child.stdout.setEncoding('utf8');
            child.stderr.setEncoding('utf8');

            let stdout = '';
            let stderr = '';
            let progressBuffer = '';

            child.stdout.on('data', (chunk) => {
              const text = normalizeConsoleText(String(chunk));
              stdout += text;
              progressBuffer = `${progressBuffer}${text}`.slice(-4000);
              parseProgress(jobId, progressBuffer);
              updateRenderJob(jobId, {logTail: stdout.slice(-4000)});
              const compact = compactConsoleText(text);
              if (compact) {
                appendConsoleChunk('render:stdout', compact);
              }
            });

            child.stderr.on('data', (chunk) => {
              const text = normalizeConsoleText(String(chunk));
              stderr += text;
              updateRenderJob(jobId, {logTail: `${stdout}\n${stderr}`.slice(-4000)});
              const compact = compactConsoleText(text);
              if (compact) {
                appendConsoleChunk('render:stderr', compact);
              }
            });

            child.on('close', (code) => {
              const currentJob = renderJobs.get(jobId);
              runningRenderProcesses.delete(jobId);
              if (currentJob?.status === 'canceled') {
                appendDebugLog('render', '渲染任务已取消', {jobId, code, outputPath});
                safeRemovePath(outputPath, 'render');
                safeRemovePath(tempDir, 'render');
                return;
              }

              if (code !== 0 || !fs.existsSync(outputPath)) {
                const failureSummary = summarizeRenderFailure({code, stdout, stderr, outputPath});
                appendDebugLog('render', '渲染失败', {jobId, code, outputPath, failureSummary, stderr: stderr.slice(-2000)});
                updateRenderJob(jobId, {
                  status: 'error',
                  progress: 1,
                  phaseText: failureSummary.phaseText,
                  message: failureSummary.summary,
                  error: failureSummary.summary,
                  resolutionSteps: failureSummary.resolutionSteps,
                  runtimeHint: failureSummary.runtimeHint,
                  logTail: `${stdout}
${stderr}`.slice(-4000)
                });
                safeRemovePath(tempDir, 'render');
                return;
              }

              appendDebugLog('render', '渲染完成', {jobId, outputPath});
              updateRenderJob(jobId, {
                status: 'done',
                progress: 1,
                phaseText: '已完成',
                message: `渲染完成：${path.basename(outputPath)}`,
                outputPath,
                outputName: path.basename(outputPath),
                logTail: stdout.slice(-4000)
              });
              safeRemovePath(tempDir, 'render');
            });

            child.on('error', (error) => {
              const currentJob = renderJobs.get(jobId);
              runningRenderProcesses.delete(jobId);
              if (currentJob?.status === 'canceled') {
                safeRemovePath(outputPath, 'render');
                safeRemovePath(tempDir, 'render');
                return;
              }

              const failureSummary = describeRenderSpawnFailure(error);
              appendDebugLog('render', '渲染进程启动失败', {jobId, error: error.message, failureSummary, outputPath});
              updateRenderJob(jobId, {
                status: 'error',
                progress: 1,
                phaseText: failureSummary.phaseText,
                message: failureSummary.summary,
                error: failureSummary.summary,
                resolutionSteps: failureSummary.resolutionSteps,
                runtimeHint: failureSummary.runtimeHint,
                logTail: `${stdout}
${stderr}
${error.message}`.slice(-4000)
              });
              safeRemovePath(tempDir, 'render');
            });

            sendJson(res, 200, {
              job_id: jobId,
              output_path: outputPath,
              output_name: path.basename(outputPath)
            });
          } catch (error) {
            appendDebugLog('render', '接口异常', {error: error instanceof Error ? error.message : String(error)});
            const response = toApiErrorResponse(error, 'MP4 导出接口异常');
            sendJson(res, response.statusCode, response.payload);
          }
        })();
      });

      server.middlewares.use('/api/render-status', (req, res, next) => {
        if (req.method !== 'GET') {
          next();
          return;
        }

        const url = new URL(req.url || '', 'http://127.0.0.1');
        const jobId = url.searchParams.get('jobId');
        if (!jobId) {
          sendJson(res, 400, {error: '缺少 jobId', details: '请检查查询参数是否包含 jobId。'});
          return;
        }

        let job = renderJobs.get(jobId);
        if (!job) {
          pruneRenderJobs();
          sendJson(res, 404, {error: '找不到该渲染任务', details: '任务可能不存在、已过期（默认保留 30 分钟），或服务已重启。'});
          return;
        }

        if (job.logTail) {
          parseProgress(jobId, job.logTail);
          const refreshedJob = renderJobs.get(jobId);
          if (refreshedJob) {
            job = refreshedJob;
          }
        }

        pruneRenderJobs();
        sendJson(res, 200, job);
      });

      server.middlewares.use('/api/render-cancel', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        (async () => {
          try {
            const payload = await readJsonBody<{jobId?: string}>(req);
            if (!payload.jobId) {
              throw new HttpError(400, '缺少 jobId', '请求体需要包含 jobId。');
            }

            const job = renderJobs.get(payload.jobId);
            if (!job) {
              sendJson(res, 404, {error: '找不到该渲染任务', details: '任务可能不存在、已过期（默认保留 30 分钟），或服务已重启。'});
              return;
            }

            if (job.status === 'done' || job.status === 'error' || job.status === 'canceled') {
              sendJson(res, 409, {error: '该渲染任务已结束，无法取消', details: `当前状态：${job.status}`} );
              return;
            }

            const handle = runningRenderProcesses.get(payload.jobId);
            if (!handle) {
              sendJson(res, 409, {error: '该渲染任务当前不可取消', details: '渲染进程句柄不存在，任务可能已接近完成或服务已重启。'});
              return;
            }

            updateRenderJob(payload.jobId, {
              status: 'canceled',
              phaseText: '已取消',
              message: job.targetLabel ? `已取消渲染：${job.targetLabel}` : '渲染已取消',
              outputPath: undefined,
              outputName: undefined,
              error: undefined,
            });

            appendDebugLog('render', '收到取消渲染请求', {jobId: payload.jobId, outputPath: handle.outputPath});
            try {
              if (process.platform === 'win32') {
                const killer = spawn('taskkill', ['/pid', String(handle.child.pid), '/t', '/f'], {stdio: 'ignore'});
                killer.unref();
              } else {
                handle.child.kill('SIGTERM');
              }
            } catch (error) {
              appendDebugLog('render', '取消渲染进程失败', {jobId: payload.jobId, error: error instanceof Error ? error.message : String(error)});
            }

            sendJson(res, 200, {
              ok: true,
              job_id: payload.jobId,
              status: 'canceled',
              message: job.targetLabel ? `已取消渲染：${job.targetLabel}` : '渲染已取消',
            });
          } catch (error) {
            const response = toApiErrorResponse(error, '取消渲染任务失败');
            sendJson(res, response.statusCode, response.payload);
          }
        })();
      });

      server.middlewares.use('/api/open-output-dir', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        (async () => {
          try {
            const payload = await readJsonBody<{outputPath?: string}>(req);
            if (typeof payload.outputPath !== 'string' || !payload.outputPath.trim()) {
              throw new HttpError(400, '缺少 outputPath', '请求体需要包含 outputPath。');
            }

            appendDebugLog('open-dir', '打开输出目录', {outputPath: payload.outputPath});
            const targetDir = openOutputDirectory(payload.outputPath);
            sendJson(res, 200, {ok: true, target_dir: targetDir});
          } catch (error) {
            const response = toApiErrorResponse(error, '打开输出目录失败');
            sendJson(res, response.statusCode, response.payload);
          }
        })();
      });
    }
  };
};

export default defineConfig({
  root: editorRoot,
  plugins: [react(), voiceoverAlignPlugin(), renderMp4Plugin()],
  server: {
    host: '0.0.0.0',
    port: 4173,
    fs: {
      allow: [projectRoot]
    }
  }
});
