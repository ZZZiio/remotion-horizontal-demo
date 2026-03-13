import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadProjectEnv} from './load-project-env.mjs';

const projectRoot = process.cwd();
loadProjectEnv(projectRoot, {override: true});
const DEFAULT_CRS_BASE_URL = 'https://ls.xingchentech.asia/openai';
const defaultModel = process.env.OPENAI_MODEL || (process.env.CRS_OAI_KEY ? 'gpt-5.4' : 'gpt-5');
const defaultPromptBuilderPath = path.resolve(projectRoot, 'scripts', 'build-project-analysis-prompt.mjs');
const defaultJsonDir = path.resolve(projectRoot, 'out', 'json');
const defaultPromptDir = path.resolve(projectRoot, 'out', 'prompts');
const defaultResponseDir = path.resolve(projectRoot, 'out', 'openai');

const usage = `用法：node scripts/build-project-json.mjs --link <项目链接> [选项]\n\n选项：\n  --name <项目名>\n  --target-seconds <秒>          可选，目标总时长（秒），例如 300\n  --extra <文本>\n  --extra-file <文件路径>\n  --snapshot <文本>\n  --snapshot-file <文件路径>\n  --model <模型名>                默认取 OPENAI_MODEL，若存在 CRS_OAI_KEY 默认 gpt-5.4，否则 gpt-5\n  --output <json输出路径>\n  --print                         打印生成的 JSON\n  --prompt-only                   只生成提示词（不调用 OpenAI API）\n  --no-web-search                 不启用 web search 工具\n`;

const parseArgs = (argv) => {
  const parsed = {print: false, 'no-web-search': false, 'prompt-only': false};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`无法识别的参数：${token}\n\n${usage}`);
    }

    const key = token.slice(2);
    if (key === 'print' || key === 'no-web-search' || key === 'prompt-only') {
      parsed[key] = true;
      continue;
    }

    const value = argv[index + 1];
    if (typeof value === 'undefined' || value.startsWith('--')) {
      throw new Error(`参数 ${token} 缺少值\n\n${usage}`);
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
};

const sanitizeFileName = (value) => {
  return String(value)
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'project';
};

const readJsonFile = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''));

const stickVisualPresets = ['stick-dialogue', 'stick-conflict', 'stick-compare', 'stick-narration'];
const stickTemplateByPreset = {
  'stick-dialogue': 'dialogue',
  'stick-conflict': 'conflict',
  'stick-compare': 'compare',
  'stick-narration': 'narration',
};

const stickActorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: {type: 'string', minLength: 1},
    name: {type: 'string'},
    role: {type: 'string', enum: ['self', 'other', 'boss', 'customer', 'partner', 'narrator']},
    genderHint: {type: 'string', enum: ['female', 'male', 'neutral']},
    color: {type: 'string', minLength: 4},
    accentColor: {type: 'string', minLength: 4},
    emotion: {type: 'string', enum: ['neutral', 'happy', 'angry', 'sad', 'awkward', 'surprised', 'confident', 'anxious']},
    pose: {type: 'string', enum: ['stand', 'talk', 'point', 'shrug', 'hands-up', 'facepalm', 'sit']},
    position: {type: 'string', enum: ['left', 'center', 'right']},
    accessory: {type: 'string', enum: ['none', 'glasses', 'tie', 'bag', 'phone']},
  },
};

const stickBubbleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'text', 'startFrame', 'durationInFrames'],
  properties: {
    actorId: {type: 'string', minLength: 1},
    text: {type: 'string', minLength: 1},
    tone: {type: 'string', enum: ['say', 'think', 'shout', 'whisper']},
    startFrame: {type: 'integer', minimum: 0},
    durationInFrames: {type: 'integer', minimum: 1},
    emphasis: {type: 'boolean'},
  },
};

const stickBeatSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'type', 'startFrame'],
  properties: {
    id: {type: 'string', minLength: 1},
    type: {type: 'string', enum: ['enter', 'exit', 'shake', 'nod', 'turn', 'freeze', 'highlight', 'caption', 'question', 'exclamation']},
    actorId: {type: 'string', minLength: 1},
    startFrame: {type: 'integer', minimum: 0},
    durationInFrames: {type: 'integer', minimum: 1},
    value: {type: 'number'},
    text: {type: 'string', minLength: 1},
  },
};

const stickSceneSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['template', 'actors'],
  properties: {
    template: {type: 'string', enum: ['dialogue', 'conflict', 'compare', 'narration']},
    backgroundStyle: {type: 'string', enum: ['plain', 'room', 'office', 'street', 'classroom']},
    actors: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: stickActorSchema,
    },
    bubbles: {
      type: 'array',
      maxItems: 6,
      items: stickBubbleSchema,
    },
    beats: {
      type: 'array',
      maxItems: 8,
      items: stickBeatSchema,
    },
    topCaption: {type: 'string', minLength: 1},
    bottomCaption: {type: 'string', minLength: 1},
    relationship: {type: 'string', enum: ['couple', 'coworker', 'boss-employee', 'friend', 'customer-service']},
    autoCamera: {type: 'boolean'},
  },
};

const stickSceneTemplateGuards = Object.entries(stickTemplateByPreset).map(([visualPreset, template]) => ({
  if: {
    type: 'object',
    properties: {
      visualPreset: {const: visualPreset},
    },
    required: ['visualPreset'],
  },
  then: {
    type: 'object',
    required: ['stickScene'],
    properties: {
      stickScene: {
        type: 'object',
        required: ['template'],
        properties: {
          template: {const: template},
        },
      },
    },
  },
}));

const projectSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['meta', 'theme', 'tags', 'segments'],
  properties: {
    meta: {
      type: 'object',
      additionalProperties: false,
      required: ['projectName', 'accountName', 'positioning', 'width', 'height', 'fps', 'visualSkin'],
      properties: {
        projectName: {type: 'string', minLength: 1},
        accountName: {type: 'string', minLength: 1},
        positioning: {type: 'string', minLength: 1},
        width: {type: 'integer', minimum: 320},
        height: {type: 'integer', minimum: 320},
        fps: {type: 'integer', minimum: 1, maximum: 120},
        visualSkin: {type: 'string', minLength: 1},
        transitionPreset: {type: 'string', minLength: 1},
        ipEnabled: {type: 'boolean'},
        ipName: {type: 'string', minLength: 1},
        ipSlogan: {type: 'string', minLength: 1},
        ipHandle: {type: 'string', minLength: 1},
        ipLogoUrl: {type: 'string', minLength: 1},
        publishTitle: {type: 'string', minLength: 1},
        publishDescription: {type: 'string', minLength: 1},
        publishTopics: {type: 'string', minLength: 1},
        sfxEnabled: {type: 'boolean'},
        sfxVolume: {type: 'number', minimum: 0, maximum: 2},
      },
    },
    theme: {
      type: 'object',
      additionalProperties: false,
      required: ['accentColor', 'secondaryColor', 'pageLight', 'pageDark'],
      properties: {
        accentColor: {type: 'string', minLength: 4},
        secondaryColor: {type: 'string', minLength: 4},
        pageLight: {type: 'string', minLength: 4},
        pageDark: {type: 'string', minLength: 4},
      },
    },
    tags: {
      type: 'object',
      additionalProperties: false,
      required: ['left', 'right'],
      properties: {
        left: {type: 'string', minLength: 1},
        right: {type: 'string', minLength: 1},
      },
    },
    segments: {
      type: 'array',
      minItems: 6,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'label',
          'navLabel',
          'duration_sec',
          'layout',
          'motionPreset',
          'visualPreset',
          'title',
          'subtitle',
          'bottomConclusion',
          'voiceoverText',
          'humanConclusion',
          'points',
          'mediaLabel',
          'mediaPrompt',
          'evidenceText',
          'needsGithubEvidence',
        ],
        properties: {
          id: {type: 'string', minLength: 1},
          label: {type: 'string', minLength: 1},
          navLabel: {type: 'string', minLength: 1},
          duration_sec: {type: 'number', minimum: 1},
          layout: {type: 'string', enum: ['hero', 'concept', 'dashboard', 'phone', 'summary']},
          motionPreset: {type: 'string', enum: ['lift', 'calm', 'stagger', 'spotlight']},
          visualPreset: {type: 'string', enum: ['orb', 'dashboard', 'phone', 'image', 'nodes', ...stickVisualPresets]},
          title: {type: 'string', minLength: 1},
          subtitle: {type: 'string', minLength: 1},
          bottomConclusion: {type: 'string', minLength: 1},
          voiceoverText: {type: 'string', minLength: 1},
          humanConclusion: {type: 'string', minLength: 1},
          points: {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            items: {type: 'string', minLength: 1},
          },
          mediaLabel: {type: 'string', minLength: 1},
          mediaPrompt: {type: 'string', minLength: 1},
          stickScene: stickSceneSchema,
          evidenceText: {type: 'string', minLength: 1},
          needsGithubEvidence: {type: 'boolean'},
        },
        allOf: stickSceneTemplateGuards,
      },
    },
  },
};

const extractTextFromResponse = (responseData) => {
  if (typeof responseData.output_text === 'string' && responseData.output_text.trim()) {
    return responseData.output_text.trim();
  }

  const chunks = [];
  for (const item of responseData.output ?? []) {
    if (item.type !== 'message') {
      continue;
    }

    for (const content of item.content ?? []) {
      if (typeof content.text === 'string' && content.text.trim()) {
        chunks.push(content.text.trim());
      }
    }
  }

  if (chunks.length) {
    return chunks.join('\n');
  }

  return '';
};

const parseStreamedResponse = async (response) => {
  const reader = response.body?.getReader?.();
  if (!reader) {
    throw new Error('OpenAI API 返回了流式响应，但无法读取响应体。');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let responseData = null;

  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, {stream: true});
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const lines = part.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let eventObj;
        try {
          eventObj = JSON.parse(data);
        } catch {
          continue;
        }
        if (eventObj?.type === 'response.output_text.delta' && typeof eventObj.delta === 'string') {
          text += eventObj.delta;
          continue;
        }
        if (eventObj?.type === 'response.output_text.done' && typeof eventObj.text === 'string' && !text) {
          text += eventObj.text;
          continue;
        }
        if (eventObj?.type === 'response.completed' && eventObj.response) {
          responseData = eventObj.response;
          continue;
        }
        if (eventObj?.response && !responseData) {
          responseData = eventObj.response;
        }
      }
    }
  }

  if (!responseData) {
    responseData = {output_text: text};
  }

  return {responseData, text: text.trim()};
};

const buildPrompt = (args) => {
  const builderArgs = [defaultPromptBuilderPath, '--link', String(args.link).trim()];
  for (const key of ['name', 'target-seconds', 'extra', 'extra-file', 'snapshot', 'snapshot-file']) {
    if (typeof args[key] === 'string' && args[key].trim()) {
      builderArgs.push(`--${key}`, args[key].trim());
    }
  }

  const result = spawnSync('node', builderArgs, {
    cwd: projectRoot,
    encoding: 'utf-8',
    env: process.env,
  });

  if (result.error) {
    throw new Error(`拼装提示词失败：${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`拼装提示词失败：${(result.stderr || result.stdout || '').trim()}`);
  }

  const payload = JSON.parse((result.stdout || '').trim());
  const promptPath = path.resolve(projectRoot, payload.outputPath);
  const promptText = fs.readFileSync(promptPath, 'utf-8').replace(/^\uFEFF/, '');
  return {payload, promptPath, promptText};
};

const callOpenAI = async ({model, promptText, input, useWebSearch}) => {
  const apiKey = process.env.CRS_OAI_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || (process.env.CRS_OAI_KEY ? DEFAULT_CRS_BASE_URL : 'https://api.openai.com')).replace(/\/+$/, '');
  if (!apiKey) {
    throw new Error('缺少 OPENAI_API_KEY 或 CRS_OAI_KEY，无法自动调用模型。');
  }

  const useStream = Boolean(process.env.CRS_OAI_KEY);

  const payload = {
    model,
    input: input ?? [
      {
        role: 'user',
        content: promptText,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'remotion_project_json',
        strict: true,
        schema: projectSchema,
      },
    },
    ...(useStream ? {stream: true} : {}),
  };

  if (useWebSearch) {
    payload.tools = [{type: 'web_search'}];
  }

  const response = await fetch(`${baseUrl}/v1/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.CRS_OAI_KEY
        ? {'x-api-key': apiKey}
        : {Authorization: `Bearer ${apiKey}`}),
    },
    body: JSON.stringify(payload),
  });

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let responseText = '';
  let responseData = null;

  if (!response.ok) {
    responseText = await response.text();
    if (responseText.trim()) {
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = null;
      }
    }
    const errorMessage = responseData?.error?.message
      ? String(responseData.error.message)
      : (responseText.trim() || '响应体为空');
    if (response.status === 401) {
      throw new Error(`OpenAI API 调用失败：401 Unauthorized。请检查 CRS_OAI_KEY 或 OPENAI_API_KEY 是否有效、是否过期、是否使用了错误类型的 key。\n${errorMessage}`);
    }

    throw new Error(`OpenAI API 调用失败：${response.status} ${response.statusText}\n${errorMessage}`);
  }

  if (useStream) {
    const streamed = await parseStreamedResponse(response);
    responseData = streamed.responseData;
    const text = streamed.text || extractTextFromResponse(responseData);
    if (!text) {
      throw new Error(`模型返回中没有可用文本：${JSON.stringify(responseData, null, 2)}`);
    }
    return {responseData, text};
  }

  responseText = await response.text();
  if (responseText.trim()) {
    try {
      responseData = JSON.parse(responseText);
    } catch (error) {
      const preview = responseText.slice(0, 800);
      throw new Error(`OpenAI API 返回了无法解析的响应（HTTP ${response.status} ${response.statusText}，content-type: ${contentType || 'unknown'}）：${error instanceof Error ? error.message : String(error)}\n\n${preview}`);
    }
  }

  if (!responseData) {
    throw new Error(`OpenAI API 返回成功状态，但响应体为空（content-type: ${contentType || 'unknown'}）。`);
  }

  const text = extractTextFromResponse(responseData);
  if (!text) {
    throw new Error(`模型返回中没有可用文本：${JSON.stringify(responseData, null, 2)}`);
  }

  return {responseData, text};
};

const parseGeneratedJson = (text, sourceLabel = '模型返回') => {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${sourceLabel} 不是合法 JSON：${error instanceof Error ? error.message : String(error)}\n\n${text}`);
  }
};

const trimForRepairPrompt = (value, maxLength = 12000) => {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n...[已截断，共 ${text.length} 字]`;
};

const buildRepairPrompt = ({promptText, brokenText, validationError}) => {
  return [
    '你是一个专门修复结构化视频项目 JSON 的修复器。',
    '目标：基于原始任务、当前失败 JSON 和错误信息，输出一份可以通过校验的最终 JSON。',
    '必须遵守：',
    '1. 只输出最终 JSON，不要输出解释。',
    '2. 保留原内容意图，优先修复结构、枚举值、缺失字段、字段类型、段落数量、时长、points 数量等问题。',
    '3. 输出必须满足 remotion_project_json schema。',
    '4. segments 必须正好 6 段。',
    '5. visualPreset 必须使用允许的枚举值。',
    '6. 如果存在 stickScene，也要保证其内容与 visualPreset 合理匹配。',
    '',
    '【原始任务提示词】',
    trimForRepairPrompt(promptText, 18000),
    '',
    '【当前失败 JSON / 文本】',
    trimForRepairPrompt(brokenText, 18000),
    '',
    '【错误信息】',
    trimForRepairPrompt(validationError, 6000),
  ].join('\n');
};

const attemptJsonRepair = async ({model, promptText, brokenText, validationError}) => {
  const repairPrompt = buildRepairPrompt({promptText, brokenText, validationError});
  const {responseData, text} = await callOpenAI({
    model,
    promptText: repairPrompt,
    useWebSearch: false,
  });

  return {
    repairPrompt,
    responseData,
    text,
    generatedJson: parseGeneratedJson(text, '自动修复结果'),
  };
};

const validateJson = (jsonPath) => {
  const result = spawnSync('node', ['scripts/render-account-from-json.mjs', jsonPath], {
    cwd: projectRoot,
    encoding: 'utf-8',
    env: {
      ...process.env,
      REMOTION_RENDER_VALIDATE_ONLY: '1',
    },
  });

  if (result.error) {
    throw new Error(`JSON 校验失败：${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`JSON 校验失败：${(result.stderr || result.stdout || '').trim()}`);
  }

  return JSON.parse((result.stdout || '').trim());
};

try {
  const args = parseArgs(process.argv.slice(2));
  const link = String(args.link ?? '').trim();
  if (!link) {
    throw new Error(`缺少 --link 参数\n\n${usage}`);
  }

  const model = String(args.model ?? defaultModel).trim();
  const useWebSearch = !args['no-web-search'];
  const {payload: promptMeta, promptPath, promptText} = buildPrompt(args);

  const promptOnly = Boolean(args['prompt-only']);
  if (promptOnly || !(process.env.OPENAI_API_KEY || process.env.CRS_OAI_KEY)) {
    const projectName = String(args.name ?? promptMeta.projectName ?? 'project').trim();
    const result = {
      ok: true,
      mode: 'prompt-only',
      model,
      link,
      projectName,
      promptPath,
      useWebSearch,
      reason: promptOnly ? 'prompt-only' : 'missing-openai-api-key',
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  const initialResponse = await callOpenAI({model, promptText, useWebSearch});

  let generatedJson = null;
  let repairAttempted = false;
  let repairSucceeded = false;
  let repairReason = null;
  let repairResponseData = null;
  let repairPromptText = '';
  let firstPassJsonPath = null;

  try {
    generatedJson = parseGeneratedJson(initialResponse.text);
  } catch (error) {
    repairAttempted = true;
    repairReason = error instanceof Error ? error.message : String(error);

    const repaired = await attemptJsonRepair({
      model,
      promptText,
      brokenText: initialResponse.text,
      validationError: repairReason,
    });

    generatedJson = repaired.generatedJson;
    repairResponseData = repaired.responseData;
    repairPromptText = repaired.repairPrompt;
    repairSucceeded = true;
  }

  const projectName = String(args.name ?? promptMeta.projectName ?? generatedJson?.meta?.projectName ?? 'project').trim();
  const safeName = sanitizeFileName(projectName);
  const jsonPath = path.resolve(projectRoot, args.output ?? path.join(defaultJsonDir, `${safeName}.json`));
  const responsePath = path.resolve(projectRoot, path.join(defaultResponseDir, `${safeName}.response.json`));
  const normalizedPath = path.resolve(projectRoot, path.join(defaultJsonDir, `${safeName}.normalized.json`));
  const repairResponsePath = path.resolve(projectRoot, path.join(defaultResponseDir, `${safeName}.repair.response.json`));
  const repairPromptPath = path.resolve(projectRoot, path.join(defaultPromptDir, `${safeName}.repair.txt`));
  firstPassJsonPath = path.resolve(projectRoot, path.join(defaultJsonDir, `${safeName}.first-pass.json`));

  fs.mkdirSync(path.dirname(jsonPath), {recursive: true});
  fs.mkdirSync(path.dirname(responsePath), {recursive: true});
  fs.mkdirSync(path.dirname(repairResponsePath), {recursive: true});
  fs.mkdirSync(path.dirname(repairPromptPath), {recursive: true});
  fs.writeFileSync(responsePath, JSON.stringify(initialResponse.responseData, null, 2), 'utf-8');

  if (!repairAttempted) {
    fs.writeFileSync(jsonPath, JSON.stringify(generatedJson, null, 2), 'utf-8');

    try {
      const validation = validateJson(path.relative(projectRoot, jsonPath));
      fs.writeFileSync(normalizedPath, JSON.stringify(validation.normalizedPayload, null, 2), 'utf-8');

      const result = {
        ok: true,
        model,
        link,
        promptPath,
        jsonPath,
        normalizedPath,
        responsePath,
        useWebSearch,
        repairAttempted,
        repairSucceeded,
      };

      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      repairAttempted = true;
      repairReason = error instanceof Error ? error.message : String(error);
      fs.writeFileSync(firstPassJsonPath, JSON.stringify(generatedJson, null, 2), 'utf-8');

      const repaired = await attemptJsonRepair({
        model,
        promptText,
        brokenText: JSON.stringify(generatedJson, null, 2),
        validationError: repairReason,
      });

      generatedJson = repaired.generatedJson;
      repairResponseData = repaired.responseData;
      repairPromptText = repaired.repairPrompt;
      repairSucceeded = true;
    }
  }

  if (repairAttempted) {
    if (repairResponseData) {
      fs.writeFileSync(repairResponsePath, JSON.stringify(repairResponseData, null, 2), 'utf-8');
    }
    if (repairPromptText) {
      fs.writeFileSync(repairPromptPath, repairPromptText, 'utf-8');
    }

    fs.writeFileSync(jsonPath, JSON.stringify(generatedJson, null, 2), 'utf-8');

    let validation;
    try {
      validation = validateJson(path.relative(projectRoot, jsonPath));
    } catch (error) {
      const finalError = error instanceof Error ? error.message : String(error);
      throw new Error(`JSON 自动修复后仍未通过校验。\n\n初始错误：${repairReason || '未知错误'}\n\n修复后错误：${finalError}\n\n首轮结果：${firstPassJsonPath && fs.existsSync(firstPassJsonPath) ? firstPassJsonPath : '见 responsePath'}\n修复响应：${repairResponseData ? repairResponsePath : '未生成'}`);
    }

    fs.writeFileSync(normalizedPath, JSON.stringify(validation.normalizedPayload, null, 2), 'utf-8');

    const result = {
      ok: true,
      model,
      link,
      promptPath,
      jsonPath,
      normalizedPath,
      responsePath,
      repairResponsePath: repairResponseData ? repairResponsePath : undefined,
      repairPromptPath: repairPromptText ? repairPromptPath : undefined,
      firstPassJsonPath: firstPassJsonPath && fs.existsSync(firstPassJsonPath) ? firstPassJsonPath : undefined,
      useWebSearch,
      repairAttempted,
      repairSucceeded,
      repairReason,
    };

    console.log(JSON.stringify(result, null, 2));
  }
  if (args.print) {
    console.log('\n===== GENERATED JSON =====\n');
    console.log(JSON.stringify(generatedJson, null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}



