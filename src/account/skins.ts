import type {AccountProjectConfig, AccountVisualSkin} from './config';

export type AccountSkinThemePreset = {
  accentColor: string;
  secondaryColor: string;
  pageLight: string;
  pageDark: string;
};

export type AccountSkinProfile = {
  id: AccountVisualSkin;
  label: string;
  description: string;
  chipLabel: string;
  accentColor: string;
  secondaryColor: string;
  canvasBackground: string;
  gridOpacity: number;
  frameBorder: string;
  tagBackground: string;
  tagBorder: string;
  eyebrowBackground: string;
  eyebrowBorder: string;
  titleGradient: string;
  subtitleColor: string;
  navShellBackground: string;
  navBorder: string;
  navInactiveBackground: string;
  navInactiveText: string;
  navActiveGradient: string;
  navActiveText: string;
  panelBackground: string;
  panelBackgroundStrong: string;
  panelBorder: string;
  panelShadow: string;
  pointBackground: string;
  pointBorder: string;
  overlayCardBackground: string;
  overlayCardBorder: string;
  mediaBackplate: string;
  mediaShellBackground: string;
  mediaShellBorder: string;
  mediaShellShadow: string;
  mediaMask: string;
  scanLine: string;
  bottomBackground: string;
  bottomBorder: string;
  bottomLabelText: string;
  bottomChipBackground: string;
  bottomChipText: string;
  guideLine: string;
  warningStripeOpacity: number;
};

export const accountVisualSkinOptions: Array<{
  value: AccountVisualSkin;
  label: string;
  description: string;
}> = [
  {value: 'blacktech', label: '黑科技类', description: '深蓝 + 电青，未来感更强'},
  {value: 'tool', label: '工具类', description: '深色专业感，强调效率和结果'},
  {value: 'risk', label: '风险拆解类', description: '黑红橙预警，强调边界和代价'},
];

const themePresets: Record<AccountVisualSkin, AccountSkinThemePreset> = {
  blacktech: {
    accentColor: '#42E8D4',
    secondaryColor: '#6CAEFF',
    pageLight: '#0A1422',
    pageDark: '#06101C',
  },
  tool: {
    accentColor: '#55E6A5',
    secondaryColor: '#61C8FF',
    pageLight: '#0A1620',
    pageDark: '#08131B',
  },
  risk: {
    accentColor: '#FF8A4C',
    secondaryColor: '#FF4D6D',
    pageLight: '#180D12',
    pageDark: '#12080D',
  },
};

export const normalizeAccountVisualSkin = (value?: string | null): AccountVisualSkin => {
  if (value === 'tool' || value === 'risk' || value === 'blacktech') {
    return value;
  }

  return 'blacktech';
};

export const getSkinThemePreset = (skin: AccountVisualSkin): AccountSkinThemePreset => {
  return themePresets[normalizeAccountVisualSkin(skin)];
};

export const getSkinLabel = (skin?: string | null) => {
  const normalized = normalizeAccountVisualSkin(skin);
  return accountVisualSkinOptions.find((item) => item.value === normalized)?.label ?? '黑科技类';
};

const skinHintKeywords: Record<AccountVisualSkin, string[]> = {
  blacktech: ['blacktech', '黑科技', '未来感', '未来交互', '科幻', '感知', '机器人', '空间智能', '仿真', '模拟', '预测', '沙盘', '世界模型', '数字孪生'],
  tool: ['tool', '工具', '效率', '提效', '自动化', '工作流', 'agent', 'workflow', 'automation', 'productivity', '流程', '生产力'],
  risk: ['risk', '风险', '避坑', '安全', '预警', '警告', 'warning', 'security', '合规', '限制', '门槛', '翻车', '隐私', '漏洞', '权限'],
};

const skinScoringKeywords: Record<AccountVisualSkin, Array<{term: string; weight: number}>> = {
  blacktech: [
    {term: '黑科技', weight: 3.5},
    {term: '未来', weight: 2.2},
    {term: '科幻', weight: 2.4},
    {term: '感知', weight: 2.8},
    {term: '机器人', weight: 2.8},
    {term: '空间智能', weight: 3},
    {term: '仿真', weight: 2.6},
    {term: '模拟', weight: 1.9},
    {term: '预测', weight: 2.3},
    {term: '沙盘', weight: 2.6},
    {term: '世界模型', weight: 3.2},
    {term: 'digital twin', weight: 3},
    {term: 'world model', weight: 3.2},
    {term: 'simulation', weight: 2.4},
  ],
  tool: [
    {term: '工具', weight: 3},
    {term: '效率', weight: 2.6},
    {term: '提效', weight: 2.6},
    {term: '自动化', weight: 3},
    {term: '工作流', weight: 3},
    {term: 'agent', weight: 2.2},
    {term: 'workflow', weight: 2.8},
    {term: 'automation', weight: 2.8},
    {term: 'productivity', weight: 2.5},
    {term: '流程', weight: 2},
    {term: '生产力', weight: 2.4},
    {term: '办公', weight: 1.8},
    {term: '协同', weight: 1.8},
  ],
  risk: [
    {term: '风险', weight: 3.4},
    {term: '避坑', weight: 3.2},
    {term: '安全', weight: 3.2},
    {term: '预警', weight: 2.8},
    {term: '警告', weight: 2.8},
    {term: 'warning', weight: 2.6},
    {term: 'security', weight: 3},
    {term: '合规', weight: 2.8},
    {term: '限制', weight: 2.2},
    {term: '门槛', weight: 2.6},
    {term: '翻车', weight: 2.8},
    {term: '隐私', weight: 2.8},
    {term: '漏洞', weight: 3},
    {term: '权限', weight: 2.2},
  ],
};

const normalizeTextForSkinMatch = (value?: string | null) => {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
};

export const parseAccountVisualSkinHint = (value?: string | null): AccountVisualSkin | undefined => {
  const normalized = normalizeTextForSkinMatch(value);
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'blacktech' || normalized === 'tool' || normalized === 'risk') {
    return normalized;
  }

  for (const [skin, keywords] of Object.entries(skinHintKeywords) as Array<[AccountVisualSkin, string[]]>) {
    if (keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return skin;
    }
  }

  return undefined;
};

export type SkinRecommendation = {
  skin: AccountVisualSkin;
  reasons: string[];
  scores: Record<AccountVisualSkin, number>;
  fromHint: boolean;
};

export type SkinRecommendationOptions = {
  preferExplicitHint?: boolean;
};

const createEmptySkinScores = (): Record<AccountVisualSkin, number> => ({
  blacktech: 0,
  tool: 0,
  risk: 0,
});

const collectSkinSignals = (project: Pick<AccountProjectConfig, 'meta' | 'tags' | 'segments'>) => {
  const signals: Array<{text: string; weight: number}> = [];

  signals.push({text: project.meta.projectName, weight: 4});
  signals.push({text: project.tags.left, weight: 2});
  signals.push({text: project.tags.right, weight: 2});

  for (const segment of project.segments) {
    signals.push({text: segment.id, weight: 0.8});
    signals.push({text: segment.label, weight: 1.6});
    signals.push({text: segment.navLabel, weight: 1.2});
    signals.push({text: segment.title, weight: 2.4});
    signals.push({text: segment.subtitle, weight: 1.8});
    signals.push({text: segment.bottomConclusion, weight: 1.6});
    signals.push({text: segment.voiceoverText, weight: 1.2});
    signals.push({text: segment.humanConclusion ?? '', weight: 1.2});
    signals.push({text: segment.mediaLabel, weight: 1});
    signals.push({text: segment.mediaPrompt ?? '', weight: 1});
    signals.push({text: segment.evidenceText ?? '', weight: 0.8});
    if (segment.points.length) {
      signals.push({text: segment.points.join(' '), weight: 1.1});
    }
  }

  return signals;
};

export const recommendAccountVisualSkin = (
  project: Pick<AccountProjectConfig, 'meta' | 'tags' | 'segments'>,
  options?: SkinRecommendationOptions,
): SkinRecommendation => {
  const explicitHint = parseAccountVisualSkinHint(project.meta.visualSkin);
  if (options?.preferExplicitHint && explicitHint) {
    return {
      skin: explicitHint,
      reasons: ['已读取项目内明确指定的皮肤设置'],
      scores: createEmptySkinScores(),
      fromHint: true,
    };
  }

  const scores = createEmptySkinScores();
  const matchedReasons: Array<{skin: AccountVisualSkin; text: string; score: number}> = [];

  for (const signal of collectSkinSignals(project)) {
    const normalized = normalizeTextForSkinMatch(signal.text);
    if (!normalized) {
      continue;
    }

    for (const [skin, keywords] of Object.entries(skinScoringKeywords) as Array<[AccountVisualSkin, Array<{term: string; weight: number}>]>) {
      for (const keyword of keywords) {
        if (!normalized.includes(keyword.term.toLowerCase())) {
          continue;
        }

        const addition = signal.weight * keyword.weight;
        scores[skin] += addition;
        matchedReasons.push({skin, text: keyword.term, score: addition});
      }
    }
  }

  const layoutCounts = {dashboard: 0, phone: 0, concept: 0, hero: 0};
  const visualCounts = {dashboard: 0, phone: 0, orb: 0, nodes: 0};

  for (const segment of project.segments) {
    if (segment.layout === 'dashboard') {
      layoutCounts.dashboard += 1;
    }
    if (segment.layout === 'phone') {
      layoutCounts.phone += 1;
    }
    if (segment.layout === 'concept') {
      layoutCounts.concept += 1;
    }
    if (segment.layout === 'hero') {
      layoutCounts.hero += 1;
    }
    if (segment.visualPreset === 'dashboard') {
      visualCounts.dashboard += 1;
    }
    if (segment.visualPreset === 'phone') {
      visualCounts.phone += 1;
    }
    if (segment.visualPreset === 'orb') {
      visualCounts.orb += 1;
    }
    if (segment.visualPreset === 'nodes') {
      visualCounts.nodes += 1;
    }
  }

  const toolStructureScore = layoutCounts.dashboard + layoutCounts.phone + visualCounts.dashboard + visualCounts.phone;
  const blacktechStructureScore = layoutCounts.hero + layoutCounts.concept + visualCounts.orb + visualCounts.nodes;

  if (toolStructureScore >= 2) {
    const addition = 1.8 + toolStructureScore * 0.7;
    scores.tool += addition;
    matchedReasons.push({skin: 'tool', text: '面板 / 流程型布局占比更高', score: addition});
  }

  if (blacktechStructureScore >= 2) {
    const addition = 1.8 + blacktechStructureScore * 0.7;
    scores.blacktech += addition;
    matchedReasons.push({skin: 'blacktech', text: '概念 / 黑科技视觉占比更高', score: addition});
  }

  const rankedSkins = (Object.entries(scores) as Array<[AccountVisualSkin, number]>).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }

    const priority = {risk: 3, tool: 2, blacktech: 1};
    return priority[b[0]] - priority[a[0]];
  });

  const [topSkin, topScore] = rankedSkins[0];
  const finalSkin = topScore > 0 ? topSkin : 'blacktech';

  const reasons = matchedReasons
    .filter((item) => item.skin === finalSkin)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.text)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 3);

  if (!reasons.length) {
    reasons.push(finalSkin === 'tool' ? '内容结构更偏效率工具演示' : finalSkin === 'risk' ? '内容关键词更偏风险提醒与边界拆解' : '默认按黑科技 / 开源科普风格承接');
  }

  return {
    skin: finalSkin,
    reasons,
    scores,
    fromHint: false,
  };
};

export const getAccountSkinProfile = (config: Pick<AccountProjectConfig, 'meta' | 'theme'>): AccountSkinProfile => {
  const id = normalizeAccountVisualSkin(config.meta.visualSkin);
  const preset = getSkinThemePreset(id);
  const accentColor = config.theme.accentColor || preset.accentColor;
  const secondaryColor = config.theme.secondaryColor || preset.secondaryColor;

  if (id === 'tool') {
    return {
      id,
      label: '工具效率类',
      description: '更专业、更干净，强调流程与结果。',
      chipLabel: '工具效率模板',
      accentColor,
      secondaryColor,
      canvasBackground: 'radial-gradient(circle at 78% 16%, rgba(97,200,255,0.12), transparent 24%), radial-gradient(circle at 16% 14%, rgba(85,230,165,0.10), transparent 24%), linear-gradient(180deg, #08131B 0%, #0B1822 54%, #0D1C26 100%)',
      gridOpacity: 0.18,
      frameBorder: 'rgba(126,217,255,0.09)',
      tagBackground: 'linear-gradient(135deg, rgba(9,20,28,0.86), rgba(13,30,40,0.72))',
      tagBorder: 'rgba(85,230,165,0.34)',
      eyebrowBackground: 'rgba(255,255,255,0.04)',
      eyebrowBorder: 'rgba(97,200,255,0.14)',
      titleGradient: `linear-gradient(135deg, #F7FCFF 0%, #D4F0FF 44%, ${secondaryColor} 74%, ${accentColor} 100%)`,
      subtitleColor: 'rgba(220,239,247,0.84)',
      navShellBackground: 'linear-gradient(135deg, rgba(9,20,28,0.88), rgba(13,30,40,0.70))',
      navBorder: 'rgba(97,200,255,0.14)',
      navInactiveBackground: 'rgba(255,255,255,0.03)',
      navInactiveText: 'rgba(219,236,246,0.66)',
      navActiveGradient: `linear-gradient(135deg, ${accentColor}, ${secondaryColor})`,
      navActiveText: '#071118',
      panelBackground: 'linear-gradient(135deg, rgba(10,24,32,0.92), rgba(14,34,44,0.76))',
      panelBackgroundStrong: 'linear-gradient(135deg, rgba(10,24,32,0.96), rgba(14,38,48,0.84))',
      panelBorder: 'rgba(97,200,255,0.16)',
      panelShadow: '0 14px 36px rgba(0,0,0,0.20), 0 0 18px rgba(85,230,165,0.05)',
      pointBackground: 'linear-gradient(135deg, rgba(11,28,36,0.96), rgba(16,40,50,0.82))',
      pointBorder: 'rgba(97,200,255,0.14)',
      overlayCardBackground: 'linear-gradient(135deg, rgba(9,20,28,0.88), rgba(13,30,40,0.78))',
      overlayCardBorder: 'rgba(97,200,255,0.14)',
      mediaBackplate: 'linear-gradient(135deg, rgba(12,36,42,0.48), rgba(10,28,34,0.18))',
      mediaShellBackground: 'rgba(7,18,24,0.88)',
      mediaShellBorder: 'rgba(97,200,255,0.16)',
      mediaShellShadow: '0 28px 68px rgba(0,0,0,0.30), 0 0 20px rgba(85,230,165,0.09)',
      mediaMask: 'linear-gradient(180deg, rgba(4,12,16,0.08) 0%, rgba(4,12,16,0.08) 38%, rgba(4,12,16,0.52) 100%)',
      scanLine: 'linear-gradient(180deg, rgba(85,230,165,0), rgba(85,230,165,0.12), rgba(85,230,165,0))',
      bottomBackground: 'linear-gradient(135deg, rgba(8,20,28,0.94), rgba(13,34,40,0.84))',
      bottomBorder: 'rgba(97,200,255,0.16)',
      bottomLabelText: '效率结论',
      bottomChipBackground: 'rgba(255,255,255,0.04)',
      bottomChipText: '工具效率',
      guideLine: 'linear-gradient(180deg, rgba(85,230,165,0.82), rgba(97,200,255,0.16), rgba(85,230,165,0))',
      warningStripeOpacity: 0,
    };
  }

  if (id === 'risk') {
    return {
      id,
      label: '风险拆解类',
      description: '更像预警面板，强调边界、门槛和代价。',
      chipLabel: '风险拆解模板',
      accentColor,
      secondaryColor,
      canvasBackground: 'radial-gradient(circle at 76% 18%, rgba(255,77,109,0.16), transparent 24%), radial-gradient(circle at 18% 12%, rgba(255,138,76,0.14), transparent 26%), linear-gradient(180deg, #12080D 0%, #160C12 54%, #1A0F15 100%)',
      gridOpacity: 0.16,
      frameBorder: 'rgba(255,138,76,0.10)',
      tagBackground: 'linear-gradient(135deg, rgba(26,10,14,0.90), rgba(42,14,19,0.76))',
      tagBorder: 'rgba(255,138,76,0.34)',
      eyebrowBackground: 'rgba(255,255,255,0.03)',
      eyebrowBorder: 'rgba(255,138,76,0.16)',
      titleGradient: `linear-gradient(135deg, #FFF9F6 0%, #FFD7C8 42%, ${accentColor} 72%, ${secondaryColor} 100%)`,
      subtitleColor: 'rgba(255,229,220,0.84)',
      navShellBackground: 'linear-gradient(135deg, rgba(26,10,14,0.88), rgba(42,14,19,0.72))',
      navBorder: 'rgba(255,138,76,0.16)',
      navInactiveBackground: 'rgba(255,255,255,0.03)',
      navInactiveText: 'rgba(255,224,214,0.64)',
      navActiveGradient: `linear-gradient(135deg, ${accentColor}, ${secondaryColor})`,
      navActiveText: '#17090D',
      panelBackground: 'linear-gradient(135deg, rgba(28,11,16,0.92), rgba(45,15,22,0.78))',
      panelBackgroundStrong: 'linear-gradient(135deg, rgba(30,12,18,0.96), rgba(48,16,24,0.84))',
      panelBorder: 'rgba(255,138,76,0.18)',
      panelShadow: '0 14px 36px rgba(0,0,0,0.24), 0 0 18px rgba(255,77,109,0.08)',
      pointBackground: 'linear-gradient(135deg, rgba(34,12,18,0.96), rgba(52,18,26,0.84))',
      pointBorder: 'rgba(255,138,76,0.20)',
      overlayCardBackground: 'linear-gradient(135deg, rgba(24,10,14,0.90), rgba(42,14,19,0.80))',
      overlayCardBorder: 'rgba(255,138,76,0.16)',
      mediaBackplate: 'linear-gradient(135deg, rgba(58,20,28,0.40), rgba(32,12,18,0.18))',
      mediaShellBackground: 'rgba(20,8,12,0.90)',
      mediaShellBorder: 'rgba(255,138,76,0.18)',
      mediaShellShadow: '0 28px 68px rgba(0,0,0,0.34), 0 0 24px rgba(255,77,109,0.12)',
      mediaMask: 'linear-gradient(180deg, rgba(18,8,11,0.08) 0%, rgba(18,8,11,0.08) 34%, rgba(18,8,11,0.58) 100%)',
      scanLine: 'linear-gradient(180deg, rgba(255,138,76,0), rgba(255,138,76,0.14), rgba(255,138,76,0))',
      bottomBackground: 'linear-gradient(135deg, rgba(24,10,14,0.96), rgba(46,16,22,0.86))',
      bottomBorder: 'rgba(255,138,76,0.18)',
      bottomLabelText: '风险结论',
      bottomChipBackground: 'rgba(255,255,255,0.04)',
      bottomChipText: '风险拆解',
      guideLine: 'linear-gradient(180deg, rgba(255,138,76,0.85), rgba(255,77,109,0.20), rgba(255,138,76,0))',
      warningStripeOpacity: 0.18,
    };
  }

  return {
    id,
    label: '黑科技类',
    description: '更像未来交互和底层黑科技的解读面板。',
    chipLabel: '黑科技拆解模板',
    accentColor,
    secondaryColor,
    canvasBackground: 'radial-gradient(circle at 78% 16%, rgba(108,174,255,0.18), transparent 24%), radial-gradient(circle at 18% 14%, rgba(66,232,212,0.10), transparent 26%), radial-gradient(circle at 82% 80%, rgba(37,88,173,0.20), transparent 30%), linear-gradient(180deg, #06101C 0%, #091725 52%, #0B1320 100%)',
    gridOpacity: 0.28,
    frameBorder: 'rgba(140,190,255,0.08)',
    tagBackground: 'linear-gradient(135deg, rgba(7,18,29,0.82), rgba(10,28,44,0.68))',
    tagBorder: 'rgba(66,232,212,0.28)',
    eyebrowBackground: 'rgba(255,255,255,0.04)',
    eyebrowBorder: 'rgba(140,190,255,0.14)',
    titleGradient: `linear-gradient(135deg, #F8FCFF 0%, #CDE7FF 44%, ${secondaryColor} 74%, ${accentColor} 100%)`,
    subtitleColor: 'rgba(222,237,250,0.88)',
    navShellBackground: 'linear-gradient(135deg, rgba(7,18,29,0.82), rgba(10,28,44,0.68))',
    navBorder: 'rgba(140,190,255,0.12)',
    navInactiveBackground: 'rgba(255,255,255,0.03)',
    navInactiveText: 'rgba(228,240,255,0.62)',
    navActiveGradient: `linear-gradient(135deg, ${accentColor}, ${secondaryColor})`,
    navActiveText: '#07151A',
    panelBackground: 'linear-gradient(135deg, rgba(8,20,33,0.90), rgba(10,28,44,0.72))',
    panelBackgroundStrong: 'linear-gradient(135deg, rgba(8,20,33,0.92), rgba(10,28,44,0.78))',
    panelBorder: 'rgba(140,190,255,0.14)',
    panelShadow: '0 14px 36px rgba(0,0,0,0.20), 0 0 24px rgba(66,232,212,0.07)',
    pointBackground: 'linear-gradient(135deg, rgba(8,24,39,0.94), rgba(12,32,49,0.78))',
    pointBorder: 'rgba(140,190,255,0.14)',
    overlayCardBackground: 'linear-gradient(135deg, rgba(7,18,29,0.84), rgba(10,28,44,0.74))',
    overlayCardBorder: 'rgba(140,190,255,0.14)',
    mediaBackplate: 'linear-gradient(135deg, rgba(12,32,49,0.58), rgba(10,28,44,0.24))',
    mediaShellBackground: 'rgba(6,17,29,0.84)',
    mediaShellBorder: 'rgba(140,190,255,0.14)',
    mediaShellShadow: '0 30px 74px rgba(0,0,0,0.36), 0 0 18px rgba(66,232,212,0.10)',
    mediaMask: 'linear-gradient(180deg, rgba(5,12,20,0.10) 0%, rgba(5,12,20,0.08) 32%, rgba(5,12,20,0.54) 100%)',
    scanLine: 'linear-gradient(180deg, rgba(66,232,212,0), rgba(66,232,212,0.14), rgba(66,232,212,0))',
    bottomBackground: 'linear-gradient(135deg, rgba(7,18,29,0.92), rgba(10,28,44,0.82))',
    bottomBorder: 'rgba(140,190,255,0.16)',
    bottomLabelText: '底部结论',
    bottomChipBackground: 'rgba(255,255,255,0.04)',
    bottomChipText: '黑科技方向',
    guideLine: 'linear-gradient(180deg, rgba(66,232,212,0.78), rgba(108,174,255,0.18), rgba(66,232,212,0))',
    warningStripeOpacity: 0,
  };
};
