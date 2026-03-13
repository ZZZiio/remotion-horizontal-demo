# 简笔动画自动化模块设计方案

## 1. 目标

在现有 Remotion 项目中新增一套 **可自动生成、可模板化复用、可 JSON 驱动渲染** 的“简笔动画”能力，用来覆盖以下内容型视频：

- 人物对话
- 情绪冲突
- 观点反转
- 错误示范 / 正确示范
- 职场 / 家庭 / 两性 / 认知类短视频
- 账号口播中的“抽象概念 -> 人物关系演示”段落

目标不是做“每次都用 AI 现画一套动画”，而是做：

**文案 / 结构 -> 标准化 JSON -> 模板化简笔角色系统 -> 自动渲染视频**

这条路线更稳、更可控、更适合批量生产。

---

## 2. 为什么适合放进当前项目

当前工程已经具备三块非常关键的基础能力：

1. **统一段落配置模型**
   - `PROJECT_ROOT\src\account\config.ts:15`
   - `SegmentConfig` 已经是“一个段落 = 一组布局 / 动效 / 文案 / 素材配置”的结构。

2. **主场景 + 媒体面板分发机制**
   - `PROJECT_ROOT\src\account\AccountSegmentScene.tsx:11`
   - `PROJECT_ROOT\src\account\MediaPanel.tsx:255`
   - 当前已经通过 `visualPreset` 把不同视觉形式挂到统一段落里。

3. **已有 JSON -> 视频 的自动化链路**
   - 项目已经有“项目分析 -> JSON -> 渲染 mp4”的流程，天然适合把“简笔人物动画”也做成一种 `visualPreset`。

因此最优方案不是另起炉灶，而是：

**把简笔动画做成现有 `visualPreset` 体系下的新分支，并补一层专用 JSON schema。**

---

## 3. 总体架构

推荐采用 5 层结构：

1. **语义层**：模型或人工输出“这段讲了谁、关系是什么、情绪是什么、冲突怎么变化”
2. **编排层**：把语义转成标准 `stickScene` JSON
3. **模板层**：根据场景类型选择模板（对话 / 冲突 / 对比 / 围观）
4. **角色层**：用参数化 SVG / 线条组件生成角色、表情、手势
5. **动效层**：在 Remotion 内按时间轴驱动入场、抖动、转头、气泡、字幕、强调线

一句话概括：

**LLM 负责“理解内容”，模板系统负责“稳定出片”。**

---

## 4. 模块边界

建议新增以下模块：

### 4.1 数据层

建议新增：

- `PROJECT_ROOT\src\stick\schema.ts`
- `PROJECT_ROOT\src\stick\normalizers.ts`
- `PROJECT_ROOT\src\stick\presets.ts`

职责：

- 定义简笔动画 JSON 类型
- 默认值补全
- 长文案裁剪 / 自动换行 / 角色数量上限控制
- 模板名称映射

### 4.2 角色层

建议新增：

- `PROJECT_ROOT\src\stick\actors\StickActor.tsx`
- `PROJECT_ROOT\src\stick\actors\StickFace.tsx`
- `PROJECT_ROOT\src\stick\actors\StickPose.tsx`

职责：

- 角色头部 / 身体 / 手臂 / 表情的参数化绘制
- 不依赖位图，优先 SVG / 线段路径
- 支持肤色、线条色、头发、服饰、配件等少量可控参数

### 4.3 场景层

建议新增：

- `PROJECT_ROOT\src\stick\scenes\StickDialogueScene.tsx`
- `PROJECT_ROOT\src\stick\scenes\StickConflictScene.tsx`
- `PROJECT_ROOT\src\stick\scenes\StickCompareScene.tsx`
- `PROJECT_ROOT\src\stick\scenes\StickNarrationScene.tsx`

职责：

- 对话模板
- 冲突模板
- A/B 对比模板
- 单人口播解释模板

### 4.4 效果层

建议新增：

- `PROJECT_ROOT\src\stick\effects\emotion.ts`
- `PROJECT_ROOT\src\stick\effects\entrance.ts`
- `PROJECT_ROOT\src\stick\effects\emphasis.ts`

职责：

- 生气、震惊、委屈、得意、无语等表情强度映射
- 点头、后仰、抖动、缩放、强调线、问号、感叹号
- 统一控制动画节奏，避免每个模板重复写 timing

### 4.5 接入层

改造：

- `PROJECT_ROOT\src\account\config.ts`
- `PROJECT_ROOT\src\account\MediaPanel.tsx`
- `PROJECT_ROOT\scripts\build-project-json.mjs`
- 如有提示词构建脚本，也要补充简笔动画输出规范

职责：

- 扩展 `visualPreset`
- 在 JSON 生成阶段允许输出 `stickScene`
- 在面板中渲染对应模板

---

## 5. 数据模型设计

### 5.1 先扩展现有 `visualPreset`

当前 `visualPreset` 在：
- `PROJECT_ROOT\src\account\config.ts:3`

当前值只有：
- `orb`
- `nodes`
- `dashboard`
- `phone`
- `image`

建议扩成：

```ts
export type VisualPreset =
  | 'orb'
  | 'nodes'
  | 'dashboard'
  | 'phone'
  | 'image'
  | 'stick-dialogue'
  | 'stick-conflict'
  | 'stick-compare'
  | 'stick-narration';
```

### 5.2 给段落配置新增简笔场景字段

建议在 `SegmentConfig` 上新增可选字段：

```ts
export type StickEmotion =
  | 'neutral'
  | 'happy'
  | 'angry'
  | 'sad'
  | 'awkward'
  | 'surprised'
  | 'confident'
  | 'anxious';

export type StickPose =
  | 'stand'
  | 'talk'
  | 'point'
  | 'shrug'
  | 'hands-up'
  | 'facepalm'
  | 'sit';

export type StickActorConfig = {
  id: string;
  name?: string;
  role?: 'self' | 'other' | 'boss' | 'customer' | 'partner' | 'narrator';
  genderHint?: 'female' | 'male' | 'neutral';
  color?: string;
  accentColor?: string;
  emotion?: StickEmotion;
  pose?: StickPose;
  position?: 'left' | 'center' | 'right';
  accessory?: 'none' | 'glasses' | 'tie' | 'bag' | 'phone';
};

export type StickBubbleConfig = {
  actorId: string;
  text: string;
  tone?: 'say' | 'think' | 'shout' | 'whisper';
  startFrame: number;
  durationInFrames: number;
  emphasis?: boolean;
};

export type StickBeatConfig = {
  id: string;
  type:
    | 'enter'
    | 'exit'
    | 'shake'
    | 'nod'
    | 'turn'
    | 'freeze'
    | 'highlight'
    | 'caption';
  actorId?: string;
  startFrame: number;
  durationInFrames?: number;
  value?: number;
  text?: string;
};

export type StickSceneConfig = {
  template: 'dialogue' | 'conflict' | 'compare' | 'narration';
  backgroundStyle?: 'plain' | 'room' | 'office' | 'street' | 'classroom';
  actors: StickActorConfig[];
  bubbles?: StickBubbleConfig[];
  beats?: StickBeatConfig[];
  topCaption?: string;
  bottomCaption?: string;
  relationship?: 'couple' | 'coworker' | 'boss-employee' | 'friend' | 'customer-service';
  autoCamera?: boolean;
};
```

然后在 `SegmentConfig` 中加：

```ts
stickScene?: StickSceneConfig;
```

---

## 6. 推荐的“语义到动画”编排方式

不要让模型直接写满所有 frame 细节，否则很容易不稳定。

推荐采用 **两阶段编排**：

### 第一阶段：模型只负责语义抽取

输入：项目分析内容 / 文案 / 链接摘要

输出：

- 这段是否适合简笔动画
- 场景类型是什么
- 有几个人
- 每个人什么立场
- 情绪如何变化
- 哪几句需要气泡
- 哪句做顶部标题 / 底部总结

例：

```json
{
  "sceneType": "conflict",
  "actors": [
    {"id": "a", "role": "self", "emotion": "awkward"},
    {"id": "b", "role": "boss", "emotion": "angry"}
  ],
  "beats": [
    {"kind": "boss_question", "text": "这个方案为什么还没发？"},
    {"kind": "self_explain", "text": "因为需求昨天又改了"},
    {"kind": "boss_pressure", "text": "我不管，你今天必须交"}
  ],
  "topCaption": "很多人不是不会做，是不会应对压力沟通"
}
```

### 第二阶段：本地模板编排器补全时间轴

由本地函数把上面的语义 JSON 编成：

- 谁站左边谁站右边
- 什么时候入场
- 第几个气泡什么时候出现
- 哪个角色何时 shake / point / facepalm
- 哪句触发强调字幕

这样稳定性会高很多，也更容易批量生成。

---

## 7. 四类 MVP 场景模板

第一版不要贪多，先做 4 套最值钱的模板。

### 7.1 `stick-dialogue`

适合：

- 观点交流
- 问答解释
- 用户 vs 博主
- 老板问 / 你回答

特征：

- 2 人左右对站
- 轮流冒气泡
- 中间穿插强调字幕
- 节奏最稳，最适合做第一版

### 7.2 `stick-conflict`

适合：

- 冲突感强的短视频
- 吵架、质问、PUA、误解、争执
- “错误示范”类演绎

特征：

- 抖动、靠近、后仰、感叹号、红色强调线
- 情绪更激烈
- 更利于爆款短视频表达

### 7.3 `stick-compare`

适合：

- 错误做法 vs 正确做法
- 普通人思维 vs 高手思维
- 做项目前 vs 做项目后

特征：

- 左右双栏
- 角色可相同，仅表情、颜色、字幕不同
- 转化向视频很好用

### 7.4 `stick-narration`

适合：

- 单人讲解抽象概念
- 不需要互动，只需要人物陪衬
- 账号口播中的过渡段

特征：

- 1 人 + 浮动字幕 + 强调 icon
- 最容易和当前 `AccountSegmentScene` 混搭

---

## 8. 渲染策略

### 8.1 优先 SVG / 参数化矢量，不要首版就做骨骼系统

第一版推荐：

- 头：圆形 / 椭圆
- 身体：线条
- 手臂：2 段线
- 腿：2 段线
- 表情：眉毛 / 眼睛 / 嘴 的参数组合
- 配件：眼镜 / 领带 / 手机 / 文件夹

原因：

- 容易画
- 渲染快
- 风格统一
- 容易程序化控制
- 不需要引入复杂骨骼动画库

### 8.2 动作不要追求“真动画”，追求“信息表达”

建议动作库：

- `enterFromLeft`
- `enterFromRight`
- `idleFloat`
- `nod`
- `shake`
- `pointForward`
- `leanBack`
- `handsUp`
- `facepalm`
- `popBubble`
- `flashEmphasis`

这类动作已经足够支撑大多数短视频简笔演绎。

### 8.3 字幕和气泡优先保证可读性

简笔动画最容易翻车的不是人物，而是：

- 气泡太小
- 字太多
- 出场太快
- 颜色太花

所以必须加硬规则：

- 单个气泡建议 <= 26 字
- 超过自动拆成两条
- 同屏最多 2 个气泡
- 强调字幕和气泡不要同时抢主注意力
- 气泡出现时间 >= 1.2 秒

---

## 9. 与现有工程的接入方式

### 9.1 `config.ts`

需要做的事：

- 扩展 `VisualPreset`
- 给 `SegmentConfig` 增加 `stickScene?`
- 增加 `StickSceneConfig` 等类型

### 9.2 `MediaPanel.tsx`

当前这里已经按 `visualPreset` 分发不同图形：
- `PROJECT_ROOT\src\account\MediaPanel.tsx:255`
- `PROJECT_ROOT\src\account\MediaPanel.tsx:329`

这里可以直接补分支：

```tsx
visualPreset === 'stick-dialogue' ? (
  <StickDialogueScene ... />
) : visualPreset === 'stick-conflict' ? (
  <StickConflictScene ... />
) : ...
```

这样改动很小，不会破坏现有工程。

### 9.3 JSON 生成脚本

当前项目已经有自动构建 JSON 的脚本链路。

建议新增规则：

- 当段落出现明显“人物关系 / 冲突 / 对话 / 错误示范 / 正确示范”时
- 允许模型输出 `visualPreset: "stick-dialogue"` 等新类型
- 同时输出 `stickScene`

但模型不要直接输出复杂 frame 级动画，仅输出语义结构。

### 9.4 编辑器表单

当前编辑器未来可补一个“简笔动画配置面板”：

- 模板类型
- 角色数
- 关系类型
- 情绪
- 顶部标题
- 底部总结
- 关键对白列表

这会让不会写 JSON 的人也能手工修稿。

---

## 10. 推荐的最小可行 JSON 示例

```json
{
  "id": "conflict-demo",
  "label": "冲突演绎",
  "navLabel": "冲突",
  "durationInFrames": 150,
  "layout": "concept",
  "motionPreset": "stagger",
  "visualPreset": "stick-conflict",
  "title": "很多沟通崩掉，不是能力问题",
  "subtitle": "而是你在高压场景下不会表达",
  "bottomConclusion": "先接情绪，再讲事实，最后给方案",
  "voiceoverText": "很多人一被质问就只会解释，但高压沟通里，顺序错了，话就白说了。",
  "points": [
    "先接住对方情绪",
    "再说明客观原因",
    "最后给执行方案"
  ],
  "mediaLabel": "简笔冲突演绎",
  "stickScene": {
    "template": "conflict",
    "backgroundStyle": "office",
    "relationship": "boss-employee",
    "topCaption": "高压沟通，先别急着解释",
    "bottomCaption": "接情绪 -> 说事实 -> 给方案",
    "actors": [
      {
        "id": "boss",
        "role": "boss",
        "position": "left",
        "emotion": "angry",
        "pose": "point",
        "color": "#FF6B6B"
      },
      {
        "id": "me",
        "role": "self",
        "position": "right",
        "emotion": "awkward",
        "pose": "shrug",
        "color": "#6CAEFF"
      }
    ],
    "bubbles": [
      {
        "actorId": "boss",
        "text": "这个方案为什么还没发？",
        "tone": "shout",
        "startFrame": 18,
        "durationInFrames": 34,
        "emphasis": true
      },
      {
        "actorId": "me",
        "text": "我知道你着急，我先给你现在的进度。",
        "tone": "say",
        "startFrame": 58,
        "durationInFrames": 38
      },
      {
        "actorId": "me",
        "text": "需求昨晚改过，我今天 6 点前给你完整版本。",
        "tone": "say",
        "startFrame": 96,
        "durationInFrames": 42
      }
    ],
    "beats": [
      {"id": "boss-enter", "type": "enter", "actorId": "boss", "startFrame": 0, "durationInFrames": 12},
      {"id": "me-enter", "type": "enter", "actorId": "me", "startFrame": 6, "durationInFrames": 12},
      {"id": "boss-shake", "type": "shake", "actorId": "boss", "startFrame": 20, "durationInFrames": 10, "value": 1},
      {"id": "me-nod", "type": "nod", "actorId": "me", "startFrame": 62, "durationInFrames": 10, "value": 1},
      {"id": "final-caption", "type": "caption", "startFrame": 118, "durationInFrames": 28, "text": "先接情绪，再讲事实，最后给方案"}
    ],
    "autoCamera": true
  }
}
```

---

## 11. 自动化生成链路

推荐未来走这条生产链：

### 11.1 输入

- 项目链接
- 文案稿
- txt 提纲
- 批量话题清单

### 11.2 中间产物

1. 项目分析
2. 视频段落规划
3. 判断哪些段落适合简笔动画
4. 输出带 `stickScene` 的项目 JSON

### 11.3 输出

- JSON
- mp4
- 可回编辑器二次修改

### 11.4 选择规则

可以做一个简单决策器：

- 有“我 / 你 / 他 / 她 / 老板 / 客户 / 对方” -> 倾向简笔人物
- 有“对话 / 质问 / 吵 / 解释 / 回应 / 示范” -> 倾向 `stick-dialogue` / `stick-conflict`
- 有“错误 / 正确 / before / after / 对比” -> 倾向 `stick-compare`
- 否则维持现有 `dashboard / nodes / image`

这意味着：

**简笔动画不是替代整个项目，而是补一类更强的叙事镜头。**

---

## 12. 稳定性约束

既然你现在非常重视稳定性，这个模块从一开始就该有边界：

### 12.1 输入边界

- 最多 3 个角色
- 单段最多 4 个气泡
- 单条气泡建议不超过 26 字
- 单段时长建议 4~8 秒

### 12.2 渲染边界

- 默认只用 SVG / div / CSS，不引第三方重型动画依赖
- 不做运行时 AI 生成图像
- 不依赖远程素材
- 所有角色都本地参数化绘制

### 12.3 容错策略

若 `stickScene` 不完整：

- 自动回退到 `stick-narration`
- 角色缺失则补默认角色
- 气泡为空则仅显示顶部 / 底部字幕
- beats 缺失则走模板默认 timing

### 12.4 可诊断性

建议在 JSON 校验里新增报错摘要：

- `actors[1].position missing`
- `bubbles[2].startFrame overlaps previous bubble`
- `text too long, auto-split recommended`

这样后续排错不会黑盒。

---

## 13. 第一版实施顺序

推荐 4 个迭代：

### V1：最小上线版

- 新增 `stick-dialogue`
- 2 个角色
- 3 种表情
- 5 个动作
- 气泡 + 顶部标题 + 底部总结

价值：
- 已经能做大量问答 / 冲突 / 示范类短视频

### V1.1：冲突增强版

- 新增 `stick-conflict`
- 强调线 / 感叹号 / 抖动 / 红色警示

价值：
- 更贴近短视频强情绪表达

### V1.2：对比模板版

- 新增 `stick-compare`
- 左右对比 / before-after

价值：
- 更适合卖课、咨询、职场、认知类内容

### V1.3：自动编排版

- 模型输出语义 JSON
- 本地编排器补 timing

价值：
- 才真正进入“可批量化生产”阶段

---

## 14. 商业价值判断

这套模块如果做出来，意义不在于“比 PPT 酷一点”，而在于：

1. **适合大批量生产人物关系段落**
   - PPT 难批量自动出“人物互动”镜头
   - 简笔动画模板更适合程序化生成

2. **适合短视频内容工厂**
   - 情感、职场、销售、教育、认知类账号都能用

3. **更容易形成你的产品护城河**
   - 你不是卖一个视频文件
   - 你是在卖“文本 -> 叙事动画”的自动化系统

4. **可和你现有项目天然拼接**
   - 信息面板负责“讲逻辑”
   - 简笔人物负责“演关系”
   - 两者组合，才更像真正可收费的内容生产工具

---

## 15. 结论

最推荐的方向不是“纯 AI 自动画一切”，而是：

**用 LLM 负责语义理解，用本地模板负责稳定出片。**

对你当前项目，最佳落地方式是：

- 在 `visualPreset` 中新增 4 类简笔场景
- 为 `SegmentConfig` 增加 `stickScene`
- 在 `MediaPanel` 挂接新场景组件
- 在 JSON 生成脚本里增加“何时使用简笔动画”的规则
- 第一版先只做 `stick-dialogue` + `stick-conflict`

这是一个 **小投入、高复用、适合批量生产、也更可能成为收费能力** 的模块方向。

---

## 16. 直接建议

如果下一步要我继续，我建议不要再停留在方案层，而是直接做下面三件事：

1. 先把 `config.ts` 扩成支持 `stickScene`
2. 落一个最小的 `StickDialogueScene.tsx`
3. 做一份可被模型直接产出的 `stickScene` JSON schema 示例

这样你当天就能看到第一版真实成片，而不是只看文档。
