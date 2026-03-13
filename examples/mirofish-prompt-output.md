一、项目定位判断

- 主类型：黑科技揭秘
- 次类型：开源科普
- 适合做“讲清楚 + 值得转发收藏”的认知升级型项目

二、这个选题适不适合我这个账号做

- 适合
- 原因：项目具体、卖点强、门槛明显，适合你做“翻译成人话 + 别吹太满”的内容

三、视频信息

- 项目：`666ghj/MiroFish`
- GitHub 星标：约 5.7k+

……（中间可读内容省略，真实使用时这里会是模型完整输出）

二十、视频动画工程配置（JSON）

```json
{
  "meta": {
    "project_name": "MiroFish",
    "account_positioning": "AI开源项目翻译官 / 避坑拆解号",
    "width": 1920,
    "height": 1080,
    "fps": 30
  },
  "theme": {
    "accent_color": "#42E8D4",
    "secondary_color": "#6CAEFF",
    "visual_style": "黑科技揭秘 + 开源科普",
    "title_style": "问题型 + 看懂型"
  },
  "cover": {
    "main_title": "AI开始预演未来？",
    "sub_title": "MiroFish 更像预测沙盘，不是普通聊天 AI",
    "left_tag": "GitHub 热门项目",
    "right_tag": "帮普通人看懂项目",
    "bottom_conclusion": "值得关注，但别吹成万能预测器"
  },
  "navigation": {
    "items": ["开场", "引言", "能力", "场景", "门槛", "判断", "结语"]
  },
  "segments": [
    {
      "id": "hook",
      "name": "Hook",
      "duration_sec": 3,
      "layout": "hero",
      "motion_preset": "lift",
      "visual_preset": "orb",
      "title": "AI开始预演未来？",
      "subtitle": "它不是普通聊天 AI，它想先把未来放进数字沙盘里演一遍",
      "bottom_conclusion": "先抓兴趣，再给判断",
      "voiceover_text": "如果一个开源项目，想先把未来在数字沙盘里演一遍，它到底是在画饼，还是在打开下一代预测工具？",
      "human_conclusion": "先让观众意识到这不是普通 AI 工具。",
      "points": ["不是聊天 AI", "而是预测沙盘"],
      "media_label": "数字沙盘主视觉",
      "media_type": "generated_image",
      "media_prompt": "futuristic digital sandbox, simulation globe, multi-agent world, blue black tech style, cold white text area, 6:5 horizontal",
      "needs_github_evidence": true,
      "evidence_text": "项目定位来自官方 README"
    },
    {
      "id": "p1",
      "name": "引言P1",
      "duration_sec": 47,
      "layout": "hero",
      "motion_preset": "lift",
      "visual_preset": "orb",
      "title": "它到底是什么？",
      "subtitle": "官方叫群体智能预测引擎，人话就是先把现实问题丢进数字世界里演一遍",
      "bottom_conclusion": "先解释，再拉兴趣",
      "voiceover_text": "MiroFish 官方把自己定义成群体智能预测引擎。翻译成人话，就是你把现实问题丢进去，它先搭一个数字世界，再让里面的角色和关系开始演化。",
      "human_conclusion": "它想做的，是先把现实问题放进 AI 沙盘里推演一次。",
      "points": ["官方说法", "人话翻译", "一句话理解"],
      "media_label": "项目主视觉 + README 截图",
      "media_type": "mixed",
      "media_prompt": "project hero image, digital sandbox world, clean blue tech editorial layout, 6:5 horizontal",
      "needs_github_evidence": true,
      "evidence_text": "GitHub README 项目简介"
    },
    {
      "id": "p2",
      "name": "P2",
      "duration_sec": 55,
      "layout": "concept",
      "motion_preset": "spotlight",
      "visual_preset": "nodes",
      "title": "它不是先回答，而是先模拟",
      "subtitle": "核心区别不是会不会答，而是它先搭环境、搭关系、搭记忆，再开始推演",
      "bottom_conclusion": "先搭世界，再做判断",
      "voiceover_text": "它和普通问答工具最大的区别，是它不会一上来就给你一个答案，而是先搭图谱、搭环境、搭关系、搭记忆，然后再开始模拟。",
      "human_conclusion": "它的路子更像数字沙盘，不像聊天机器人。",
      "points": ["搭图谱", "搭环境", "跑推演"],
      "media_label": "节点关系图 / 工作流结构",
      "media_type": "mixed",
      "media_prompt": "multi-agent graph, relationship nodes, futuristic dashboard, blue black interface, 6:5 horizontal",
      "needs_github_evidence": true,
      "evidence_text": "工作流与结构图来自官方 README"
    },
    {
      "id": "p3",
      "name": "P3",
      "duration_sec": 65,
      "layout": "dashboard",
      "motion_preset": "stagger",
      "visual_preset": "dashboard",
      "title": "它能干嘛，案例才是重点",
      "subtitle": "官方公开信息里，既有舆情推演，也有《红楼梦》结局推演",
      "bottom_conclusion": "案例负责留人",
      "voiceover_text": "这个项目最容易讲清楚的，不是抽象原理，而是案例。官方已经展示了舆情推演，也展示了《红楼梦》失传结局这种叙事世界推演。",
      "human_conclusion": "它既想做现实预测，也想做故事推演。",
      "points": ["舆情推演", "策略沙盘", "叙事世界模拟"],
      "media_label": "多卡片案例板",
      "media_type": "mixed",
      "media_prompt": "case study dashboard, public opinion simulation, story world prediction cards, blue interface, 6:5 horizontal",
      "needs_github_evidence": true,
      "evidence_text": "官方 Demo 与 README 示例"
    },
    {
      "id": "p4",
      "name": "P4",
      "duration_sec": 62,
      "layout": "phone",
      "motion_preset": "stagger",
      "visual_preset": "phone",
      "title": "门槛要讲透，不然信任立不住",
      "subtitle": "这类项目很容易被吹过头，但真正有价值的是把门槛讲明白",
      "bottom_conclusion": "门槛是信任来源",
      "voiceover_text": "它需要 Node、Python、API Key 甚至额外服务支持，而且官方也提醒模拟成本不低。所以这类项目一定要讲清楚，不是每个人今天都能无脑上手。",
      "human_conclusion": "很酷，但不是零门槛神器。",
      "points": ["依赖要求", "适合谁", "别吹太满"],
      "media_label": "信息清单 + 问答卡片",
      "media_type": "mixed",
      "media_prompt": "requirements panel, info cards, warning notes, dark clean tech ui, 6:5 horizontal",
      "needs_github_evidence": true,
      "evidence_text": "环境依赖与限制来自官方文档"
    },
    {
      "id": "p5",
      "name": "P5",
      "duration_sec": 54,
      "layout": "dashboard",
      "motion_preset": "calm",
      "visual_preset": "dashboard",
      "title": "值不值得关注，必须给判断",
      "subtitle": "不要只讲功能，要明确告诉观众值不值得看、适不适合现在上手",
      "bottom_conclusion": "明确判断，减少犹豫",
      "voiceover_text": "我的结论很简单：这个项目值得关注，值得收藏，值得持续跟踪，但不值得被吹成万能预测器。",
      "human_conclusion": "值得关注，但别神化。",
      "points": ["值得看", "适合长期关注", "不适合吹成神器"],
      "media_label": "判断卡片",
      "media_type": "generated_image",
      "media_prompt": "verdict card, editorial tech style, clean conclusion panel, blue black, 6:5 horizontal",
      "needs_github_evidence": false,
      "evidence_text": "结论来自官方资料与谨慎判断"
    },
    {
      "id": "p6",
      "name": "结语P6",
      "duration_sec": 42,
      "layout": "summary",
      "motion_preset": "lift",
      "visual_preset": "image",
      "title": "这项目最值得看的，是方向",
      "subtitle": "它更像一个值得长期观察的前沿路线，而不是马上人人可用的工具",
      "bottom_conclusion": "值得关注，别吹万能",
      "voiceover_text": "如果你关心的是 AI 会不会从回答问题，走向模拟复杂世界，那 MiroFish 很值得继续追。",
      "human_conclusion": "看方向价值，不看神话包装。",
      "points": ["值得继续追", "更像方向验证", "不是立刻上手型工具"],
      "media_label": "收束总结卡",
      "media_type": "generated_image",
      "media_prompt": "summary card, clean futuristic editorial style, simulation lab mood, 6:5 horizontal",
      "needs_github_evidence": false,
      "evidence_text": "最终判断与账号定位收束"
    }
  ]
}
```
