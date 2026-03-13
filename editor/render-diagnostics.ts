export type RenderFailureSummary = {
  summary: string;
  phaseText: string;
  resolutionSteps?: string[];
  runtimeHint?: string;
};

type RenderFailureOptions = {
  code: number | null;
  stdout: string;
  stderr: string;
  outputPath: string;
};

const stripAnsi = (value: string) => value.replace(/\x1b\[[0-9;]*m/g, '');

const normalizeText = (value: string) => stripAnsi(value).replace(/\r/g, '');

const collectLines = (value: string) =>
  normalizeText(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const trimLine = (value: string, maxLength = 320) => {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
};

const compactDetails = (details: Array<string | undefined>) => Array.from(new Set(details.filter((item): item is string => Boolean(item))));

const buildRuntimeHint = (outputPath: string, extra?: string) =>
  compactDetails([extra, `输出路径: ${outputPath}`]).join('；');

const findLastMatchingLine = (lines: string[], pattern: RegExp) => [...lines].reverse().find((line) => pattern.test(line));

const createSummary = (
  summary: string,
  phaseText: string,
  options: {outputPath: string; steps?: string[]; runtimeHint?: string},
): RenderFailureSummary => ({
  summary,
  phaseText,
  resolutionSteps: options.steps ? compactDetails(options.steps) : undefined,
  runtimeHint: buildRuntimeHint(options.outputPath, options.runtimeHint),
});

export const toRenderDiagnosticDetails = (summary: RenderFailureSummary) =>
  compactDetails([
    ...(summary.resolutionSteps || []),
    summary.runtimeHint ? `诊断: ${summary.runtimeHint}` : undefined,
  ]);

export const summarizeRenderFailure = (options: RenderFailureOptions): RenderFailureSummary => {
  const lines = collectLines(`${options.stderr}\n${options.stdout}`);
  const combinedText = lines.join('\n').toLowerCase();
  const diagnosticLine = trimLine(findLastMatchingLine(lines, /(failed|error|exception|not found|enoent|eacces|invalid|cannot|can't|missing|timeout|timed out)/i) || lines[lines.length - 1] || '');

  if (/(listen\s+eacces|permission denied.*:::\d+)/i.test(combinedText)) {
    return createSummary('渲染端口被系统阻止，Remotion 无法启动本地服务。', '端口权限', {
      outputPath: options.outputPath,
      steps: [
        '请关闭占用端口的程序（或重启电脑后重试）。',
        '如仍失败，尝试以管理员权限启动面板/终端。',
        '如被安全软件拦截，请将 Node.js/Remotion 加入白名单。',
      ],
      runtimeHint: diagnosticLine,
    });
  }

  if (options.code === 0 && !options.outputPath) {
    return createSummary('渲染命令已结束，但输出路径为空。', '输出缺失', {
      outputPath: options.outputPath,
      steps: ['请重新发起一次导出任务。', '如果问题重复出现，请检查服务端是否正确生成输出文件名。'],
    });
  }

  if (options.code === 0) {
    return createSummary(`渲染命令已结束，但未找到输出文件。`, '输出缺失', {
      outputPath: options.outputPath,
      steps: ['请检查 `out` 目录是否存在以及是否可写。', '请确认磁盘空间充足，然后重新发起导出。', '如果仍失败，请查看服务端控制台末尾日志。'],
      runtimeHint: diagnosticLine,
    });
  }

  if (/项目 json 解析失败|project json parse failed/i.test(combinedText)) {
    return createSummary('项目 JSON 无法解析，渲染任务没有启动。', '配置异常', {
      outputPath: options.outputPath,
      steps: ['请重新导入或重新导出项目 JSON。', '请重点检查 JSON 末尾逗号、引号和括号是否完整。', '如果是手工修改过 JSON，请先在编辑器里重新保存一次项目。'],
      runtimeHint: diagnosticLine,
    });
  }

  if (/项目配置归一化失败|normalize project failed/i.test(combinedText)) {
    return createSummary('项目配置不符合渲染要求。', '配置异常', {
      outputPath: options.outputPath,
      steps: ['请检查 `meta`、`theme`、`segments` 是否存在且结构正确。', '请重点检查段落时长、素材地址和标题字段是否为合法值。', '如来自外部导入，请先在编辑器里重新保存后再导出。'],
      runtimeHint: diagnosticLine,
    });
  }

  if (/创建输出目录失败|mkdir|eacces|permission denied/i.test(combinedText)) {
    return createSummary('输出目录不可写，视频无法落盘。', '目录权限', {
      outputPath: options.outputPath,
      steps: ['请确认 `out` 目录存在且当前用户有写权限。', '请关闭正在占用目标文件的播放器或剪辑软件。', '必要时改用管理员终端重新启动编辑器。'],
      runtimeHint: diagnosticLine,
    });
  }

  if (/cannot find module|module not found|remotion.*not found|npx: command not found/i.test(combinedText)) {
    return createSummary('本地 Remotion 依赖不可用，渲染命令未正确执行。', '依赖缺失', {
      outputPath: options.outputPath,
      steps: ['请先执行 `npm install`，确认依赖安装完整。', '请执行 `npx remotion --version`，确认 Remotion CLI 可以启动。', '如果刚切换 Node 版本，请删除 `node_modules` 后重新安装。'],
      runtimeHint: diagnosticLine,
    });
  }

  if (/composition.*not found|no composition found|accountdeeptemplate/i.test(combinedText)) {
    return createSummary('找不到目标 Remotion composition。', '入口异常', {
      outputPath: options.outputPath,
      steps: ['请检查 `src/index.ts` 是否仍注册了 `AccountDeepTemplate`。', '请确认 composition ID 没有被改名。', '如果最近改过模板入口，重新启动编辑器后再试。'],
      runtimeHint: diagnosticLine,
    });
  }

  if (/failed to fetch|err_invalid_url|unsupported url|econnrefused|enotfound|getaddrinfo|404|网络/i.test(combinedText)) {
    return createSummary('渲染时有素材资源无法访问。', '素材异常', {
      outputPath: options.outputPath,
      steps: ['请检查图片/视频 URL 是否仍可访问。', '请确认本地素材路径存在，且不要保留失效的 `blob:` 地址。', '请在编辑器里重新导入损坏素材后再发起导出。'],
      runtimeHint: diagnosticLine,
    });
  }

  if (/ffmpeg|codec|encode|mux|could not write header/i.test(combinedText)) {
    return createSummary('编码阶段失败，视频未能正确封装。', '编码失败', {
      outputPath: options.outputPath,
      steps: ['请确认磁盘空间充足，并关闭占用输出文件的程序。', '请重新执行一次导出，观察是否稳定复现。', '如果持续失败，请保留控制台末尾日志以便继续定位编码问题。'],
      runtimeHint: diagnosticLine,
    });
  }

  if (/rendered|render.*exit code|渲染命令退出码/i.test(combinedText)) {
    return createSummary('Remotion 渲染命令异常退出。', '渲染失败', {
      outputPath: options.outputPath,
      steps: ['请先查看任务卡片中的诊断信息与服务端控制台末尾日志。', '请检查最近修改过的素材、字幕和单段时长是否异常。', '如果问题持续，请重试一次并保留最新报错。'],
      runtimeHint: diagnosticLine,
    });
  }

  return createSummary(diagnosticLine || `渲染进程异常结束 (退出码 ${options.code ?? 'unknown'})`, '渲染失败', {
    outputPath: options.outputPath,
    steps: ['请查看服务端控制台末尾日志。', '请确认最近修改的项目配置和素材都有效。', '必要时重新发起导出并对比两次报错是否一致。'],
    runtimeHint: diagnosticLine,
  });
};

export const describeRenderSpawnFailure = (error: NodeJS.ErrnoException | Error): RenderFailureSummary => {
  const message = error.message || '渲染进程启动失败';
  const errorCode = 'code' in error ? error.code : undefined;

  if (errorCode === 'ENOENT') {
    return {
      summary: `无法启动 Remotion 渲染命令: ${message}`,
      phaseText: '启动失败',
      resolutionSteps: [
        '请确认 Node.js 已安装并可在终端执行。',
        '请执行 `npm install`，然后用 `npx remotion --version` 验证 CLI 可用。',
        '如果编辑器不是从项目根目录启动，请回到项目根目录重新启动。',
      ],
      runtimeHint: '启动命令依赖本地 Node.js、npx 和 Remotion CLI。',
    };
  }

  if (errorCode === 'EACCES') {
    return {
      summary: `没有权限启动 Remotion 渲染命令: ${message}`,
      phaseText: '权限不足',
      resolutionSteps: [
        '请检查 Node.js、项目目录和输出目录是否允许当前用户执行与写入。',
        '请关闭可能锁住输出文件的播放器、剪辑软件或同步盘客户端。',
        '必要时改用管理员终端重新启动编辑器。',
      ],
      runtimeHint: '当前系统拒绝了渲染命令的启动或文件访问。',
    };
  }

  return {
    summary: trimLine(message),
    phaseText: '启动失败',
    resolutionSteps: ['请先检查服务端控制台日志，并确认 Node.js / Remotion 运行环境完整。'],
  };
};
