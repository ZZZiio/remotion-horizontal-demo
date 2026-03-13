export type DemoProps = {
  projectName: string;
  title: string;
  subtitle: string;
  leftTag: string;
  rightTag: string;
  bottomConclusion: string;
  conceptLines: string[];
  phoneMessages: string[];
  checklist: string[];
  accentColor: string;
};

export const defaultDemoProps: DemoProps = {
  projectName: 'MiroFish',
  title: 'AI开始预演未来？',
  subtitle: '更像预测沙盘，不是普通聊天 AI',
  leftTag: 'GitHub 热门项目',
  rightTag: '横屏信息动画 Demo',
  bottomConclusion: '值得关注，但别吹成万能预测器',
  conceptLines: [
    '先把问题变成一个数字沙盘',
    '再让多角色和多关系开始演化',
    '最后才输出一份可读结论'
  ],
  phoneMessages: [
    '这个项目到底在做什么？',
    '它不是先回答，而是先模拟。',
    '它更适合复杂问题推演，不是万能答案机。'
  ],
  checklist: [
    '它是什么',
    '它能干嘛',
    '门槛在哪',
    '值不值得关注'
  ],
  accentColor: '#4EE6D2'
};
