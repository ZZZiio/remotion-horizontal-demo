# Remotion 项目视频工具使用说明

![license](https://img.shields.io/badge/license-MIT-blue)
![platform](https://img.shields.io/badge/platform-Windows-0078D6)
![remotion](https://img.shields.io/badge/Remotion-4.x-ff2d20)
![repo](https://img.shields.io/badge/repo-ZZZiio%2Fremotion--horizontal--demo-0b4b8a)

项目路径：`PROJECT_ROOT`  
英文版：`README_EN.md`

快速入口：
- 演示视频：<填写你的视频外链>
- 快速上手：见「最简单工作流」
- 常见问题：见「FAQ（简版）」

说明：文档中的绝对路径仅为示例，请替换为你本机的项目根目录。 
这是一个 AI 驱动的自动化短视频生成工作流 Demo，可将“项目链接 / 项目分析”转为 `Remotion JSON` 并渲染 `MP4`。  
功能包含：模板与主题色自动匹配、火柴人动画/图片/视频可视化区域生成、口播音频对齐字幕与动画、自动镜头与动画编排。 
本项目为原型演示，可能存在 bug，作者不提供维护与答疑。  
欢迎 fork / 修改 / PR，共同优化。作者：Oxecho。仅限学习与非商业用途使用。 

## 技术栈

- Remotion
- React
- TypeScript
- Vite
- Node.js
- PowerShell（Windows 脚本）
- Python（口播对齐）
- OpenAI API（可选）


这是一个用于把“项目链接 / 项目分析”转成 `Remotion JSON` 并最终渲染为 `MP4` 的本地工具仓库。

## 演示视频

- <填写你的视频外链>

## 截图

在仓库中放 2-3 张关键界面截图，然后替换下面占位：

![Panel Screenshot](docs/screenshots/panel.png)
![Editor Screenshot](docs/screenshots/editor.png)

## 1. 适合谁用

适合以下场景：

- 做 AI 项目拆解视频
- 做产品演示视频
- 做口播 + 图文动画结合的视频
- 需要把“链接分析 -> 结构化脚本 -> 视频”做成固定工作流的人

## 2. 你最常用的三种打开方式

### 方式 A：最推荐，先安装后直接开傻瓜面板

双击：

- `PROJECT_ROOT\打开项目视频面板.cmd`

或执行：

```bash
npm run panel
```

适合：

- 不想碰命令行
- 想直接粘贴链接、跑队列、看历史、重试失败项

### 方式 B：打开编辑器

```bash
npm run editor
```

适合：

- 手动修改文案、镜头、时长、素材、口播
- 查看渲染任务状态
- 导出整条视频或单段视频

### 方式 C：命令行跑单次任务

```bash
npm run prompt:account
npm run json:account
npm run video:account
```

适合：

- 批处理
- 调试脚本
- 高级用户手动控制流程

## 3. 首次使用前必须做的事

### 3.1 最省事安装方式

双击：

- `PROJECT_ROOT\一键安装项目工具.cmd`

或手工执行：

```bash
npm install
```

如需手工检查环境，可双击：

- `PROJECT_ROOT\首启环境检查.cmd`

### 3.2 配置 OpenAI Key（可选）

你可以使用以下任意方式：

#### 方式 1：一键配置

双击：

- `PROJECT_ROOT\一键配置OpenAI密钥.cmd`

#### 方式 2：面板中配置

打开面板后，在顶部 OpenAI 配置区填写：

- `OPENAI_API_KEY`
- `OPENAI_MODEL`（默认可用 `gpt-5`）

保存后会写入项目本地：

- `PROJECT_ROOT\.env.local`

#### 方式 3：手工写入 `.env.local`

示例：

```env
OPENAI_API_KEY=你的key
OPENAI_MODEL=gpt-5
```

> 说明：如果你只想“生成提示词 -> 粘贴到聊天框 -> 拿到 JSON -> 回来渲染/编辑”，不需要配置 OpenAI Key。

## 4. 最简单工作流

### 4.1 从链接直接生成视频

1. 打开面板
2. 粘贴项目链接
3. 选择 `目标时长`（60 秒 / 300 秒）
4. 必要时填写项目名和补充要求
5. 点击 `一键生成视频`
6. 等待生成 JSON 和 MP4
7. 自动打开输出目录，必要时自动播放视频

### 4.2 只生成提示词

双击：

- `PROJECT_ROOT\一键生成项目提示词.cmd`
- `PROJECT_ROOT\一键生成项目提示词-5分钟.cmd`（目标约 5 分钟）

或执行：

```bash
npm run prompt:account -- --link <项目链接> --name <项目名>
```

输出目录：

- `PROJECT_ROOT\out\prompts`

### 4.2.1 无 OpenAI Key 的工作流（推荐给手动聊天生成 JSON）

1. 复制 GitHub 链接
2. 双击 `PROJECT_ROOT\一键生成项目提示词.cmd`（提示词会复制到剪贴板）
3. 把提示词粘贴到 ChatGPT / 任何支持联网阅读的模型对话框，让它“最终只输出 JSON”
4. 把模型输出的 JSON 粘回编辑器右侧“粘贴完整提示词输出或纯 JSON”，点 `仅按 JSON 导入`
5. 在编辑器里 `一键导出整条 MP4` 或 `导出当前段 MP4`

### 4.3 只生成 JSON

双击：

- `PROJECT_ROOT\一键生成项目JSON.cmd`
- `PROJECT_ROOT\一键生成项目JSON-5分钟.cmd`（目标约 5 分钟）

或执行：

```bash
npm run json:account -- --link <项目链接> --name <项目名>
```

> 说明：如果未配置 OpenAI Key，上面两个脚本会自动退化为“只生成提示词并复制到剪贴板”。

输出目录：

- `PROJECT_ROOT\out\json`
- `PROJECT_ROOT\out\openai`

### 4.4 从 JSON 直接渲染 MP4

```bash
node scripts/render-account-from-json.mjs out/json/你的项目.json out/videos/你的项目.mp4
```

### 4.4.1 分段渲染（加速导出）

当你只改了某些段落时，可以启用分段渲染：仅重渲染变动段落，再拼接成完整 MP4。

```powershell
$env:RENDER_SEGMENTS=1
node scripts/render-account-segments.mjs out/json/你的项目.json out/videos/你的项目.mp4
```

也可以在一键脚本里启用分段渲染：

```powershell
$env:RENDER_SEGMENTS=1
powershell.exe -NoLogo -ExecutionPolicy Bypass -File scripts/build-project-video.ps1 -OpenFolder
```

### 4.5 简笔动画模板示例

现在项目已支持 4 类简笔人物场景：

- `stick-dialogue`
- `stick-conflict`
- `stick-compare`
- `stick-narration`

完整示例 JSON：

- `PROJECT_ROOT\examples\stick-animation-demo.json`

用于验证示例与导入/导出链路的命令：

```bash
npm run test:stick
```

## 5. 面板详细用法

主文件：

- `PROJECT_ROOT\scripts\project-studio-panel.ps1`

### 5.1 当前项目区

这里可以填写：

- 项目链接
- 项目名
- 额外要求

支持：

- 从剪贴板粘贴
- 拖入 `.txt` / `.md` / `.url` 文件
- 拖入包含链接的文本

### 5.2 当前项目动作区

常用按钮：

- `生成最终提示词`
- `生成项目 JSON`
- `一键生成视频`
- `加入批量队列`
- `提示词目录`
- `JSON 目录`
- `视频目录`
- `刷新状态`

### 5.3 队列区

支持：

- 批量导入链接
- 执行全部队列
- 失败项回填
- 只重跑失败项
- 失败策略切换：
  - `失败时询问`
  - `失败跳过继续`
  - `失败即停`

### 5.4 历史区

支持：

- 搜索
- 按时间排序
- 筛选：
  - `全部`
  - `仅看有视频`
  - `仅看失败项`
- 载入当前
- 重新渲染
- 查看失败详情
- 打开历史视频

## 6. 编辑器详细用法

启动：

```bash
npm run editor
```

### 6.1 编辑器能做什么

- 导入项目 JSON
- 根据提示词结果自动生成项目配置
- 修改项目基础信息
- 调整分镜段落
- 导入口播素材
- 匹配批量口播
- 对齐口播节奏
- 导出整条视频
- 导出当前单段
- 取消渲染任务
- 打开输出目录

### 6.2 导入方式

支持两种主方式：

- 粘贴纯 JSON 后导入
- 粘贴完整提示词输出后自动识别 JSON 代码块并导入

## 7. 目录说明

### 7.1 重要脚本

- `PROJECT_ROOT\scripts\build-project-analysis-prompt.mjs`
- `PROJECT_ROOT\scripts\build-project-json.mjs`
- `PROJECT_ROOT\scripts\render-account-from-json.mjs`
- `PROJECT_ROOT\scripts\build-project-video.ps1`
- `PROJECT_ROOT\scripts\project-studio-panel.ps1`

### 7.2 输出目录

- `PROJECT_ROOT\out\prompts`
- `PROJECT_ROOT\out\json`
- `PROJECT_ROOT\out\openai`
- `PROJECT_ROOT\out\videos`
- `PROJECT_ROOT\out\panel-data`

## 8. FAQ（简版）

### 8.1 提示缺少 `OPENAI_API_KEY`
未配置 key 或当前进程读不到 `.env.local`，用面板重新保存一次。 




### 8.2 OpenAI 返回 401
key 无效/过期/权限不对或类型不匹配。 


### 8.3 生成 JSON 失败
常见原因：网络异常、响应非 JSON、提示词文件缺失。 



### 8.4 渲染 MP4 失败
常见原因：未 `npm install`、`@remotion/cli` 不可用、输出目录不可写、素材 URL 失效。 






## 9. 推荐验证命令

如果你想确认项目当前是否正常：

```bash
npm run check
npm run editor:build
npm run test:config
npm run test:stick
npm run test:render
npm run test:render-diagnostics
```

## 10. 维护建议

- 不要手工删除 `out/panel-data`，除非你明确知道会清掉历史和失败缓存
- 不要随意修改脚本 stdout 输出格式，否则上游脚本可能无法解析
- 如果换电脑，优先检查：
  - Node.js
  - npm install
  - `.env.local`
  - 提示词总文件路径
- 若要交付给他人，建议同时交付：
  - 本 README
  - `PROJECT_STATUS.md`
  - `打开项目视频面板.cmd`

## 11. 发布到 GitHub（新手步骤）

1. 清理生成物（本仓库根目录执行）：
```powershell
Remove-Item -Recurse -Force node_modules, out, output, .tmp, tmp, .playwright-cli, .factory, editor\dist, scripts\__pycache__ -ErrorAction SilentlyContinue
```
2. 初始化并检查：
```powershell
git init
git add -A
git status
```
确保没有 `.env.local`、`out/`、`node_modules/` 等被加入。 
3. 提交：
```powershell
git commit -m "Initial open-source release"
```
4. 在 GitHub 新建 Public 仓库（不要勾选自动生成 README/License）。 
5. 关联远程并推送：
```powershell
git branch -M main
git remote add origin https://github.com/<你的账号>/<仓库名>.git
git push -u origin main
```

## 12. 当前推荐使用结论

如果你只是要稳定地“复制链接 -> 出 JSON -> 渲视频”，优先用面板。

如果你要深度改内容、分镜、口播、单段导出，优先用编辑器。

如果你要做自动化或调试，使用 npm 命令和 `scripts/` 脚本。
