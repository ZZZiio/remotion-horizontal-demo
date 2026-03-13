# Remotion 项目视频工具 Demo

![license](https://img.shields.io/badge/license-Non--Commercial-red)
![platform](https://img.shields.io/badge/platform-Windows-0078D6)
![remotion](https://img.shields.io/badge/Remotion-4.x-ff2d20)

英文版：`README_EN.md`

这是一个 AI 驱动的自动化短视频工作流 Demo：把“项目链接 / 项目分析”转为 `Remotion JSON` 并渲染 `MP4`。  
功能包含：模板与主题色自动匹配、火柴人动画/图片/视频可视化区域生成、口播音频对齐字幕与动画、自动镜头与动画编排。  
本项目为原型演示，可能存在 bug，不提供维护与答疑。  
仅限学习与非商业用途使用，商用需获得作者许可。 

## 快速开始

1. 安装依赖：
```bash
npm install
```
2. 启动面板（推荐）或编辑器：
```bash
npm run panel
# 或
npm run editor
```
3. 如需调用模型，配置 `.env.local`：
```env
OPENAI_API_KEY=你的key
OPENAI_MODEL=gpt-5
```
4. 命令行一键流程：
```bash
npm run prompt:account
npm run json:account
npm run video:account
```

## FAQ（简版）

**缺少 `OPENAI_API_KEY`**  
说明未配置 key 或当前进程读不到 `.env.local`。可直接走“只生成提示词”的流程。 

**生成 JSON 失败**  
常见原因：网络异常、响应非 JSON、提示词文件缺失。 

**渲染 MP4 失败**  
常见原因：未 `npm install`、`@remotion/cli` 不可用、输出目录不可写、素材 URL 失效。 

## 技术栈

- Remotion
- React
- TypeScript
- Vite
- Node.js
- PowerShell（Windows 脚本）
- Python（口播对齐）
- OpenAI API（可选）

## 许可

非商业许可（Non-Commercial License）
