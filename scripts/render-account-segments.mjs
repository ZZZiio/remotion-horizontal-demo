import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const parseCliArgs = (argv) => {
  const positional = [];
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;

    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const withoutPrefix = arg.slice(2);
    if (!withoutPrefix) continue;

    const equalsIndex = withoutPrefix.indexOf('=');
    if (equalsIndex !== -1) {
      const key = withoutPrefix.slice(0, equalsIndex);
      const value = withoutPrefix.slice(equalsIndex + 1);
      flags[key] = value;
      continue;
    }

    const key = withoutPrefix;
    const nextValue = argv[index + 1];
    if (nextValue && !nextValue.startsWith('--')) {
      flags[key] = nextValue;
      index += 1;
    } else {
      flags[key] = true;
    }
  }

  return {positional, flags};
};

const pickFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('无法获取可用端口')));
        return;
      }

      const port = address.port;
      server.close(() => resolve(port));
    });
  });

const describeSpawnFailure = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    return `无法启动渲染命令：${message}。请检查 Node.js / npx / Remotion 是否可用。`;
  }

  return message;
};

const runCommand = ({command, args, cwd, label, stdio = 'inherit', env}) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio,
    shell: false,
    env: {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      ...env,
    },
  });

  if (result.error) {
    throw new Error(`${label} failed: ${describeSpawnFailure(result.error)}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? String(result.stderr) : '';
    const exitCode = typeof result.status === 'number' ? String(result.status) : 'unknown';
    throw new Error(`${label} exited with code ${exitCode}${result.signal ? ` (signal ${result.signal})` : ''}.${stderr ? `\n${stderr}` : ''}`);
  }

  return result;
};

const normalizeText = (value, fallback = '') => {
  if (value === null || typeof value === 'undefined') {
    return fallback;
  }

  return typeof value === 'string' ? value : String(value);
};

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, {recursive: true});
};

const stableHash = (value) => {
  const serialized = JSON.stringify(value);
  return crypto.createHash('sha1').update(serialized).digest('hex');
};

const loadNormalizedPayload = (inputPath, outputPath, passThroughArgs) => {
  const projectRoot = process.cwd();
  const renderScript = path.resolve(projectRoot, 'scripts', 'render-account-from-json.mjs');
  const args = [renderScript, inputPath];
  if (outputPath) {
    args.push(outputPath);
  }
  if (passThroughArgs.length) {
    args.push(...passThroughArgs);
  }

  const result = runCommand({
    command: process.execPath,
    args,
    cwd: projectRoot,
    label: 'Normalize project JSON',
    stdio: 'pipe',
    env: {
      REMOTION_RENDER_VALIDATE_ONLY: '1',
    },
  });

  const stdout = result.stdout ? result.stdout.toString('utf-8') : '';
  if (!stdout.trim()) {
    throw new Error('未获取到归一化后的配置。');
  }

  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`归一化输出解析失败：${error instanceof Error ? error.message : String(error)}`);
  }

  if (!payload?.normalizedPayload) {
    throw new Error('归一化输出缺少 normalizedPayload 字段。');
  }

  return payload.normalizedPayload;
};

const buildSegmentHash = (config, segment, segmentIndex, outputPath) => {
  const meta = config.meta ? {};
  const metaForHash = {
    projectName: meta.projectName,
    accountName: meta.accountName,
    positioning: meta.positioning,
    width: meta.width,
    height: meta.height,
    fps: meta.fps,
    transitionPreset: meta.transitionPreset,
    ipEnabled: meta.ipEnabled,
    ipName: meta.ipName,
    ipSlogan: meta.ipSlogan,
    ipHandle: meta.ipHandle,
    ipLogoUrl: meta.ipLogoUrl,
    visualSkin: meta.visualSkin,
    subtitleMode: meta.subtitleMode,
    sfxEnabled: meta.sfxEnabled,
    sfxVolume: meta.sfxVolume,
    previewAudioUrl: meta.previewAudioUrl,
    previewAudioName: meta.previewAudioName,
    previewAudioEnabled: meta.previewAudioEnabled,
    previewAudioMuted: meta.previewAudioMuted,
    performanceMode: meta.performanceMode,
  };

  return stableHash({
    meta: metaForHash,
    theme: config.theme,
    tags: config.tags,
    segment,
    segmentIndex,
    outputPath,
  });
};

const sanitizeFileName = (value) => {
  const raw = normalizeText(value, '').trim();
  if (!raw) {
    return 'segment';
  }

  const cleaned = raw.replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-');
  return cleaned.trim('-') || 'segment';
};

const {positional: cliArgs, flags: cliFlags} = parseCliArgs(process.argv.slice(2));

const inputPathArg = cliArgs[0];
const outputPathArg = cliArgs[1];
const forceRender = cliFlags.force === true;
const keepCache = cliFlags['keep-cache'] === true || cliFlags.keepCache === true;

process.stdout.setDefaultEncoding?.('utf8');
process.stderr.setDefaultEncoding?.('utf8');
process.env.NO_COLOR ?= '1';
process.env.FORCE_COLOR ?= '0';
process.env.PYTHONUTF8 ?= '1';
process.env.PYTHONIOENCODING ?= 'utf-8';

let exitCode = 0;

try {
  if (!inputPathArg) {
    throw new Error('用法：node scripts/render-account-segments.mjs <项目JSON路径> [输出mp4路径] [--force] [--profile=performance] [--width=1280] [--height=720] [--fps=24]');
  }

  const projectRoot = process.cwd();
  const inputPath = path.resolve(projectRoot, inputPathArg);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`找不到项目 JSON：${inputPath}`);
  }

  const outputPath = outputPathArg
    ? path.resolve(projectRoot, outputPathArg)
    : path.resolve(projectRoot, 'out', `${path.basename(inputPath, path.extname(inputPath))}.mp4`);

  ensureDir(path.dirname(outputPath));

  const passThroughArgs = [];
  if (cliFlags.profile) {
    passThroughArgs.push(`--profile=${cliFlags.profile}`);
  }
  if (cliFlags.width) {
    passThroughArgs.push(`--width=${cliFlags.width}`);
  }
  if (cliFlags.height) {
    passThroughArgs.push(`--height=${cliFlags.height}`);
  }
  if (cliFlags.fps) {
    passThroughArgs.push(`--fps=${cliFlags.fps}`);
  }

  const normalizedPayload = loadNormalizedPayload(inputPath, outputPath, passThroughArgs);
  const segments = Array.isArray(normalizedPayload.segments) ? normalizedPayload.segments : [];
  if (!segments.length) {
    throw new Error('项目 segments 为空，无法分段渲染');
  }

  const propsDir = path.resolve(projectRoot, '.tmp', 'render-normalized');
  ensureDir(propsDir);
  const normalizedPropsPath = path.join(propsDir, `${path.basename(inputPath, path.extname(inputPath))}.normalized.json`);
  fs.writeFileSync(normalizedPropsPath, JSON.stringify(normalizedPayload, null, 2), 'utf-8');

  const cacheKey = path.basename(inputPath, path.extname(inputPath));
  const cacheDir = path.resolve(projectRoot, '.tmp', 'segment-cache', cacheKey);
  ensureDir(cacheDir);
  const manifestPath = path.join(cacheDir, 'manifest.json');
  let manifest = {version: 1, segments: {}};

  if (fs.existsSync(manifestPath)) {
    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        manifest = {...manifest, ...parsed};
      }
    } catch {}
  }

  const rendererPort = await pickFreePort();
  const npxCommand = process.platform === 'win32' ? 'cmd.exe' : 'npx';

  const buildRemotionArgs = (renderOutput, extraArgs = []) => {
    const baseArgs = ['remotion', 'render', 'src/index.ts', 'AccountDeepTemplate', renderOutput, `--props=${normalizedPropsPath}`, `--port=${rendererPort}`];
    const mergedArgs = baseArgs.concat(extraArgs);
    return process.platform === 'win32' ? ['/d', '/s', '/c', 'npx', ...mergedArgs] : mergedArgs;
  };

  let cursor = 0;
  let renderedCount = 0;
  const outputSegments = [];

  segments.forEach((segment, index) => {
    const duration = Math.max(1, Math.round(Number(segment.durationInFrames) || 0));
    const startFrame = cursor;
    const endFrame = Math.max(startFrame, startFrame + duration - 1);
    cursor += duration;

    const segmentKey = `${index}-${segment.id}`;
    const segmentHash = buildSegmentHash(normalizedPayload, segment, index, outputPath);
    const outputName = `${String(index + 1).padStart(2, '0')}-${sanitizeFileName(segment.id)}.mp4`;
    const segmentOutputPath = path.join(cacheDir, outputName);

    const cached = manifest.segments?.[segmentKey];
    const cacheHit = !forceRender && cached?.hash === segmentHash && fs.existsSync(segmentOutputPath);

    if (!cacheHit) {
      console.log(`渲染分段 ${index + 1}/${segments.length}：${segment.label || segment.id}`);
      runCommand({
        command: npxCommand,
        args: buildRemotionArgs(segmentOutputPath, [`--frames=${startFrame}-${endFrame}`]),
        cwd: projectRoot,
        label: `Render segment ${segmentKey}`,
      });
      renderedCount += 1;
    }

    manifest.segments[segmentKey] = {
      hash: segmentHash,
      outputPath: segmentOutputPath,
      startFrame,
      endFrame,
      durationInFrames: duration,
      updatedAt: new Date().toISOString(),
    };

    outputSegments.push(segmentOutputPath);
  });

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(renderedCount ? `重新渲染 ${renderedCount} 段。开始拼接…` : '全部分段命中缓存，直接拼接…');

  const concatListPath = path.join(cacheDir, 'concat.txt');
  const concatLines = outputSegments.map((filePath) => {
    const safePath = filePath.replace(/\\/g, '/').replace(/'/g, "'\\''");
    return `file '${safePath}'`;
  });
  fs.writeFileSync(concatListPath, concatLines.join('\n'), 'utf-8');

  const baseFfmpegArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath];

  const runConcat = (extraArgs, label) =>
    runCommand({
      command: 'ffmpeg',
      args: baseFfmpegArgs.concat(extraArgs).concat(['-movflags', '+faststart', outputPath]),
      cwd: projectRoot,
      label,
    });

  try {
    runConcat(['-c', 'copy'], 'ffmpeg concat copy');
  } catch (error) {
    console.warn('ffmpeg copy 拼接失败，回退到重编码。');
    runConcat(['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', '-b:a', '192k'], 'ffmpeg concat re-encode');
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error(`拼接完成但未找到输出文件：${outputPath}`);
  }

  console.log(`分段拼接完成：${outputPath}`);

  if (!keepCache) {
    try {
      fs.rmSync(concatListPath, {force: true});
    } catch {}
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  exitCode = 1;
}

process.exitCode = exitCode;
