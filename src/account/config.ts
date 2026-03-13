export type SegmentLayout = 'hero' | 'concept' | 'dashboard' | 'phone' | 'summary';
export type MotionPreset = 'lift' | 'stagger' | 'spotlight' | 'calm';
export type TransitionPreset = 'clean' | 'soft' | 'impact';
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
export type AccountVisualSkin = 'blacktech' | 'tool' | 'risk';
export type AccountSubtitleMode = 'single' | 'bilingual-keywords' | 'bilingual-full';

export type StickEmotion = 'neutral' | 'happy' | 'angry' | 'sad' | 'awkward' | 'surprised' | 'confident' | 'anxious';
export type StickPose = 'stand' | 'talk' | 'point' | 'shrug' | 'hands-up' | 'facepalm' | 'sit';
export type StickActorAccessory = 'none' | 'glasses' | 'tie' | 'bag' | 'phone';

export type SegmentMediaItem = {
  id: string;
  label: string;
  url?: string;
  prompt?: string;
  source?: 'local' | 'remote' | 'generated';
};

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
  accessory?: StickActorAccessory;
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
  type: 'enter' | 'exit' | 'shake' | 'nod' | 'turn' | 'freeze' | 'highlight' | 'caption' | 'question' | 'exclamation';
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

export type SegmentConfig = {
  id: string;
  label: string;
  navLabel: string;
  durationInFrames: number;
  layout: SegmentLayout;
  motionPreset: MotionPreset;
  visualPreset: VisualPreset;
  title: string;
  subtitle: string;
  bottomConclusion: string;
  voiceoverText: string;
  humanConclusion?: string;
  subtitleSecondaryText?: string;
  points: string[];
  mediaLabel: string;
  mediaUrl?: string;
  mediaPrompt?: string;
  mediaItems?: SegmentMediaItem[];
  stickScene?: StickSceneConfig;
  evidenceText?: string;
  needsGithubEvidence?: boolean;
  audioStartSec?: number;
  audioEndSec?: number;
  cuePointsSec?: number[];
  voiceoverPreviewUrl?: string;
  voiceoverPreviewName?: string;
};

export type AccountProjectConfig = {
  meta: {
    projectName: string;
    accountName: string;
    positioning: string;
    width: number;
    height: number;
    fps: number;
    transitionPreset?: TransitionPreset;
    ipEnabled?: boolean;
    ipName?: string;
    ipSlogan?: string;
    ipHandle?: string;
    ipLogoUrl?: string;
    publishTitle?: string;
    publishDescription?: string;
    publishTopics?: string;
    sfxEnabled?: boolean;
    sfxVolume?: number;
    performanceMode?: boolean;
    previewAudioUrl?: string;
    previewAudioName?: string;
    previewAudioEnabled?: boolean;
    previewAudioMuted?: boolean;
    visualSkin?: AccountVisualSkin;
    subtitleMode?: AccountSubtitleMode;
  };
  theme: {
    accentColor: string;
    secondaryColor: string;
    pageLight: string;
    pageDark: string;
  };
  tags: {
    left: string;
    right: string;
  };
  segments: SegmentConfig[];
};

export const DEFAULT_COMPOSITION_WIDTH = 1920;
export const DEFAULT_COMPOSITION_HEIGHT = 1080;
export const DEFAULT_COMPOSITION_FPS = 30;

const normalizePositiveInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const nextValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(nextValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(nextValue)));
};

export const normalizeCompositionWidth = (value: unknown, fallback = DEFAULT_COMPOSITION_WIDTH) => {
  return normalizePositiveInteger(value, fallback, 320, 7680);
};

export const normalizeCompositionHeight = (value: unknown, fallback = DEFAULT_COMPOSITION_HEIGHT) => {
  return normalizePositiveInteger(value, fallback, 320, 4320);
};

export const normalizeCompositionFps = (value: unknown, fallback = DEFAULT_COMPOSITION_FPS) => {
  return normalizePositiveInteger(value, fallback, 1, 120);
};

export const defaultAccountProject: AccountProjectConfig = {
  meta: {
    projectName: 'MiroFish',
    accountName: 'Oxecho',
    positioning: 'AI\u5f00\u6e90\u9879\u76ee\u7ffb\u8bd1\u5b98 / \u907f\u5751\u62c6\u89e3\u53f7',
    width: DEFAULT_COMPOSITION_WIDTH,
    height: DEFAULT_COMPOSITION_HEIGHT,
    fps: DEFAULT_COMPOSITION_FPS,
    transitionPreset: 'soft',
    ipEnabled: true,
    performanceMode: false,
    visualSkin: 'blacktech',
    subtitleMode: 'single',
  },
  theme: {
    accentColor: '#42E8D4',
    secondaryColor: '#6CAEFF',
    pageLight: '#F4F8FB',
    pageDark: '#09131C',
  },
  tags: {
    left: 'AI\u5f00\u6e90\u62c6\u89e3',
    right: '\u5e2e\u666e\u901a\u4eba\u770b\u61c2\u9879\u76ee',
  },
  segments: [
    {
      id: 'hook',
      label: '\u5f00\u573a Hook',
      navLabel: '\u5f00\u573a',
      durationInFrames: 42,
      layout: 'hero',
      motionPreset: 'lift',
      visualPreset: 'orb',
      title: 'AI\u5f00\u59cb\u9884\u6f14\u672a\u6765\uff1f',
      subtitle: '\u5148\u770b\u7ed3\u8bba\uff1a\u5b83\u66f4\u50cf\u9884\u6d4b\u6c99\u76d8\uff0c\u4e0d\u662f\u666e\u901a\u804a\u5929 AI',
      bottomConclusion: '\u5148\u6293\u95ee\u9898\uff0c\u518d\u7ed9\u7ed3\u8bba',
      voiceoverText: '\u5982\u679c\u4e00\u4e2a\u5f00\u6e90\u9879\u76ee\uff0c\u60f3\u5148\u628a\u672a\u6765\u5728\u6570\u5b57\u6c99\u76d8\u91cc\u6f14\u4e00\u904d\uff0c\u5b83\u5230\u5e95\u662f\u5728\u753b\u997c\uff0c\u8fd8\u662f\u5728\u6253\u5f00\u4e0b\u4e00\u4ee3\u9884\u6d4b\u5de5\u5177\uff1f',
      humanConclusion: '\u5148\u8ba9\u89c2\u4f17\u77e5\u9053\uff0c\u8fd9\u4e0d\u662f\u666e\u901a\u804a\u5929\u5de5\u5177\u3002',
      subtitleSecondaryText: 'This is a prediction sandbox, not a chat bot.',
      points: ['\u95ee\u9898\u5148\u629b\u51fa\u6765', '\u9879\u76ee\u6c14\u8d28\u5148\u7acb\u4f4f'],
      mediaLabel: '\u6570\u5b57\u6c99\u76d8\u4e3b\u89c6\u89c9',
      mediaPrompt: 'digital sandbox, simulation globe, blue black tech style, 6:5 horizontal',
      evidenceText: '\u9879\u76ee\u5b9a\u4f4d\u6765\u81ea\u5b98\u65b9 README',
      needsGithubEvidence: true,
    },
    {
      id: 'p1',
      label: '\u5f15\u8a00 P1',
      navLabel: '\u5f15\u8a00',
      durationInFrames: 54,
      layout: 'hero',
      motionPreset: 'lift',
      visualPreset: 'orb',
      title: '\u5b83\u5230\u5e95\u662f\u4ec0\u4e48\uff1f',
      subtitle: '\u6211\u7684\u8d26\u53f7\u7b2c\u4e00\u4ef6\u4e8b\uff0c\u4e0d\u662f\u70ab\u6280\uff0c\u800c\u662f\u5148\u7ffb\u8bd1\u6210\u4eba\u8bdd',
      bottomConclusion: '\u5148\u89e3\u91ca\uff0c\u518d\u62c9\u5174\u8da3',
      voiceoverText: '\u5b98\u65b9\u628a\u5b83\u5b9a\u4e49\u6210\u7fa4\u4f53\u667a\u80fd\u9884\u6d4b\u5f15\u64ce\u3002\u7ffb\u8bd1\u6210\u4eba\u8bdd\uff0c\u5c31\u662f\u5148\u628a\u73b0\u5b9e\u95ee\u9898\u4e22\u8fdb\u6570\u5b57\u4e16\u754c\u91cc\u6f14\u4e00\u904d\u3002',
      humanConclusion: '\u5148\u628a\u9879\u76ee\u7ffb\u8bd1\u6210\u4eba\u8bdd\uff0c\u89c2\u4f17\u624d\u4f1a\u7ee7\u7eed\u542c\u3002',
      subtitleSecondaryText: 'Translate it into plain language first.',
      points: ['\u5b98\u65b9\u8bf4\u6cd5', '\u4eba\u8bdd\u7ffb\u8bd1', '\u4e00\u53e5\u7406\u89e3'],
      mediaLabel: '\u9879\u76ee\u4e3b\u89c6\u89c9',
      mediaPrompt: 'project hero image, clean blue tech layout, 6:5 horizontal',
      evidenceText: 'GitHub README \u9879\u76ee\u7b80\u4ecb',
      needsGithubEvidence: true,
    },
    {
      id: 'p2',
      label: 'P2 \u80fd\u529b',
      navLabel: '\u80fd\u529b',
      durationInFrames: 60,
      layout: 'concept',
      motionPreset: 'spotlight',
      visualPreset: 'nodes',
      title: '\u5b83\u4e0d\u662f\u5148\u56de\u7b54\uff0c\u800c\u662f\u5148\u6a21\u62df',
      subtitle: '\u6838\u5fc3\u5dee\u522b\u4e0d\u662f\u4f1a\u4e0d\u4f1a\u7b54\uff0c\u800c\u662f\u5b83\u5148\u642d\u73af\u5883\u3001\u642d\u5173\u7cfb\u3001\u642d\u8bb0\u5fc6\uff0c\u518d\u5f00\u59cb\u63a8\u6f14',
      bottomConclusion: '\u5148\u642d\u4e16\u754c\uff0c\u518d\u505a\u5224\u65ad',
      voiceoverText: '\u5b83\u548c\u666e\u901a\u95ee\u7b54\u5de5\u5177\u6700\u5927\u7684\u533a\u522b\uff0c\u662f\u5b83\u4e0d\u6025\u7740\u7ed9\u7b54\u6848\uff0c\u800c\u662f\u5148\u642d\u73af\u5883\u3001\u642d\u5173\u7cfb\u548c\u8bb0\u5fc6\uff0c\u7136\u540e\u518d\u5f00\u59cb\u6a21\u62df\u3002',
      humanConclusion: '\u5b83\u66f4\u50cf\u6570\u5b57\u6c99\u76d8\uff0c\u4e0d\u50cf\u804a\u5929\u673a\u5668\u4eba\u3002',
      subtitleSecondaryText: 'Build world, relations and memory before simulation.',
      points: ['\u642d\u73af\u5883', '\u642d\u5173\u7cfb', '\u8dd1\u63a8\u6f14'],
      mediaLabel: '\u8282\u70b9\u5173\u7cfb\u7ed3\u6784\u56fe',
      mediaPrompt: 'multi-agent graph, relationship nodes, futuristic dashboard, blue black interface, 6:5 horizontal',
      evidenceText: '\u5de5\u4f5c\u6d41\u4e0e\u7ed3\u6784\u4fe1\u606f\u6765\u81ea\u5b98\u65b9 README',
      needsGithubEvidence: true,
    },
    {
      id: 'p3',
      label: 'P3 \u573a\u666f',
      navLabel: '\u573a\u666f',
      durationInFrames: 66,
      layout: 'dashboard',
      motionPreset: 'stagger',
      visualPreset: 'dashboard',
      title: '\u5b83\u80fd\u5e72\u561b\uff1f\u6848\u4f8b\u624d\u662f\u91cd\u70b9',
      subtitle: '\u6ca1\u6709\u6848\u4f8b\uff0c\u666e\u901a\u89c2\u4f17\u5f88\u96be\u771f\u6b63\u611f\u53d7\u5230\u4ef7\u503c',
      bottomConclusion: '\u6848\u4f8b\u8d1f\u8d23\u7559\u4eba',
      voiceoverText: '\u8fd9\u4e2a\u9879\u76ee\u6700\u597d\u8bb2\u6e05\u695a\u7684\u4e0d\u662f\u62bd\u8c61\u539f\u7406\uff0c\u800c\u662f\u6848\u4f8b\u3002\u516c\u5f00\u4fe1\u606f\u91cc\u65e2\u6709\u73b0\u5b9e\u9884\u6d4b\uff0c\u4e5f\u6709\u53d9\u4e8b\u4e16\u754c\u63a8\u6f14\u3002',
      humanConclusion: '\u5b83\u65e2\u60f3\u505a\u73b0\u5b9e\u9884\u6d4b\uff0c\u4e5f\u60f3\u505a\u6545\u4e8b\u63a8\u6f14\u3002',
      subtitleSecondaryText: 'Use cases matter more than abstract claims.',
      points: ['\u8206\u60c5\u63a8\u6f14', '\u7b56\u7565\u6c99\u76d8', '\u53d9\u4e8b\u4e16\u754c\u6a21\u62df'],
      mediaLabel: '\u591a\u5361\u7247\u6848\u4f8b\u677f',
      mediaPrompt: 'case study dashboard, multiple scenario cards, blue interface, 6:5 horizontal',
      evidenceText: '\u5b98\u65b9 Demo \u4e0e README \u793a\u4f8b',
      needsGithubEvidence: true,
    },
    {
      id: 'p4',
      label: 'P4 \u95e8\u69db',
      navLabel: '\u95e8\u69db',
      durationInFrames: 60,
      layout: 'phone',
      motionPreset: 'stagger',
      visualPreset: 'phone',
      title: '\u95e8\u69db\u8981\u8bb2\u900f\uff0c\u4e0d\u7136\u4fe1\u4efb\u7acb\u4e0d\u4f4f',
      subtitle: '\u771f\u6b63\u6709\u4ef7\u503c\u7684\uff0c\u4e0d\u662f\u5938\u9879\u76ee\uff0c\u800c\u662f\u66ff\u89c2\u4f17\u8bb2\u660e\u767d\u9650\u5236',
      bottomConclusion: '\u95e8\u69db\u662f\u4fe1\u4efb\u6765\u6e90',
      voiceoverText: '\u8fd9\u7c7b\u9879\u76ee\u901a\u5e38\u9700\u8981 Node\u3001Python\u3001API Key\uff0c\u751a\u81f3\u989d\u5916\u670d\u52a1\u652f\u6301\uff0c\u800c\u4e14\u6a21\u62df\u6210\u672c\u4e5f\u4e0d\u4f4e\uff0c\u6240\u4ee5\u5fc5\u987b\u660e\u786e\u8c01\u9002\u5408\u3001\u8c01\u4e0d\u9002\u5408\u3002',
      humanConclusion: '\u5f88\u9177\uff0c\u4f46\u4e0d\u662f\u96f6\u95e8\u69db\u795e\u5668\u3002',
      subtitleSecondaryText: 'Cool, but not a zero-threshold tool.',
      points: ['\u4f9d\u8d56\u8981\u6c42', '\u9002\u5408\u8c01', '\u522b\u5439\u592a\u6ee1'],
      mediaLabel: '\u4fe1\u606f\u6e05\u5355 + \u95ee\u7b54\u5361',
      mediaPrompt: 'requirements panel, info cards, dark clean tech ui, 6:5 horizontal',
      evidenceText: '\u73af\u5883\u4f9d\u8d56\u4e0e\u9650\u5236\u6765\u81ea\u5b98\u65b9\u6587\u6863',
      needsGithubEvidence: true,
    },
    {
      id: 'p5',
      label: 'P5 \u5224\u65ad',
      navLabel: '\u5224\u65ad',
      durationInFrames: 54,
      layout: 'dashboard',
      motionPreset: 'calm',
      visualPreset: 'dashboard',
      title: '\u503c\u4e0d\u503c\u5f97\u5173\u6ce8\uff1f\u5fc5\u987b\u7ed9\u5224\u65ad',
      subtitle: '\u4e0d\u8981\u53ea\u8bb2\u529f\u80fd\uff0c\u8981\u660e\u786e\u544a\u8bc9\u89c2\u4f17\u503c\u4e0d\u503c\u5f97\u770b\u3001\u9002\u4e0d\u9002\u5408\u73b0\u5728\u4e0a\u624b',
      bottomConclusion: '\u660e\u786e\u5224\u65ad\uff0c\u51cf\u5c11\u72b9\u8c6b',
      voiceoverText: '\u6211\u7684\u7ed3\u8bba\u5f88\u7b80\u5355\uff1a\u8fd9\u4e2a\u9879\u76ee\u503c\u5f97\u5173\u6ce8\u3001\u503c\u5f97\u6536\u85cf\u3001\u503c\u5f97\u6301\u7eed\u8ddf\u8e2a\uff0c\u4f46\u4e0d\u503c\u5f97\u88ab\u5439\u6210\u4e07\u80fd\u9884\u6d4b\u5668\u3002',
      humanConclusion: '\u503c\u5f97\u5173\u6ce8\uff0c\u4f46\u522b\u795e\u5316\u3002',
      subtitleSecondaryText: 'Worth watching, not worth mythologizing.',
      points: ['\u503c\u5f97\u770b', '\u9002\u5408\u957f\u671f\u5173\u6ce8', '\u4e0d\u9002\u5408\u5439\u6210\u795e\u5668'],
      mediaLabel: '\u5224\u65ad\u5361\u7247',
      mediaPrompt: 'verdict card, editorial tech style, clean conclusion panel, 6:5 horizontal',
      evidenceText: '\u7ed3\u8bba\u6765\u81ea\u5b98\u65b9\u8d44\u6599\u4e0e\u8c28\u614e\u5224\u65ad',
      needsGithubEvidence: false,
    },
    {
      id: 'p6',
      label: '\u7ed3\u8bed P6',
      navLabel: '\u7ed3\u8bed',
      durationInFrames: 54,
      layout: 'summary',
      motionPreset: 'lift',
      visualPreset: 'image',
      title: '\u8fd9\u9879\u76ee\u6700\u503c\u5f97\u770b\u7684\uff0c\u662f\u65b9\u5411',
      subtitle: '\u5b83\u66f4\u50cf\u503c\u5f97\u957f\u671f\u89c2\u5bdf\u7684\u524d\u6cbf\u8def\u7ebf\uff0c\u800c\u4e0d\u662f\u4eba\u4eba\u7acb\u523b\u4e0a\u624b\u7684\u5de5\u5177',
      bottomConclusion: '\u503c\u5f97\u5173\u6ce8\uff0c\u522b\u5439\u4e07\u80fd',
      voiceoverText: '\u5982\u679c\u4f60\u5173\u5fc3\u7684\u662f AI \u4f1a\u4e0d\u4f1a\u4ece\u56de\u7b54\u95ee\u9898\u8d70\u5411\u6a21\u62df\u590d\u6742\u4e16\u754c\uff0c\u90a3 MiroFish \u503c\u5f97\u7ee7\u7eed\u8ffd\u3002',
      humanConclusion: '\u770b\u65b9\u5411\u4ef7\u503c\uff0c\u4e0d\u770b\u795e\u8bdd\u5305\u88c5\u3002',
      subtitleSecondaryText: 'Watch the direction, not the hype.',
      points: ['\u503c\u5f97\u7ee7\u7eed\u8ffd', '\u66f4\u50cf\u65b9\u5411\u9a8c\u8bc1', '\u4e0d\u662f\u7acb\u523b\u4e0a\u624b\u578b\u5de5\u5177'],
      mediaLabel: '\u6536\u675f\u603b\u7ed3\u5361',
      mediaPrompt: 'summary card, clean futuristic editorial style, 6:5 horizontal',
      evidenceText: '\u6700\u7ec8\u5224\u65ad\u4e0e\u8d26\u53f7\u5b9a\u4f4d\u6536\u675f',
      needsGithubEvidence: false,
    },
  ],
};

export const getProjectDuration = (config: AccountProjectConfig) => {
  return config.segments.reduce((sum, segment) => sum + segment.durationInFrames, 0);
};

export const getSegmentMediaItems = (segment: SegmentConfig): SegmentMediaItem[] => {
  if (segment.mediaItems?.length) {
    return segment.mediaItems;
  }

  if (!segment.mediaUrl && !segment.mediaPrompt) {
    return [];
  }

  return [
    {
      id: `${segment.id}-media-1`,
      label: segment.mediaLabel || '\u4e3b\u89c6\u89c9\u7d20\u6750',
      url: segment.mediaUrl,
      prompt: segment.mediaPrompt,
      source: segment.mediaUrl ? (segment.mediaUrl.startsWith('http') ? 'remote' : 'local') : 'generated',
    },
  ];
};

export const cloneProjectConfig = (config: AccountProjectConfig): AccountProjectConfig => {
  return JSON.parse(JSON.stringify(config)) as AccountProjectConfig;
};
