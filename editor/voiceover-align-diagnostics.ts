type VoiceoverAlignRuntime = {
  model: string;
  device: string;
  computeType: string;
};

export type VoiceoverAlignFailureSummary = {
  statusCode: number;
  details: string;
  suggestion?: string;
  runtimeHint?: string;
  missingDependency?: string;
};

type VoiceoverAlignFailureOptions = VoiceoverAlignRuntime & {
  code: number | null;
  stdout: string;
  stderr: string;
  outputPath: string;
  outputValidationError?: string | null;
};

const GPU_CHECK_COMMANDS = [
  '`nvidia-smi`',
  '`python -c "import torch; print(torch.version.cuda, torch.cuda.is_available(), torch.cuda.device_count())"`',
  "`python -c \"import ctranslate2; print(ctranslate2.get_supported_compute_types(\'cuda\'))\"`",
];

const stripAnsi = (value: string) => value.replace(/\x1b\[[0-9;]*m/g, '');

const normalizeText = (value: string) => stripAnsi(value).replace(/\r/g, '');

const compactText = (value: string) => normalizeText(value).trim();

const collectLines = (value: string) =>
  normalizeText(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const trimToLength = (value: string, maxLength = 320) => {
  const normalized = compactText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
};

const joinSentences = (parts: Array<string | undefined>) => parts.filter(Boolean).join('；');

const formatRuntimeHint = (runtime: VoiceoverAlignRuntime, checks?: string[]) =>
  joinSentences([
    `运行参数: model=${runtime.model}, device=${runtime.device}, computeType=${runtime.computeType}`,
    checks?.length ? `核查命令: ${checks.join('；')}` : undefined,
  ]);

const findLastMatchingLine = (lines: string[], pattern: RegExp) => [...lines].reverse().find((line) => pattern.test(line));

const detectMissingDependency = (line: string) => {
  const match = line.match(/No module named ['"]([^'"]+)['"]/i);
  if (!match?.[1]) {
    return undefined;
  }

  const moduleName = match[1];
  if (/^faster_whisper$/i.test(moduleName)) {
    return 'faster-whisper';
  }

  if (/^ctranslate2$/i.test(moduleName)) {
    return 'ctranslate2';
  }

  if (/^torch$/i.test(moduleName)) {
    return 'torch';
  }

  if (/^align_voiceover$/i.test(moduleName)) {
    return 'align_voiceover';
  }

  return moduleName;
};

const getDependencySuggestion = (dependency?: string) => {
  if (!dependency) {
    return '请确认当前 Python 虚拟环境已激活，并且口播对齐依赖已经安装完整。';
  }

  if (dependency === 'faster-whisper') {
    return '请在当前 Python 环境执行 `pip install faster-whisper ctranslate2`，然后重试。';
  }

  if (dependency === 'ctranslate2') {
    return '请在当前 Python 环境执行 `pip install ctranslate2`，并确认安装的是带 CUDA 支持的版本。';
  }

  if (dependency === 'torch') {
    return '请安装与当前 CUDA 驱动匹配的 PyTorch 版本，并确认 `python -c "import torch; print(torch.cuda.is_available())"` 返回 true。';
  }

  if (dependency === 'align_voiceover') {
    return '请检查 `scripts/align_voiceover.py` 是否存在，并确认服务端工作目录仍在项目根目录。';
  }

  return `请确认当前 Python 环境已安装依赖 ${dependency}，并在启动编辑器前激活对应虚拟环境。`;
};

const summarizeGpuFailure = (options: VoiceoverAlignFailureOptions, lines: string[], combinedText: string): VoiceoverAlignFailureSummary | null => {
  const gpuLine =
    findLastMatchingLine(lines, /(cuda|cudnn|cublas|nvidia|gpu|device|torch\.cuda|ctranslate2)/i) ||
    lines[lines.length - 1] ||
    '';
  const runtimeHint = formatRuntimeHint(options, GPU_CHECK_COMMANDS);

  if (/(driver version is insufficient|cuda error 35|unsupported toolchain)/i.test(combinedText)) {
    return {
      statusCode: 500,
      details: `当前 GPU 驱动版本低于 CUDA / PyTorch 运行时要求: ${trimToLength(gpuLine)}`,
      suggestion:
        '步骤 1: 运行 `nvidia-smi` 记录 Driver Version 与 GPU 名称。步骤 2: 升级到与当前 PyTorch / ctranslate2 匹配的 NVIDIA 驱动。步骤 3: 在同一虚拟环境执行 `python -c "import torch; print(torch.version.cuda, torch.cuda.is_available())"` 验证。',
      runtimeHint,
    };
  }

  if (/(found no nvidia driver|no cuda gpus are available|cuda-capable device\(s\) is\/are busy or unavailable|no devices supporting cuda|cuda device count is 0)/i.test(combinedText)) {
    return {
      statusCode: 500,
      details: `当前进程没有拿到可用的 NVIDIA GPU: ${trimToLength(gpuLine)}`,
      suggestion:
        '步骤 1: 运行 `nvidia-smi` 确认系统已识别 GPU。步骤 2: 若命令失败，修复或重装 NVIDIA 驱动后重启。步骤 3: 若在远程桌面、WSL、容器或云主机中运行，确认 GPU 已透传给当前会话。',
      runtimeHint,
    };
  }

  if (/(out of memory|cuda out of memory|cublas_status_alloc_failed|failed to allocate memory)/i.test(combinedText)) {
    return {
      statusCode: 500,
      details: `当前 GPU 显存不足: ${trimToLength(gpuLine)}`,
      suggestion:
        '步骤 1: 运行 `nvidia-smi` 找到占用显存的进程。步骤 2: 结束其他占用 GPU 的推理、训练或渲染任务。步骤 3: 显存释放后重新执行当前口播对齐。',
      runtimeHint,
    };
  }

  if (/(cudnn.*dll|cublas.*dll|cublaslt.*dll|dll load failed|could not load library cudnn|error loading shared library.*cudnn|error loading shared library.*cublas)/i.test(combinedText)) {
    return {
      statusCode: 500,
      details: `当前 Python GPU 运行时缺少 CUDA / cuDNN 动态库: ${trimToLength(gpuLine)}`,
      suggestion:
        '步骤 1: 确认已安装与当前 PyTorch / ctranslate2 对应版本匹配的 CUDA Runtime 与 cuDNN。步骤 2: 检查相关 DLL 或共享库目录是否在 PATH 中。步骤 3: 重新打开终端后执行 torch / ctranslate2 自检命令。',
      runtimeHint,
    };
  }

  if (/(not compiled with cuda support|requested float16 compute type|does not support efficient float16|no kernel image is available|unsupported device function)/i.test(combinedText)) {
    return {
      statusCode: 500,
      details: `当前 GPU 或 CUDA 推理依赖不支持 ${options.computeType} 推理: ${trimToLength(gpuLine)}`,
      suggestion:
        "步骤 1: 执行 `python -c \"import ctranslate2; print(ctranslate2.get_supported_compute_types(\'cuda\'))\"` 查看支持的精度。步骤 2: 确认安装的是带 CUDA 支持的 ctranslate2 / faster-whisper。步骤 3: 检查 GPU 架构与当前 wheel 是否兼容。",
      runtimeHint,
    };
  }

  if (/(cuda|cudnn|cublas|nvidia|gpu|torch\.cuda|ctranslate2)/i.test(combinedText)) {
    return {
      statusCode: 500,
      details: `GPU 运行时初始化失败: ${trimToLength(gpuLine)}`,
      suggestion:
        '请按顺序检查 NVIDIA 驱动、CUDA Runtime、cuDNN、PyTorch、ctranslate2 是否版本匹配，并确认 `nvidia-smi` 与 torch / ctranslate2 自检命令全部通过。',
      runtimeHint,
    };
  }

  return null;
};

export const summarizeVoiceoverAlignFailure = (options: VoiceoverAlignFailureOptions): VoiceoverAlignFailureSummary => {
  if (options.outputValidationError) {
    return {
      statusCode: 500,
      details: `口播对齐脚本已结束，但结果文件不可用: ${trimToLength(options.outputValidationError)}`,
      runtimeHint: formatRuntimeHint(options),
    };
  }

  if (options.code === 0) {
    return {
      statusCode: 500,
      details: `口播对齐脚本已结束，但未找到结果文件: ${options.outputPath}`,
      runtimeHint: formatRuntimeHint(options),
    };
  }

  const lines = collectLines(`${options.stderr}\n${options.stdout}`);
  const combinedText = lines.join('\n').toLowerCase();

  const importFailureLine = findLastMatchingLine(lines, /(ModuleNotFoundError|ImportError|No module named|DLL load failed)/i);
  if (importFailureLine) {
    const missingDependency = detectMissingDependency(importFailureLine);
    return {
      statusCode: 500,
      details: missingDependency
        ? `当前 Python 环境缺少 ${missingDependency} 依赖: ${trimToLength(importFailureLine)}`
        : `Python 依赖导入失败: ${trimToLength(importFailureLine)}`,
      suggestion: getDependencySuggestion(missingDependency),
      runtimeHint: formatRuntimeHint(options),
      missingDependency,
    };
  }

  const gpuFailure = summarizeGpuFailure(options, lines, combinedText);
  if (gpuFailure) {
    return gpuFailure;
  }

  const modelFailureLine = findLastMatchingLine(
    lines,
    /(huggingface|hf_hub|snapshot_download|download.*failed|failed to download|repository not found|401 client error|403 client error|connection.*error|timed out|timeout|model .* not found|unknown model|invalid model)/i,
  );
  if (modelFailureLine) {
    return {
      statusCode: 500,
      details: `Whisper 模型 ${options.model} 加载失败: ${trimToLength(modelFailureLine)}`,
      suggestion: '请确认模型名可用、网络可访问 Hugging Face，或先在本机缓存模型后再重试。',
      runtimeHint: formatRuntimeHint(options),
    };
  }

  const audioFailureLine = findLastMatchingLine(
    lines,
    /(invalid data found when processing input|error opening input|could not find codec parameters|moov atom not found|failed to read|unsupported format|no audio stream)/i,
  );
  if (audioFailureLine) {
    return {
      statusCode: 500,
      details: `音频文件不可读或格式不受支持: ${trimToLength(audioFailureLine)}`,
      suggestion: '请确认上传的是有效音频文件，并优先尝试 `wav`、`mp3` 或 `m4a`。',
      runtimeHint: formatRuntimeHint(options),
    };
  }

  const permissionFailureLine = findLastMatchingLine(lines, /(permission denied|eacces)/i);
  if (permissionFailureLine) {
    return {
      statusCode: 500,
      details: `口播对齐进程缺少文件访问权限: ${trimToLength(permissionFailureLine)}`,
      suggestion: '请检查项目目录、临时目录和 Python 环境是否具备可读写权限。',
      runtimeHint: formatRuntimeHint(options),
    };
  }

  const diagnosticLine = findLastMatchingLine(
    lines,
    /(failed|error|exception|not found|enoent|eacces|invalid|cannot|can't|missing|unsupported|timeout|timed out)/i,
  );
  if (diagnosticLine) {
    return {
      statusCode: 500,
      details: trimToLength(diagnosticLine),
      runtimeHint: formatRuntimeHint(options),
    };
  }

  const fallbackLine = [...lines].reverse().find((line) => !/^at\s+/i.test(line));
  return {
    statusCode: 500,
    details: fallbackLine ? trimToLength(fallbackLine) : `口播对齐进程异常结束 (退出码 ${options.code ?? 'unknown'})`,
    runtimeHint: formatRuntimeHint(options),
  };
};

export const describePythonSpawnFailure = (error: NodeJS.ErrnoException | Error): VoiceoverAlignFailureSummary => {
  const message = error.message || 'Python 进程启动失败';
  const errorCode = 'code' in error ? error.code : undefined;

  if (errorCode === 'ENOENT') {
    return {
      statusCode: 500,
      details: `无法启动 Python: ${message}`,
      suggestion: '请确认 `python` 命令已加入 PATH，或先激活虚拟环境后再启动编辑器。',
      runtimeHint: '服务端当前通过 `python` 命令启动口播对齐脚本。',
    };
  }

  if (errorCode === 'EACCES') {
    return {
      statusCode: 500,
      details: `没有权限启动 Python: ${message}`,
      suggestion: '请检查 Python 可执行文件和项目目录权限，必要时改用管理员终端。',
    };
  }

  return {
    statusCode: 500,
    details: trimToLength(message),
  };
};

export const toVoiceoverErrorPayload = (error: string, summary: VoiceoverAlignFailureSummary) => ({
  error,
  details: summary.details,
  ...(summary.suggestion ? {suggestion: summary.suggestion} : {}),
  ...(summary.runtimeHint ? {runtime_hint: summary.runtimeHint} : {}),
  ...(summary.missingDependency ? {missing_dependency: summary.missingDependency} : {}),
});
