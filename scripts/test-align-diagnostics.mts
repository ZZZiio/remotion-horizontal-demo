import {describePythonSpawnFailure, summarizeVoiceoverAlignFailure, toVoiceoverErrorPayload} from '../editor/voiceover-align-diagnostics.ts';

const runtime = {
  model: 'large-v3-turbo',
  device: 'cuda',
  computeType: 'float16',
};

const missingDependency = summarizeVoiceoverAlignFailure({
  ...runtime,
  code: 1,
  stdout: '',
  stderr: "ModuleNotFoundError: No module named 'faster_whisper'",
  outputPath: 'C:/tmp/alignment.json',
});

if (missingDependency.missingDependency !== 'faster-whisper') {
  throw new Error(`未识别 faster-whisper 缺失: ${JSON.stringify(missingDependency)}`);
}

if (!missingDependency.suggestion?.includes('pip install faster-whisper ctranslate2')) {
  throw new Error(`缺少 faster-whisper 时建议不够明确: ${JSON.stringify(missingDependency)}`);
}

const modelFailure = summarizeVoiceoverAlignFailure({
  ...runtime,
  code: 1,
  stdout: '',
  stderr: 'RuntimeError: Failed to download model snapshot_download: 401 Client Error: Unauthorized',
  outputPath: 'C:/tmp/alignment.json',
});

if (!modelFailure.details.includes('Whisper 模型') || !modelFailure.suggestion?.includes('Hugging Face')) {
  throw new Error(`模型下载失败没有归类到模型错误: ${JSON.stringify(modelFailure)}`);
}

const driverFailure = summarizeVoiceoverAlignFailure({
  ...runtime,
  code: 1,
  stdout: '',
  stderr: 'RuntimeError: CUDA driver version is insufficient for CUDA runtime version',
  outputPath: 'C:/tmp/alignment.json',
});

if (!driverFailure.details.includes('驱动版本')) {
  throw new Error(`驱动不匹配没有单独归类: ${JSON.stringify(driverFailure)}`);
}

if (!driverFailure.suggestion?.includes('Driver Version') || !driverFailure.suggestion?.includes('torch.version.cuda')) {
  throw new Error(`驱动不匹配没有给出修复步骤: ${JSON.stringify(driverFailure)}`);
}

const oomFailure = summarizeVoiceoverAlignFailure({
  ...runtime,
  code: 1,
  stdout: '',
  stderr: 'RuntimeError: CUDA out of memory. Tried to allocate 2.00 GiB',
  outputPath: 'C:/tmp/alignment.json',
});

if (!oomFailure.details.includes('显存不足') || !oomFailure.suggestion?.includes('结束其他占用 GPU')) {
  throw new Error(`显存不足没有给出针对性修复指引: ${JSON.stringify(oomFailure)}`);
}

const missingRuntimeFailure = summarizeVoiceoverAlignFailure({
  ...runtime,
  code: 1,
  stdout: '',
  stderr: 'Could not load library cudnn_ops_infer64_8.dll. Error code 126',
  outputPath: 'C:/tmp/alignment.json',
});

if (!missingRuntimeFailure.details.includes('CUDA / cuDNN 动态库') || !missingRuntimeFailure.suggestion?.includes('cuDNN')) {
  throw new Error(`缺少 CUDA/cuDNN 运行时没有给出针对性修复指引: ${JSON.stringify(missingRuntimeFailure)}`);
}

const invalidOutput = summarizeVoiceoverAlignFailure({
  ...runtime,
  code: 0,
  stdout: '',
  stderr: '',
  outputPath: 'C:/tmp/alignment.json',
  outputValidationError: '结果文件不是合法 JSON: Unexpected token < in JSON at position 0',
});

if (!invalidOutput.details.includes('结果文件不可用')) {
  throw new Error(`输出 JSON 损坏时提示不明确: ${JSON.stringify(invalidOutput)}`);
}

const spawnFailure = describePythonSpawnFailure(Object.assign(new Error('spawn python ENOENT'), {code: 'ENOENT'}));
if (!spawnFailure.details.includes('Python') || !spawnFailure.suggestion?.includes('python')) {
  throw new Error(`Python 启动失败提示不够明确: ${JSON.stringify(spawnFailure)}`);
}

const payload = toVoiceoverErrorPayload('口播对齐失败', missingDependency);
if (payload.missing_dependency !== 'faster-whisper' || !payload.runtime_hint) {
  throw new Error(`错误响应缺少扩展字段: ${JSON.stringify(payload)}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      missingDependency,
      modelFailure,
      driverFailure,
      oomFailure,
      missingRuntimeFailure,
      invalidOutput,
      spawnFailure,
      payload,
    },
    null,
    2,
  ),
);
