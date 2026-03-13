import type {
  SegmentConfig,
  StickActorAccessory,
  StickActorConfig,
  StickBeatConfig,
  StickBubbleConfig,
  StickEmotion,
  StickPose,
  StickSceneConfig,
  VisualPreset,
} from '../account/config';

const stickTemplates: StickSceneConfig['template'][] = ['dialogue', 'conflict', 'compare', 'narration'];
const stickBeatTypes: StickBeatConfig['type'][] = ['enter', 'exit', 'shake', 'nod', 'turn', 'freeze', 'highlight', 'caption', 'question', 'exclamation'];

const stickEmotions: StickEmotion[] = ['neutral', 'happy', 'angry', 'sad', 'awkward', 'surprised', 'confident', 'anxious'];
const stickPoses: StickPose[] = ['stand', 'talk', 'point', 'shrug', 'hands-up', 'facepalm', 'sit'];
const stickAccessories: StickActorAccessory[] = ['none', 'glasses', 'tie', 'bag', 'phone'];

export const getStickTemplateFromPreset = (visualPreset: VisualPreset): StickSceneConfig['template'] => {
  if (visualPreset === 'stick-conflict') return 'conflict';
  if (visualPreset === 'stick-compare') return 'compare';
  if (visualPreset === 'stick-narration') return 'narration';
  return 'dialogue';
};

const clampFrame = (value: unknown, fallback: number) => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.round(next) : fallback;
};

const normalizeText = (value: unknown, fallback = '') => {
  if (typeof value === 'string') {
    return value.trim() || fallback;
  }

  if (value === null || typeof value === 'undefined') {
    return fallback;
  }

  return String(value).trim() || fallback;
};

const pickEmotion = (value: unknown, fallback: StickEmotion): StickEmotion => {
  return stickEmotions.includes(value as StickEmotion) ? (value as StickEmotion) : fallback;
};

const pickPose = (value: unknown, fallback: StickPose): StickPose => {
  return stickPoses.includes(value as StickPose) ? (value as StickPose) : fallback;
};

const pickAccessory = (value: unknown, fallback: StickActorAccessory = 'none'): StickActorAccessory => {
  return stickAccessories.includes(value as StickActorAccessory) ? (value as StickActorAccessory) : fallback;
};

const pickTemplate = (value: unknown, fallback: StickSceneConfig['template']): StickSceneConfig['template'] => {
  return stickTemplates.includes(value as StickSceneConfig['template']) ? (value as StickSceneConfig['template']) : fallback;
};

const pickBeatType = (value: unknown, fallback: StickBeatConfig['type']): StickBeatConfig['type'] => {
  return stickBeatTypes.includes(value as StickBeatConfig['type']) ? (value as StickBeatConfig['type']) : fallback;
};

const splitLongBubble = (text: string) => {
  const clean = normalizeText(text);
  if (!clean) {
    return [];
  }

  if (clean.length <= 26) {
    return [clean];
  }

  const mid = Math.ceil(clean.length / 2);
  return [clean.slice(0, mid).trim(), clean.slice(mid).trim()].filter(Boolean);
};

const buildDefaultActors = (template: StickSceneConfig['template']): StickActorConfig[] => {
  if (template === 'narration') {
    return [{id: 'narrator', name: '讲述者', role: 'narrator', position: 'center', emotion: 'confident', pose: 'talk', accessory: 'none'}];
  }

  if (template === 'compare') {
    return [
      {id: 'left', name: '常见做法', role: 'other', position: 'left', emotion: 'awkward', pose: 'shrug', accessory: 'none', color: '#FFD9D9', accentColor: '#FF7C7C'},
      {id: 'right', name: '更优做法', role: 'self', position: 'right', emotion: 'confident', pose: 'point', accessory: 'none', color: '#E7FFF6', accentColor: '#62DFC5'},
    ];
  }

  if (template === 'conflict') {
    return [
      {id: 'boss', name: '对方', role: 'other', position: 'left', emotion: 'angry', pose: 'point', accessory: 'none', color: '#FFD9D9', accentColor: '#FF7C7C'},
      {id: 'self', name: '自己', role: 'self', position: 'right', emotion: 'awkward', pose: 'shrug', accessory: 'none', color: '#EAF5FF', accentColor: '#6CAEFF'},
    ];
  }

  return [
    {id: 'a', name: 'A', role: 'other', position: 'left', emotion: 'neutral', pose: 'talk', accessory: 'none'},
    {id: 'b', name: 'B', role: 'self', position: 'right', emotion: 'confident', pose: 'talk', accessory: 'none'},
  ];
};

const buildDefaultBubbles = (segment: SegmentConfig, template: StickSceneConfig['template'], actors: StickActorConfig[]): StickBubbleConfig[] => {
  const sourceTexts = [segment.subtitle, ...segment.points, segment.bottomConclusion].flatMap(splitLongBubble).filter(Boolean);

  if (template === 'compare') {
    const compareTexts = [segment.points[0], segment.points[1] || segment.bottomConclusion].flatMap(splitLongBubble).filter(Boolean).slice(0, 2);
    return compareTexts.map((text, index) => ({
      actorId: actors[index]?.id || actors[0]?.id || 'left',
      text,
      tone: index === 0 ? 'say' : 'say',
      startFrame: 18 + index * 30,
      durationInFrames: 42,
      emphasis: index === 1,
    }));
  }

  if (template === 'narration') {
    return sourceTexts.slice(0, 3).map((text, index) => ({
      actorId: actors[0]?.id || 'narrator',
      text,
      tone: 'think',
      startFrame: 18 + index * 18,
      durationInFrames: 54,
      emphasis: index === 0,
    }));
  }

  return sourceTexts.slice(0, 4).map((text, index) => ({
    actorId: actors[index % actors.length]?.id || actors[0]?.id || 'a',
    text,
    tone: template === 'conflict' && index === 0 ? 'shout' : 'say',
    startFrame: 18 + index * 26,
    durationInFrames: template === 'conflict' ? 34 : 38,
    emphasis: template === 'conflict' && index === 0,
  }));
};

const buildDefaultBeats = (segment: SegmentConfig, bubbles: StickBubbleConfig[]): StickBeatConfig[] => {
  const captionStart = bubbles.length ? Math.min(segment.durationInFrames - 34, bubbles[bubbles.length - 1].startFrame + 26) : Math.max(24, segment.durationInFrames - 34);
  return [
    {id: 'caption-summary', type: 'caption', startFrame: captionStart, durationInFrames: 28, text: segment.bottomConclusion},
  ];
};

const normalizeActors = (scene: Partial<StickSceneConfig> | undefined, template: StickSceneConfig['template']) => {
  const incoming = Array.isArray(scene?.actors) ? scene.actors : [];
  const fallback = buildDefaultActors(template);
  const source = incoming.length ? incoming.slice(0, 3) : fallback;

  return source.map((actor, index) => ({
    id: normalizeText(actor.id, `actor-${index + 1}`),
    name: normalizeText(actor.name, ''),
    role: actor.role ?? fallback[index]?.role ?? 'other',
    genderHint: actor.genderHint,
    color: normalizeText(actor.color, fallback[index]?.color ?? ''),
    accentColor: normalizeText(actor.accentColor, fallback[index]?.accentColor ?? ''),
    emotion: pickEmotion(actor.emotion, fallback[index]?.emotion ?? 'neutral'),
    pose: pickPose(actor.pose, fallback[index]?.pose ?? 'stand'),
    position: actor.position ?? fallback[index]?.position ?? (index === 0 ? 'left' : index === 1 ? 'right' : 'center'),
    accessory: pickAccessory(actor.accessory, fallback[index]?.accessory ?? 'none'),
  }));
};

const normalizeBubbles = (scene: Partial<StickSceneConfig> | undefined, segment: SegmentConfig, template: StickSceneConfig['template'], actors: StickActorConfig[]) => {
  const incoming = Array.isArray(scene?.bubbles) ? scene.bubbles : [];
  if (!incoming.length) {
    return buildDefaultBubbles(segment, template, actors);
  }

  return incoming
    .flatMap((bubble, index) => {
      return splitLongBubble(normalizeText(bubble.text)).map((text, splitIndex) => ({
        actorId: normalizeText(bubble.actorId, actors[index % actors.length]?.id || actors[0]?.id || 'actor-1'),
        text,
        tone: bubble.tone ?? 'say',
        startFrame: clampFrame(bubble.startFrame, 18 + index * 24 + splitIndex * 16),
        durationInFrames: clampFrame(bubble.durationInFrames, 38),
        emphasis: Boolean(bubble.emphasis),
      }));
    })
    .slice(0, 6);
};

const normalizeBeats = (scene: Partial<StickSceneConfig> | undefined, segment: SegmentConfig, bubbles: StickBubbleConfig[]): StickBeatConfig[] => {
  const incoming = Array.isArray(scene?.beats) ? scene.beats : [];
  if (!incoming.length) {
    return buildDefaultBeats(segment, bubbles);
  }

  return incoming.slice(0, 8).map((beat, index) => ({
    id: normalizeText(beat.id, `beat-${index + 1}`),
    type: pickBeatType(beat.type, 'caption'),
    actorId: normalizeText(beat.actorId, ''),
    startFrame: clampFrame(beat.startFrame, index * 24),
    durationInFrames: clampFrame(beat.durationInFrames, 24),
    value: typeof beat.value === 'number' ? beat.value : Number.isFinite(Number(beat.value)) ? Number(beat.value) : undefined,
    text: normalizeText(beat.text, ''),
  }));
};

export const normalizeStickScene = (segment: SegmentConfig): StickSceneConfig => {
  const rawScene = (segment.stickScene ?? {}) as Partial<StickSceneConfig>;
  const template = pickTemplate(rawScene.template, getStickTemplateFromPreset(segment.visualPreset));
  const actors = normalizeActors(rawScene, template);
  const bubbles = normalizeBubbles(rawScene, segment, template, actors);
  const beats = normalizeBeats(rawScene, segment, bubbles);

  return {
    template,
    backgroundStyle: rawScene.backgroundStyle ?? (template === 'conflict' ? 'office' : template === 'narration' ? 'plain' : 'room'),
    actors,
    bubbles,
    beats,
    topCaption: normalizeText(rawScene.topCaption, segment.title),
    bottomCaption: normalizeText(rawScene.bottomCaption, segment.bottomConclusion),
    relationship: rawScene.relationship,
    autoCamera: rawScene.autoCamera ?? true,
  };
};
