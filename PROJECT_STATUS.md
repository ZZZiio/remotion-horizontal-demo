# 项目详细状态

更新时间：2026-03-10
项目路径：`PROJECT_ROOT`

## 1. 项目定位

这是一个围绕 `Remotion + React + Vite + PowerShell/Node` 搭建的“项目链接 -> 提示词 -> JSON -> MP4”的本地生产工具，而不只是一个静态视频模板仓库。

当前已经形成两条主要工作链路：

1. **编辑器链路**
   - 启动本地编辑器
   - 导入 / 修改项目配置
   - 调整文案、镜头、口播、素材
   - 发起渲染 / 查看状态 / 取消 / 重试

2. **傻瓜面板链路**
   - 配置 OpenAI Key
   - 粘贴项目链接或拖入 txt/url 文件
   - 一键生成提示词 / JSON / 视频
   - 管理历史记录与批量队列

## 2. 当前完成度

### 2.1 已完成的核心能力

- 项目分析提示词模板已落地
- 项目分析提示词自动拼装脚本已落地
- OpenAI Responses API 自动生成项目 JSON 已落地
- JSON 结构校验与归一化已落地
- Remotion 按 JSON 渲染 MP4 已落地
- Windows 本地 OpenAI Key 配置已落地
- PowerShell 桌面傻瓜面板已落地
- 一键安装脚本与首启环境检查已落地
- 最近历史记录、队列、自动播放、拖入文件、批量链接导入已落地
- 队列失败策略：失败询问 / 跳过继续 / 失败即停 已落地
- 历史搜索、按时间排序、重新渲染 已落地
- 失败缓存、失败项回填队列、只重跑失败项 已落地
- 历史失败详情弹窗与悬浮提示 已落地
- 渲染状态接口、取消任务、错误摘要与修复建议 已落地
- 简笔动画 `stick-dialogue / stick-conflict / stick-compare / stick-narration` 已接入
- 简笔场景 `stickScene` 导入、编辑、导出、示例 JSON 已落地

### 2.2 已完成的稳定性增强

- `render-account-from-json.mjs` 已修复校验模式清理不完整的问题
- 面板 `Node-Run()` 已保留真实错误明细，不再只显示泛失败
- 编辑器渲染状态轮询已加入短暂抖动重试机制
- OpenAI API 返回非 JSON / 空响应时的诊断已增强
- Vite 本地 API 已增加 JSON 请求体大小限制，避免超大请求拖垮服务
- 提示词总文件路径已改为多候选兜底，不再只依赖单一桌面路径
- 编辑器导入外部 JSON 时，已改为保留原始段落数量，不再强行补齐默认段数
- 简笔动画已增加自动镜头平移/轻推近和更明显的对白气泡表现
- 简笔动画 `beats` 已支持强调线 / 问号 / 感叹号叠加效果，并会参与自动跟焦
- 简笔动画 `enter / exit / nod / turn / shake` 已升级为角色级动作，不再只影响镜头和叠加特效
- 编辑器已新增 `beats` 面板，可直接配置 `turn / nod / shake / enter / exit / question / exclamation`
- 编辑器 `beats` 面板已支持时间轴预设按钮，预览区也已支持可点击的 beat 标记跳帧
- 预览区 beat 标记已支持拖拽改时间，`beats` 面板也已支持按模板自适应预设
- 拖拽 beat 标记时已支持实时帧数 tooltip，`beats` 面板也已支持一键吸附到对白起点

## 3. 当前主要入口

### 3.1 桌面入口

- `PROJECT_ROOT\打开项目视频面板.cmd`
- `PROJECT_ROOT\一键安装项目工具.cmd`
- `PROJECT_ROOT\首启环境检查.cmd`
- 若桌面另有快捷入口，也应指向：
  - `powershell.exe -NoLogo -ExecutionPolicy Bypass -File scripts/project-studio-panel.ps1`

### 3.2 npm 命令入口

- `npm run panel`：打开傻瓜面板
- `npm run editor`：启动编辑器
- `npm run editor:build`：构建编辑器静态产物
- `npm run prompt:account`：生成最终提示词
- `npm run json:account`：生成项目 JSON
- `npm run video:account`：生成项目视频
- `npm run check`：TypeScript 类型检查

### 3.3 一键命令入口

- `PROJECT_ROOT\一键配置OpenAI密钥.cmd`
- `PROJECT_ROOT\一键生成项目提示词.cmd`
- `PROJECT_ROOT\一键生成项目JSON.cmd`
- `PROJECT_ROOT\一键生成项目视频.cmd`
- `PROJECT_ROOT\打开项目视频面板.cmd`
- `PROJECT_ROOT\一键安装项目工具.cmd`
- `PROJECT_ROOT\首启环境检查.cmd`

## 4. 关键文件与职责

### 4.1 生成与渲染链路

- `PROJECT_ROOT\scripts\build-project-analysis-prompt.mjs`
  - 把项目链接、补充信息、账号提示词模板拼成最终提示词
- `PROJECT_ROOT\scripts\build-project-json.mjs`
  - 调用 OpenAI Responses API 生成严格 JSON
- `PROJECT_ROOT\scripts\render-account-from-json.mjs`
  - 校验并归一化 JSON，然后调用 Remotion 渲染 MP4
- `PROJECT_ROOT\scripts\build-project-video.ps1`
  - 串起 JSON 生成与 MP4 渲染

### 4.2 面板链路

- `PROJECT_ROOT\scripts\project-studio-panel.ps1`
  - 桌面级操作面板主文件
  - 包含队列、历史、失败缓存、重跑、失败详情、状态日志等逻辑

### 4.3 编辑器链路

- `PROJECT_ROOT\editor\src\App.tsx`
  - 编辑器主交互逻辑
- `PROJECT_ROOT\editor\vite.config.ts`
  - 本地 API：口播对齐、渲染、取消、打开输出目录、状态查询

### 4.4 模板与示例

- `PROJECT_ROOT\examples\project-analysis-to-remotion-json.prompt.txt`
  - 项目分析 -> Remotion JSON 模板
- `PROJECT_ROOT\examples\stick-animation-demo.json`
  - 6 段完整简笔动画示例，可用于导入、验证与回归测试

## 5. 当前产物与持久化数据

### 5.1 输出目录

- `PROJECT_ROOT\out\prompts`
- `PROJECT_ROOT\out\json`
- `PROJECT_ROOT\out\openai`
- `PROJECT_ROOT\out\videos`

### 5.2 面板数据目录

- `PROJECT_ROOT\out\panel-data\history.json`
- `PROJECT_ROOT\out\panel-data\queue.json`
- `PROJECT_ROOT\out\panel-data\queue-failed.json`

## 6. 验证状态

以下检查已通过：

- `npm run check`
- `npm run editor:build`
- `npm run test:config`
- `npm run test:stick`
- `npm run test:voiceover-match`
- `npm run test:render`
- `npm run test:align`
- `npm run test:render-diagnostics`
- `build-project-analysis-prompt.mjs` smoke check
- `render-account-from-json.mjs` validate 模式清理 smoke check

## 7. 已知约束

### 7.1 外部依赖约束

- OpenAI Key 无效、过期、额度不足时，JSON 生成必然失败
- 网络异常时，OpenAI 生成与外部素材访问都会受影响
- Remotion 渲染依赖本机 Node、`npx`、`@remotion/cli`
- 口播对齐依赖本机 Python 环境与 Whisper 相关依赖

### 7.2 本机环境约束

- 当前工具对 Windows 体验最好，尤其是面板与 `.cmd` 入口
- 若换电脑，需检查：
  - Node.js
  - npm 依赖
  - PowerShell 执行策略
  - OpenAI Key
  - 提示词总文件路径或环境变量

## 8. 当前剩余工作类型

当前剩余事项已不属于“主链路缺失”，更多是以下方向：

- 产品化打磨
  - UI 进一步精致化
  - 更细粒度的错误提示与自修复
- 运维化能力
  - 日志归档
  - 输出目录清理策略
  - 历史记录上限和自动归档
- 交付化能力
  - 打包为更完整的桌面应用
  - 提供标准化安装包或首次启动引导

## 9. 总体判断

截至当前，这个项目已经从“视频模板 demo”升级为“可持续使用的本地内容生产工具”。

它的特点不再只是能渲染视频，而是：

- 能生成提示词
- 能自动出结构化 JSON
- 能从 JSON 直接出 MP4
- 能管理失败、重试、队列、历史与重渲染
- 能对主要错误给出较明确的诊断信息

如果以内部使用或小范围交付来看，已经具备较强实用性。
如果以正式变现产品来看，下一阶段重点不再是“功能有没有”，而是“交付是否更傻瓜、安装是否更顺、首次上手是否更无脑”。

## 10. 2026-03-10 编辑器增量

- Beats 时间轴现支持按住 Shift 拖拽并吸附到 2 / 5 / 10 帧网格，且拖拽 tooltip 会实时显示当前网格。
- 对白面板里的每条 bubble 新增“Generate Beat”快捷按钮，可按语气 / 标点 / emphasis 直接生成对应 beat。
