import fs from 'node:fs';
import path from 'node:path';
import {TextDecoder} from 'node:util';

const projectRoot = process.cwd();
const defaultTemplatePath = path.resolve(projectRoot, 'examples', 'project-analysis-to-remotion-json.prompt.txt');
const defaultAccountPromptCandidates = [
  process.env.ACCOUNT_PROMPT_PATH,
  process.env.PROJECT_ACCOUNT_PROMPT_PATH,
  path.resolve(projectRoot, 'examples', 'account-prompt.txt'),
  path.resolve(projectRoot, '提示词工程（85分版）.txt'),
  path.resolve('C:\\Users\\Administrator\\Desktop\\提示词工程（85分版）.txt'),
].filter(Boolean);
const defaultOutputDir = path.resolve(projectRoot, 'out', 'prompts');
const defaultTargetDurationSeconds = 60;

const usage = `用法：node scripts/build-project-analysis-prompt.mjs --link <项目链接> [选项]\n\n选项：\n  --name <项目名>                 可选，不传则根据链接自动推断\n  --target-seconds <秒>           可选，目标总时长（秒），默认 ${defaultTargetDurationSeconds}\n  --account-prompt <txt路径>      账号总提示词路径，默认优先用 examples/account-prompt.txt，也可用环境变量 ACCOUNT_PROMPT_PATH\n  --template <模板路径>           提示词模板路径，默认 examples/project-analysis-to-remotion-json.prompt.txt\n  --snapshot-file <文件路径>      可选，账号历史数据/项目补充信息文件\n  --extra-file <文件路径>         可选，额外要求文件\n  --snapshot <文本>               可选，直接传入账号/项目补充信息\n  --extra <文本>                  可选，直接传入额外要求\n  --output <输出路径>             可选，默认输出到 out/prompts/<项目名>.prompt.txt\n  --print                         同时打印最终提示词到控制台\n`;

const parseArgs = (argv) => {
  const parsed = {
    print: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`无法识别的参数：${token}\n\n${usage}`);
    }

    const key = token.slice(2);
    if (key === 'print') {
      parsed.print = true;
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

const readBuffer = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到文件：${filePath}`);
  }

  return fs.readFileSync(filePath);
};

const scoreDecodedText = (text) => {
  const replacementCount = (text.match(/�/g) ?? []).length;
  const suspiciousCount = (text.match(/[锛銆鈥鏈€缁堣緭鍑]/g) ?? []).length;
  const chineseCount = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const commonCount = (text.match(/[的是了不在这项目输出内容视频账号]/g) ?? []).length;
  return (chineseCount * 2) + (commonCount * 6) - (replacementCount * 40) - (suspiciousCount * 8);
};

const tryDecode = (buffer, encoding) => {
  try {
    const decoder = new TextDecoder(encoding, {fatal: false});
    return decoder.decode(buffer);
  } catch {
    return null;
  }
};

const decodeTextFile = (filePath) => {
  const buffer = readBuffer(filePath);
  const candidates = ['utf-8', 'utf-16le', 'gb18030'];
  let best = '';
  let bestEncoding = 'utf-8';
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const encoding of candidates) {
    const text = tryDecode(buffer, encoding);
    if (text === null) {
      continue;
    }

    const normalized = text.replace(/^\uFEFF/, '');
    const score = scoreDecodedText(normalized);
    if (score > bestScore) {
      best = normalized;
      bestEncoding = encoding;
      bestScore = score;
    }
  }

  if (!best) {
    throw new Error(`无法解码文本文件：${filePath}`);
  }

  return {text: best, encoding: bestEncoding};
};

const deriveProjectName = (projectLink) => {
  try {
    const url = new URL(projectLink);
    const parts = url.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] ?? 'project';
    return last.replace(/\.git$/i, '') || 'project';
  } catch {
    return projectLink
      .split(/[\\/]/)
      .filter(Boolean)
      .pop()
      ?.replace(/\.git$/i, '') || 'project';
  }
};

const sanitizeFileName = (value) => {
  return value
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'project';
};

const resolveAccountPromptPath = (inputPath) => {
  if (typeof inputPath === 'string' && inputPath.trim()) {
    return path.resolve(projectRoot, inputPath.trim());
  }

  for (const candidate of defaultAccountPromptCandidates) {
    const resolved = path.resolve(String(candidate));
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  throw new Error(`找不到账号总提示词文件。请通过 --account-prompt 指定路径，或配置 ACCOUNT_PROMPT_PATH。已尝试：\n${defaultAccountPromptCandidates.map((candidate) => `- ${path.resolve(String(candidate))}`).join('\n')}`);
};

const replaceSection = (template, startMarker, endMarker, replacement) => {
  const start = template.indexOf(startMarker);
  const end = template.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`模板中缺少区块标记：${startMarker} / ${endMarker}`);
  }

  const prefix = template.slice(0, start + startMarker.length);
  const suffix = template.slice(end);
  return `${prefix}\n${replacement.trim()}\n${suffix}`;
};

const optionalText = (inlineText, filePath) => {
  if (typeof inlineText === 'string' && inlineText.trim()) {
    return inlineText.trim();
  }

  if (typeof filePath === 'string' && filePath.trim()) {
    return decodeTextFile(path.resolve(projectRoot, filePath)).text.trim();
  }

  return '留空，若为空请忽略';
};

const parsePositiveInteger = (value, fallback) => {
  const next = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(next)) {
    return fallback;
  }

  return Math.max(1, Math.round(next));
};

try {
  const args = parseArgs(process.argv.slice(2));
  const projectLink = String(args.link ?? '').trim();
  if (!projectLink) {
    throw new Error(`缺少 --link 参数\n\n${usage}`);
  }

  const templatePath = path.resolve(projectRoot, args.template ?? defaultTemplatePath);
  const accountPromptPath = resolveAccountPromptPath(args['account-prompt']);
  const projectName = String(args.name ?? deriveProjectName(projectLink)).trim();
  const outputPath = path.resolve(
    projectRoot,
    args.output ?? path.join(defaultOutputDir, `${sanitizeFileName(projectName)}.prompt.txt`),
  );

  const template = decodeTextFile(templatePath).text;
  const accountPrompt = decodeTextFile(accountPromptPath).text;
  const snapshot = optionalText(args.snapshot, args['snapshot-file']);
  const extra = optionalText(args.extra, args['extra-file']);
  const targetSeconds = parsePositiveInteger(args['target-seconds'], defaultTargetDurationSeconds);

  let finalPrompt = replaceSection(
    template,
    '[ACCOUNT_PROMPT_FULLTEXT_START]',
    '[ACCOUNT_PROMPT_FULLTEXT_END]',
    accountPrompt,
  );

  finalPrompt = finalPrompt
    .replace(/\[PROJECT_NAME\]/g, projectName)
    .replace(/\[PROJECT_LINK\]/g, projectLink)
    .replace(/\[TARGET_DURATION_SEC\]/g, String(targetSeconds))
    .replace(/\[OPTIONAL_ACCOUNT_DATA_SNAPSHOT\]/g, snapshot)
    .replace(/\[OPTIONAL_EXTRA_REQUIREMENTS\]/g, extra);

  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(outputPath, finalPrompt, 'utf-8');

  const result = {
    ok: true,
    projectName,
    projectLink,
    templatePath,
    accountPromptPath,
    outputPath,
  };

  console.log(JSON.stringify(result, null, 2));

  if (args.print) {
    console.log('\n===== FINAL PROMPT =====\n');
    console.log(finalPrompt);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
