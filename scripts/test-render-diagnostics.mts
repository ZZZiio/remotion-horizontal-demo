import {describeRenderSpawnFailure, summarizeRenderFailure, toRenderDiagnosticDetails} from '../editor/render-diagnostics.ts';

const outputPath = 'C:/tmp/render.mp4';

const configFailure = summarizeRenderFailure({
  code: 1,
  stdout: '',
  stderr: '项目 JSON 解析失败：Unexpected token } in JSON at position 12',
  outputPath,
});

if (!configFailure.summary.includes('项目 JSON')) {
  throw new Error(`项目 JSON 错误没有被正确归类: ${JSON.stringify(configFailure)}`);
}

if (!configFailure.resolutionSteps?.some((item) => item.includes('重新导入'))) {
  throw new Error(`项目 JSON 错误没有给出修复步骤: ${JSON.stringify(configFailure)}`);
}

const dependencyFailure = summarizeRenderFailure({
  code: 1,
  stdout: '',
  stderr: "Error: Cannot find module '@remotion/cli'",
  outputPath,
});

if (!dependencyFailure.summary.includes('Remotion 依赖')) {
  throw new Error(`Remotion 依赖缺失没有被正确归类: ${JSON.stringify(dependencyFailure)}`);
}

const assetFailure = summarizeRenderFailure({
  code: 1,
  stdout: '',
  stderr: 'TypeError: Failed to fetch https://example.com/missing.png',
  outputPath,
});

if (!assetFailure.summary.includes('素材资源无法访问')) {
  throw new Error(`素材访问失败没有被正确归类: ${JSON.stringify(assetFailure)}`);
}

const outputMissing = summarizeRenderFailure({
  code: 0,
  stdout: '',
  stderr: '',
  outputPath,
});

if (!outputMissing.phaseText.includes('输出')) {
  throw new Error(`输出缺失没有使用正确阶段文案: ${JSON.stringify(outputMissing)}`);
}

const spawnFailure = describeRenderSpawnFailure(Object.assign(new Error('spawn cmd.exe ENOENT'), {code: 'ENOENT'}));
if (!spawnFailure.summary.includes('Remotion') || !spawnFailure.resolutionSteps?.some((item) => item.includes('npx remotion --version'))) {
  throw new Error(`渲染启动失败没有给出修复步骤: ${JSON.stringify(spawnFailure)}`);
}

const detailLines = toRenderDiagnosticDetails(spawnFailure);
if (!detailLines.some((item) => item.includes('npx remotion --version'))) {
  throw new Error(`渲染诊断细项没有展开修复步骤: ${JSON.stringify(detailLines)}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      configFailure,
      dependencyFailure,
      assetFailure,
      outputMissing,
      spawnFailure,
      detailLines,
    },
    null,
    2,
  ),
);
