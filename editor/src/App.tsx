import React, {useEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {Player} from '@remotion/player';
import type {PlayerRef} from '@remotion/player';
import {AccountDeepTemplate} from '../../src/account/AccountDeepTemplate';
import {getStickTemplateFromPreset, normalizeStickScene} from '../../src/stick/normalizers';
import {
  cloneProjectConfig,
  defaultAccountProject,
  getProjectDuration,
  getSegmentMediaItems,
  normalizeCompositionFps,
  normalizeCompositionHeight,
  normalizeCompositionWidth,
} from '../../src/account/config';
import {accountVisualSkinOptions, getSkinThemePreset, normalizeAccountVisualSkin, recommendAccountVisualSkin} from '../../src/account/skins';
import type {
  AccountProjectConfig,
  MotionPreset,
  TransitionPreset,
  AccountVisualSkin,
  AccountSubtitleMode,
  SegmentConfig,
  SegmentMediaItem,
  SegmentLayout,
  StickActorConfig,
  StickBeatConfig,
  StickBubbleConfig,
  StickSceneConfig,
  VisualPreset
} from '../../src/account/config';
import sampleProjectPayload from '../../examples/mirofish-editor-import.json';
import {
  extractPromptJson,
  layoutLabelMap,
  layoutOptions,
  motionOptions,
  toTemplateConfig,
  toEditorConfig,
  visualOptions
} from './import-utils';
import {resolveBatchVoiceoverMatches} from './voiceover-batch-utils';

const STORAGE_KEY = 'oxecho-account-template-editor-v3';

const subtitleModeOptions: Array<{value: AccountSubtitleMode; label: string; description: string}> = [
  {value: 'single', label: '\u5355\u8bed\u9ad8\u53ef\u8bfb', description: '\u4e2d\u6587\u4e3b\u5b57\u5e55 + \u4eba\u8bdd\u7248\u8f85\u52a9'},
  {value: 'bilingual-keywords', label: '\u672f\u8bed\u53cc\u8bed', description: '\u53ea\u8865\u5c11\u91cf\u82f1\u6587\u5173\u952e\u8bcd\uff0c\u4e0d\u6253\u65ad\u4e2d\u6587\u8282\u594f'},
  {value: 'bilingual-full', label: '\u5168\u7a0b\u53cc\u8bed', description: '\u4e3b\u5b57\u5e55\u4e2d\u6587 + \u82f1\u6587\u526f\u5b57\u5e55'},
];

const subtitleModePresets: Array<{value: AccountSubtitleMode; label: string; description: string}> = [
  {value: 'single', label: '\u5b8c\u64ad\u7387\u4f18\u5148', description: '\u9002\u5408\u89e3\u91ca\u578b\u8d26\u53f7\u7684\u9ed8\u8ba4\u9009\u62e9'},
  {value: 'bilingual-keywords', label: '\u8d28\u611f\u589e\u5f3a', description: '\u8865\u82f1\u6587 key\uff0c\u4e0d\u5206\u6563\u4e2d\u6587\u8282\u594f'},
  {value: 'bilingual-full', label: '\u56fd\u9645\u5c55\u793a', description: '\u5168\u7a0b\u4e2d\u82f1\u53cc\u5c42\u5b57\u5e55'},
];

const transitionPresetOptions: Array<{value: TransitionPreset; label: string; description: string}> = [
  {value: 'clean', label: '清爽淡入', description: '仅淡入淡出，不做位移'},
  {value: 'soft', label: '柔和位移', description: '轻微上移 + 轻微缩放'},
  {value: 'impact', label: '动感推进', description: '侧向推进 + 轻微模糊'},
];

const normalizeTransitionPreset = (value?: string | null): TransitionPreset => {
  if (value === 'clean' || value === 'soft' || value === 'impact') {
    return value;
  }

  return 'soft';
};

const normalizeSubtitleMode = (value?: string | null): AccountSubtitleMode => {
  if (value === 'bilingual' || value === 'bilingual-full') {
    return 'bilingual-full';
  }

  if (value === 'bilingual-keywords') {
    return 'bilingual-keywords';
  }

  return 'single';
};

const getTransitionPresetLabel = (value?: string | null) => {
  return transitionPresetOptions.find((item) => item.value === normalizeTransitionPreset(value))?.label ?? '柔和位移';
};

const getSubtitleModeLabel = (value?: string | null) => {
  return subtitleModeOptions.find((item) => item.value === normalizeSubtitleMode(value))?.label ?? '\u5355\u8bed\u9ad8\u53ef\u8bfb';
};

const textToList = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const stickTemplateOptions: Array<{value: StickSceneConfig['template']; label: string}> = [
  {value: 'dialogue', label: '对话'},
  {value: 'conflict', label: '冲突'},
  {value: 'compare', label: '对比'},
  {value: 'narration', label: '讲述'},
];

const stickBackgroundOptions: Array<{value: NonNullable<StickSceneConfig['backgroundStyle']>; label: string}> = [
  {value: 'plain', label: '纯背景'},
  {value: 'room', label: '房间'},
  {value: 'office', label: '办公室'},
  {value: 'street', label: '街道'},
  {value: 'classroom', label: '教室'},
];

const stickRelationshipOptions: Array<{value: NonNullable<StickSceneConfig['relationship']>; label: string}> = [
  {value: 'friend', label: '朋友'},
  {value: 'coworker', label: '同事'},
  {value: 'boss-employee', label: '老板 / 员工'},
  {value: 'customer-service', label: '客户 / 服务'},
  {value: 'couple', label: '情侣'},
];

const stickRoleOptions: Array<{value: NonNullable<StickActorConfig['role']>; label: string}> = [
  {value: 'self', label: '自己'},
  {value: 'other', label: '对方'},
  {value: 'boss', label: '老板'},
  {value: 'customer', label: '客户'},
  {value: 'partner', label: '搭档'},
  {value: 'narrator', label: '讲述者'},
];

const stickPositionOptions: Array<{value: NonNullable<StickActorConfig['position']>; label: string}> = [
  {value: 'left', label: '左侧'},
  {value: 'center', label: '中间'},
  {value: 'right', label: '右侧'},
];

const stickEmotionOptions: Array<{value: NonNullable<StickActorConfig['emotion']>; label: string}> = [
  {value: 'neutral', label: '平静'},
  {value: 'happy', label: '开心'},
  {value: 'angry', label: '生气'},
  {value: 'sad', label: '难过'},
  {value: 'awkward', label: '尴尬'},
  {value: 'surprised', label: '惊讶'},
  {value: 'confident', label: '自信'},
  {value: 'anxious', label: '焦虑'},
];

const stickPoseOptions: Array<{value: NonNullable<StickActorConfig['pose']>; label: string}> = [
  {value: 'stand', label: '站立'},
  {value: 'talk', label: '说话'},
  {value: 'point', label: '指向'},
  {value: 'shrug', label: '摊手'},
  {value: 'hands-up', label: '举手'},
  {value: 'facepalm', label: '扶额'},
  {value: 'sit', label: '坐姿'},
];

const stickAccessoryOptions: Array<{value: NonNullable<StickActorConfig['accessory']>; label: string}> = [
  {value: 'none', label: '无配件'},
  {value: 'glasses', label: '眼镜'},
  {value: 'tie', label: '领带'},
  {value: 'bag', label: '包'},
  {value: 'phone', label: '手机'},
];

const stickBubbleToneOptions: Array<{value: NonNullable<StickBubbleConfig['tone']>; label: string}> = [
  {value: 'say', label: '普通'},
  {value: 'think', label: '心声'},
  {value: 'shout', label: '强调'},
  {value: 'whisper', label: '轻声'},
];

const stickBeatTypeOptions: Array<{value: Extract<StickBeatConfig['type'], 'turn' | 'nod' | 'shake' | 'enter' | 'exit' | 'question' | 'exclamation'>; label: string}> = [
  {value: 'turn', label: '转身'},
  {value: 'nod', label: '点头'},
  {value: 'shake', label: '摇头'},
  {value: 'enter', label: '入场'},
  {value: 'exit', label: '退场'},
  {value: 'question', label: '问号'},
  {value: 'exclamation', label: '感叹号'},
];

type StickVisualPreset = Extract<VisualPreset, 'stick-dialogue' | 'stick-conflict' | 'stick-compare' | 'stick-narration'>;

const stickVisualPresetOptions: Array<{value: StickVisualPreset; label: string}> = [
  {value: 'stick-dialogue', label: '简笔对话'},
  {value: 'stick-conflict', label: '简笔冲突'},
  {value: 'stick-compare', label: '简笔对比'},
  {value: 'stick-narration', label: '简笔讲述'},
];

const isStickVisualPreset = (value?: string | null): value is StickVisualPreset => {
  return value === 'stick-dialogue' || value === 'stick-conflict' || value === 'stick-compare' || value === 'stick-narration';
};

const buildEditorStickActor = (index: number): StickActorConfig => ({
  id: `actor-${index + 1}`,
  name: `角色${index + 1}`,
  role: index === 0 ? 'self' : 'other',
  position: index === 0 ? 'left' : index === 1 ? 'right' : 'center',
  emotion: index === 0 ? 'confident' : 'neutral',
  pose: index === 0 ? 'talk' : 'stand',
  accessory: 'none',
  color: index === 0 ? '#F3FAFF' : '#FFDCDC',
  accentColor: index === 0 ? '#6CAEFF' : '#FF7C7C',
});

const applyStickVisualPreset = (segment: SegmentConfig, visualPreset: StickVisualPreset): SegmentConfig => {
  const nextSegment = {...segment, visualPreset};
  const normalizedScene = normalizeStickScene({...nextSegment, stickScene: segment.stickScene});
  return {
    ...nextSegment,
    stickScene: {
      ...normalizedScene,
      template: getStickTemplateFromPreset(visualPreset),
    },
  };
};

const buildEditorStickBubble = (actorId: string, index: number): StickBubbleConfig => ({
  actorId,
  text: `对白 ${index + 1}`,
  tone: 'say',
  startFrame: 18 + index * 24,
  durationInFrames: 36,
  emphasis: false,
});

const buildEditorStickBeat = (actorId: string, index: number): StickBeatConfig => ({
  id: `beat-${index + 1}`,
  actorId,
  type: index % 2 === 0 ? 'turn' : 'question',
  startFrame: 18 + index * 18,
  durationInFrames: 18,
  value: 1,
  text: index % 2 === 0 ? '' : '?',
});

const stickBeatPresetOptions: Array<{value: 'qa' | 'escalate' | 'compare'; label: string}> = [
  {value: 'qa', label: '问答节奏'},
  {value: 'escalate', label: '冲突推进'},
  {value: 'compare', label: '对比强调'},
];

const beatSnapGridOptions: Array<{value: 2 | 5 | 10; label: string}> = [
  {value: 2, label: '2f'},
  {value: 5, label: '5f'},
  {value: 10, label: '10f'},
];

const buildPresetStickBeats = (
  preset: 'qa' | 'escalate' | 'compare',
  actors: StickActorConfig[],
  durationInFrames: number,
): StickBeatConfig[] => {
  const actorA = actors[0]?.id || 'actor-1';
  const actorB = actors[1]?.id || actorA;
  const total = Math.max(48, durationInFrames || 96);
  const at = (ratio: number) => Math.max(0, Math.min(total - 1, Math.round(total * ratio)));

  if (preset === 'escalate') {
    return [
      {id: 'beat-enter-a', actorId: actorA, type: 'enter', startFrame: at(0.04), durationInFrames: 14, value: 1},
      {id: 'beat-enter-b', actorId: actorB, type: 'enter', startFrame: at(0.12), durationInFrames: 14, value: 1},
      {id: 'beat-shake-b', actorId: actorB, type: 'shake', startFrame: at(0.3), durationInFrames: 16, value: 1.2},
      {id: 'beat-exclaim-b', actorId: actorB, type: 'exclamation', startFrame: at(0.34), durationInFrames: 14, value: 1, text: '!'},
      {id: 'beat-turn-a', actorId: actorA, type: 'turn', startFrame: at(0.54), durationInFrames: 18, value: 1},
      {id: 'beat-exit-b', actorId: actorB, type: 'exit', startFrame: at(0.78), durationInFrames: 16, value: 1},
    ];
  }

  if (preset === 'compare') {
    return [
      {id: 'beat-enter-left', actorId: actorA, type: 'enter', startFrame: at(0.05), durationInFrames: 14, value: 1},
      {id: 'beat-enter-right', actorId: actorB, type: 'enter', startFrame: at(0.16), durationInFrames: 14, value: 1},
      {id: 'beat-question-left', actorId: actorA, type: 'question', startFrame: at(0.34), durationInFrames: 16, value: 1, text: '?'},
      {id: 'beat-turn-right', actorId: actorB, type: 'turn', startFrame: at(0.56), durationInFrames: 18, value: 1},
      {id: 'beat-exclaim-right', actorId: actorB, type: 'exclamation', startFrame: at(0.66), durationInFrames: 16, value: 1, text: '!'},
    ];
  }

  return [
    {id: 'beat-enter-a', actorId: actorA, type: 'enter', startFrame: at(0.05), durationInFrames: 14, value: 1},
    {id: 'beat-question-b', actorId: actorB, type: 'question', startFrame: at(0.24), durationInFrames: 14, value: 1, text: '?'},
    {id: 'beat-turn-a', actorId: actorA, type: 'turn', startFrame: at(0.46), durationInFrames: 16, value: 1},
    {id: 'beat-nod-a', actorId: actorA, type: 'nod', startFrame: at(0.62), durationInFrames: 16, value: 1},
    {id: 'beat-exclaim-a', actorId: actorA, type: 'exclamation', startFrame: at(0.76), durationInFrames: 14, value: 1, text: '!'},
  ];
};

const buildBeatFromBubble = (bubble: StickBubbleConfig, index: number): StickBeatConfig => {
  const text = bubble.text || '';
  const isQuestion = bubble.tone === 'think' || text.includes('?') || text.includes('\uFF1F');
  const isExclamation = bubble.tone === 'shout' || bubble.emphasis || text.includes('!') || text.includes('\uFF01');
  const durationInFrames = Math.max(12, Math.min(24, bubble.durationInFrames || 18));

  if (isExclamation) {
    return {
      id: `bubble-beat-${index + 1}-${bubble.startFrame}`,
      actorId: bubble.actorId,
      type: 'exclamation',
      startFrame: bubble.startFrame,
      durationInFrames,
      value: bubble.emphasis ? 1.2 : 1,
      text: '!',
    };
  }

  if (isQuestion) {
    return {
      id: `bubble-beat-${index + 1}-${bubble.startFrame}`,
      actorId: bubble.actorId,
      type: 'question',
      startFrame: bubble.startFrame,
      durationInFrames,
      value: 1,
      text: '?',
    };
  }

  if (bubble.tone === 'whisper') {
    return {
      id: `bubble-beat-${index + 1}-${bubble.startFrame}`,
      actorId: bubble.actorId,
      type: 'nod',
      startFrame: bubble.startFrame,
      durationInFrames,
      value: 0.9,
    };
  }

  return {
    id: `bubble-beat-${index + 1}-${bubble.startFrame}`,
    actorId: bubble.actorId,
    type: 'turn',
    startFrame: bubble.startFrame,
    durationInFrames,
    value: 1,
  };
};

const isAutoBubbleBeat = (beat: StickBeatConfig) => beat.id.startsWith('bubble-beat-');

const findNearbyBubbleBeatIndex = (beats: StickBeatConfig[], nextBeat: StickBeatConfig) => {
  const replaceWindow = Math.max(12, Math.min(24, nextBeat.durationInFrames || 18));
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  beats.forEach((beat, beatIndex) => {
    if (beat.actorId !== nextBeat.actorId) {
      return;
    }

    const distance = Math.abs(beat.startFrame - nextBeat.startFrame);
    const isCompatible = isAutoBubbleBeat(beat) || beat.type === nextBeat.type;
    if (!isCompatible || distance > replaceWindow || distance >= bestDistance) {
      return;
    }

    bestIndex = beatIndex;
    bestDistance = distance;
  });

  return bestIndex;
};

const mergeBubbleBeatIntoScene = (beats: StickBeatConfig[], nextBeat: StickBeatConfig): StickBeatConfig[] => {
  const replaceIndex = findNearbyBubbleBeatIndex(beats, nextBeat);
  const targetId = replaceIndex >= 0 ? beats[replaceIndex].id : nextBeat.id;
  const merged =
    replaceIndex >= 0
      ? beats.map((beat, beatIndex) => (beatIndex === replaceIndex ? {...beat, ...nextBeat, id: targetId} : beat))
      : [...beats, nextBeat];

  const dedupeWindow = Math.max(6, Math.round((nextBeat.durationInFrames || 18) / 2));
  return merged
    .filter((beat) => {
      if (beat.id === targetId) {
        return true;
      }

      if (!isAutoBubbleBeat(beat) || beat.actorId !== nextBeat.actorId || beat.type !== nextBeat.type) {
        return true;
      }

      return Math.abs(beat.startFrame - nextBeat.startFrame) > dedupeWindow;
    })
    .sort((left, right) => left.startFrame - right.startFrame);
};

const listToText = (value: string[]) => value.join('\n');

const formatSeconds = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--:--';
  }

  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
};

const hasPendingBlobMedia = (config: AccountProjectConfig) => {
  return config.segments.some((segment) => getSegmentMediaItems(segment).some((item) => item.url?.startsWith('blob:')));
};

const createSingleSegmentProject = (config: AccountProjectConfig, segmentIndex: number): AccountProjectConfig => {
  const segment = config.segments[segmentIndex];
  if (!segment) {
    return config;
  }

  return {
    ...config,
    segments: [segment]
  };
};

type RenderJobSnapshot = {
  id: string;
  status: 'queued' | 'rendering' | 'encoding' | 'done' | 'error' | 'canceled';
  progress: number;
  phaseText: string;
  message: string;
  outputPath?: string;
  outputName?: string;
  error?: string;
  targetLabel?: string;
  currentFrame?: number;
  totalFrames?: number;
  resolutionSteps?: string[];
  runtimeHint?: string;
};

type ImportSkinCardState = {
  sourceLabel: string;
  projectName: string;
  recommendedSkin: AccountVisualSkin;
  reasons: string[];
  hasExplicitSkin: boolean;
};

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
};

const createHybridRenderProject = (config: AccountProjectConfig): AccountProjectConfig => {
  const segments = config.segments || [];
  const primaryIds = new Set(['hook', 'p2', 'p5']);
  const hasPrimaryIds = segments.some((segment) => segment.id && primaryIds.has(segment.id));
  const primaryIndexes = new Set<number>();
  if (hasPrimaryIds) {
    segments.forEach((segment, index) => {
      if (segment.id && primaryIds.has(segment.id)) {
        primaryIndexes.add(index);
      }
    });
  } else {
    if (segments.length) {
      primaryIndexes.add(0);
      if (segments.length > 2) {
        primaryIndexes.add(2);
      }
      primaryIndexes.add(segments.length - 1);
    }
  }

  const nextSegments = segments.map((segment, index) => {
    if (primaryIndexes.has(index)) {
      return segment;
    }

    return {
      ...segment,
      visualPreset: 'image' as VisualPreset,
      motionPreset: 'calm' as MotionPreset,
      mediaPrompt: segment.mediaPrompt || segment.mediaLabel || segment.title || '简洁视觉卡片',
      stickScene: undefined,
    };
  });

  return {
    ...config,
    meta: {
      ...config.meta,
      transitionPreset: 'clean',
    },
    segments: nextSegments,
  };
};

const createInstantRenderProject = (config: AccountProjectConfig): AccountProjectConfig => {
  const nextSegments = (config.segments || []).map((segment) => ({
    ...segment,
    visualPreset: 'image' as VisualPreset,
    motionPreset: 'calm' as MotionPreset,
    mediaPrompt: segment.mediaPrompt || segment.mediaLabel || segment.title || '简洁视觉卡片',
    stickScene: undefined,
  }));

  return {
    ...config,
    meta: {
      ...config.meta,
      transitionPreset: 'clean',
    },
    segments: nextSegments,
  };
};

type RenderEncoderMode = 'x264' | 'nvenc' | 'nvenc-fast';

type RenderMode = 'full' | 'hybrid' | 'instant';

type RenderRequestSnapshot = {
  project: AccountProjectConfig;
  targetLabel: string;
  suggestedName: string;
  encoder: RenderEncoderMode;
  renderMode: RenderMode;
};

const compactRenderDetails = (details: Array<string | null | undefined>) => Array.from(new Set(details.map((item) => (item || '').trim()).filter(Boolean)));

const buildRenderJobDetails = (job?: Pick<RenderJobSnapshot, 'resolutionSteps' | 'runtimeHint'> | null) =>
  compactRenderDetails([...(job?.resolutionSteps || []), job?.runtimeHint ? `诊断：${job.runtimeHint}` : '']);

const hasExplicitProjectVisualSkin = (visualSkin?: string | null): visualSkin is AccountVisualSkin => {
  return visualSkin === 'blacktech' || visualSkin === 'tool' || visualSkin === 'risk';
};

const ensureProjectVisualSkin = (project: AccountProjectConfig): AccountProjectConfig => {
  if (project.meta.visualSkin === 'blacktech' || project.meta.visualSkin === 'tool' || project.meta.visualSkin === 'risk') {
    return {
      ...project,
      meta: {
        ...project.meta,
        visualSkin: normalizeAccountVisualSkin(project.meta.visualSkin),
        subtitleMode: normalizeSubtitleMode(project.meta.subtitleMode)
      }
    };
  }

  const recommendation = recommendAccountVisualSkin(project);
  return applyVisualSkinToProject(project, recommendation.skin);
};

const readStoredConfig = (): AccountProjectConfig => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return ensureProjectVisualSkin(cloneProjectConfig(defaultAccountProject));
  }

  try {
    const project = ensureProjectVisualSkin(JSON.parse(raw) as AccountProjectConfig);
    return {
      ...project,
      meta: {
        ...project.meta,
        width: normalizeCompositionWidth(project.meta.width, defaultAccountProject.meta.width),
        height: normalizeCompositionHeight(project.meta.height, defaultAccountProject.meta.height),
        fps: normalizeCompositionFps(project.meta.fps, defaultAccountProject.meta.fps),
      },
    };
  } catch {
    return ensureProjectVisualSkin(cloneProjectConfig(defaultAccountProject));
  }
};

const applyVisualSkinToProject = (project: AccountProjectConfig, visualSkin: AccountVisualSkin): AccountProjectConfig => {
  const preset = getSkinThemePreset(visualSkin);
  return {
    ...project,
    meta: {
      ...project.meta,
      visualSkin
    },
    theme: {
      ...project.theme,
      ...preset
    }
  };
};

const downloadTextFile = (filename: string, content: string, mimeType = 'application/json') => {
  const blob = new Blob([content], {type: mimeType});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const copyToClipboard = async (content: string) => {
  const text = String(content ?? '');
  if (!text) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '0';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

type UploadMode = 'append' | 'replace';

type VoiceoverAlignResult = {
  error?: string;
  details?: string;
  suggestion?: string;
  runtime_hint?: string;
  missing_dependency?: string;
  audio_duration_sec?: number;
  runtime?: {
    model?: string;
    device?: string;
    compute_type?: string;
  };
  segments?: Array<{
    id: string;
    start_sec: number;
    end_sec: number;
    duration_frames: number;
    cue_points_sec?: number[];
  }>;
};

type VoiceoverAlignFeedback = {
  message: string;
  details: string[];
};

const normalizePublishTopicToken = (value: string) => {
  const trimmed = value.trim().replace(/\s+/g, '');
  if (!trimmed) {
    return '';
  }

  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};

const inferPublishCopywriting = (project: AccountProjectConfig) => {
  const projectName = (project.meta.projectName ?? '').trim();
  const hook = project.segments?.[0];
  const verdict = project.segments?.find((segment) => segment.id === 'p4') ?? project.segments?.[4];

  const publishTitle = (hook?.title ?? projectName).trim() || undefined;
  const descriptionLines = [
    (hook?.subtitle ?? hook?.bottomConclusion ?? '').trim(),
    (verdict?.bottomConclusion ?? '').trim(),
  ].filter(Boolean);
  const publishDescription = (descriptionLines.join('\n') || `一句话看懂 ${projectName}`.trim()).trim() || undefined;

  const tokens = [
    '#AI开源',
    '#开源项目',
    projectName ? normalizePublishTopicToken(projectName) : '',
  ].filter(Boolean);
  const publishTopics = tokens.join(' ').trim() || undefined;

  if (!publishTitle && !publishDescription && !publishTopics) {
    return null;
  }

  return {publishTitle, publishDescription, publishTopics};
};

const buildVoiceoverScript = (project: AccountProjectConfig) => {
  const blocks = (project.segments || [])
    .map((segment) => {
      const text = (segment.voiceoverText ?? '').trim();
      if (!text) {
        return '';
      }

      const header = `【${segment.navLabel || segment.label || segment.id}】`;
      return `${header}\n${text}`;
    })
    .filter(Boolean);

  return blocks.join('\n\n').trim();
};

type SuccessfulVoiceoverAlignResult = VoiceoverAlignResult & {
  segments: NonNullable<VoiceoverAlignResult['segments']>;
};

class VoiceoverAlignRequestError extends Error {
  details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'VoiceoverAlignRequestError';
    this.details = details;
  }
}

const isInlineMediaUrl = (value?: string) => Boolean(value && (value.startsWith('data:') || value.startsWith('blob:')));

const isRemoteMediaUrl = (value?: string) => Boolean(value && !isInlineMediaUrl(value));

const isSupportedRemoteMediaUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const isInlineAudioUrl = (value?: string) => Boolean(value && (value.startsWith('data:') || value.startsWith('blob:')));

const compactVoiceoverDetails = (details: Array<string | null | undefined>) => Array.from(new Set(details.map((item) => (item || '').trim()).filter(Boolean)));

const formatVoiceoverRuntime = (runtime?: VoiceoverAlignResult['runtime']) => {
  if (!runtime) {
    return '';
  }

  return `运行环境：${runtime.device || 'auto'} / ${runtime.compute_type || 'auto'}${runtime.model ? ` / ${runtime.model}` : ''}`;
};

const buildVoiceoverErrorDetails = (result: VoiceoverAlignResult) =>
  compactVoiceoverDetails([
    result.suggestion ? `建议：${result.suggestion}` : '',
    result.missing_dependency ? `缺失依赖：${result.missing_dependency}` : '',
    result.runtime_hint ? `诊断：${result.runtime_hint}` : '',
  ]);

const buildVoiceoverSuccessDetails = (result: VoiceoverAlignResult, extras: Array<string | null | undefined> = []) =>
  compactVoiceoverDetails([formatVoiceoverRuntime(result.runtime), result.audio_duration_sec ? `识别音频时长：${result.audio_duration_sec.toFixed(1)} 秒` : '', ...extras]);

const toVoiceoverAlignFeedback = (error: unknown, fallbackMessage: string): VoiceoverAlignFeedback => {
  if (error instanceof VoiceoverAlignRequestError) {
    return {message: error.message, details: error.details};
  }

  if (error instanceof Error) {
    return {message: error.message, details: []};
  }

  return {message: fallbackMessage, details: []};
};

const ensureVoiceoverAlignResult = (response: Response, result: VoiceoverAlignResult, fallbackMessage: string): SuccessfulVoiceoverAlignResult => {
  if (!response.ok || result.error || !result.segments) {
    throw new VoiceoverAlignRequestError(result.details || result.error || fallbackMessage, buildVoiceoverErrorDetails(result));
  }

  return result as SuccessfulVoiceoverAlignResult;
};

const stripPreviewAudioFromProject = (config: AccountProjectConfig): AccountProjectConfig => ({
  ...config,
  meta: {
    ...config.meta,
    previewAudioUrl: undefined,
    previewAudioName: undefined,
    previewAudioEnabled: false,
    previewAudioMuted: false,
  },
  segments: config.segments.map((segment) => ({
    ...segment,
    voiceoverPreviewUrl: undefined,
    voiceoverPreviewName: undefined,
  })),
});

const buildSegmentVoiceoverProject = (config: AccountProjectConfig, segmentIndex: number) => {
  const segment = config.segments[segmentIndex];
  return {
    meta: {
      fps: config.meta.fps
    },
    segments: segment
      ? [
          {
            id: segment.id,
            label: segment.label,
            voiceoverText: segment.voiceoverText
          }
        ]
      : []
  };
};

const createMediaItemId = (segmentId: string) => `${segmentId}-media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getMediaSourceLabel = (item?: SegmentMediaItem) => {
  if (!item) {
    return '未设置素材';
  }

  if (item.url && isInlineMediaUrl(item.url)) {
    return '本地图片';
  }

  if (item.url) {
    return '远程图片';
  }

  if (item.prompt) {
    return '提示词生成';
  }

  return '未设置素材';
};

const getPreviewOffsetForMedia = (segment: SegmentConfig, mediaCount: number, index: number, fps: number) => {
  if (mediaCount <= 1) {
    return 0;
  }

  if (index <= 0) {
    return 0;
  }

  const cueFrames = (segment.cuePointsSec ?? [])
    .map((point) => Number(point))
    .filter((point) => Number.isFinite(point) && point >= 0)
    .map((point) => Math.max(0, Math.round(point * fps)));
  const framesPerItem = Math.max(1, Math.floor(segment.durationInFrames / mediaCount));
  const mediaSwitchFrames = Array.from({length: Math.max(0, mediaCount - 1)}, (_, cueIndex) => {
    const cueFrame = cueFrames[cueIndex];
    if (typeof cueFrame === 'number') {
      return Math.min(segment.durationInFrames - 1, cueFrame);
    }

    return Math.min(segment.durationInFrames - 1, framesPerItem * (cueIndex + 1));
  });
  const cueFrame = mediaSwitchFrames[index - 1];
  if (typeof cueFrame === 'number') {
    return cueFrame;
  }

  return Math.min(segment.durationInFrames - 1, framesPerItem * Math.max(0, index));
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('input, textarea, select, button, [contenteditable="true"], [role="textbox"]'));
};

const getImageFiles = (value: FileList | File[] | null | undefined) => {
  return Array.from(value ?? []).filter((file) => file.type.startsWith('image/'));
};

const readFileAsDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
};

const mergeMediaItem = (item: SegmentMediaItem, patch: Partial<SegmentMediaItem>, fallbackLabel: string): SegmentMediaItem => {
  const nextUrl = Object.prototype.hasOwnProperty.call(patch, 'url') ? patch.url : item.url;
  const nextPrompt = Object.prototype.hasOwnProperty.call(patch, 'prompt') ? patch.prompt : item.prompt;
  const normalizedUrl = typeof nextUrl === 'string' && nextUrl.trim() ? nextUrl : undefined;
  const normalizedPrompt = typeof nextPrompt === 'string' && nextPrompt.trim() ? nextPrompt : undefined;
  const labelSource = typeof patch.label === 'string' ? patch.label : item.label;
  const label = labelSource?.trim() || fallbackLabel;

  return {
    ...item,
    ...patch,
    label,
    url: normalizedUrl,
    prompt: normalizedPrompt,
    source:
      patch.source ??
      (normalizedUrl ? (isRemoteMediaUrl(normalizedUrl) ? 'remote' : 'local') : normalizedPrompt ? 'generated' : item.source)
  };
};

const sanitizeMediaItemsForStorage = (items?: SegmentMediaItem[]) => {
  if (!items?.length) {
    return undefined;
  }

  const sanitized = items
    .map((item) => {
      if (!isInlineMediaUrl(item.url)) {
        return item;
      }

      return {
        ...item,
        url: undefined
      };
    })
    .filter((item) => item.url || item.prompt);

  return sanitized.length ? sanitized : undefined;
};

const sanitizeConfigForStorage = (config: AccountProjectConfig): AccountProjectConfig => {
  return {
    ...config,
    meta: {
      ...config.meta,
      previewAudioUrl: undefined,
      previewAudioName: undefined,
      previewAudioEnabled: false,
      previewAudioMuted: false,
    },
    segments: config.segments.map((segment) => ({
      ...segment,
      mediaUrl: isInlineMediaUrl(segment.mediaUrl) ? undefined : segment.mediaUrl,
      mediaItems: sanitizeMediaItemsForStorage(segment.mediaItems),
      voiceoverPreviewUrl: isInlineAudioUrl(segment.voiceoverPreviewUrl) ? undefined : segment.voiceoverPreviewUrl,
      voiceoverPreviewName: undefined,
    }))
  };
};

const SegmentEditor: React.FC<{
  segment: SegmentConfig;
  fps: number;
  isActive?: boolean;
  onChange: (next: SegmentConfig) => void;
  subtitleMode?: AccountSubtitleMode;
  onPreviewRequest?: (offsetFrames?: number) => void;
  onUploadVoiceover?: (file: File) => Promise<void>;
  isVoiceoverUploading?: boolean;
  isInteractionDisabled?: boolean;
}> = ({
  segment,
  fps,
  isActive = false,
  onChange,
  subtitleMode = 'single',
  onPreviewRequest,
  onUploadVoiceover,
  isVoiceoverUploading = false,
  isInteractionDisabled = false,
}) => {
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const voiceoverUploadRef = useRef<HTMLInputElement | null>(null);
  const uploadModeRef = useRef<UploadMode>('append');
  const objectUrlMapRef = useRef<Record<string, string>>({});
  const segmentRef = useRef(segment);
  const selectedMediaIndexRef = useRef(0);
  const handleClipboardImagesRef = useRef<(clipboardData: DataTransfer | null) => boolean>(() => false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [remoteUrlDraft, setRemoteUrlDraft] = useState('');
  const [mediaFeedback, setMediaFeedback] = useState<FeedbackState | null>(null);
  const mediaItems = useMemo(() => getSegmentMediaItems(segment), [segment]);
  const safeSelectedMediaIndex = mediaItems.length ? Math.min(selectedMediaIndex, mediaItems.length - 1) : 0;
  const activeMedia = mediaItems[safeSelectedMediaIndex];
  const previewUrl = activeMedia?.url;
  const mediaSourceLabel = getMediaSourceLabel(activeMedia);
  const hasUploadedMedia = Boolean(previewUrl && isInlineMediaUrl(previewUrl));
  const hasRemoteMedia = Boolean(previewUrl && isRemoteMediaUrl(previewUrl));
  const canMutateMedia = !isInteractionDisabled;
  const canUploadVoiceover = Boolean(onUploadVoiceover) && !isVoiceoverUploading && !isInteractionDisabled;
  const canApplyRemoteMedia = canMutateMedia && Boolean(remoteUrlDraft.trim());
  const isStickSegment = isStickVisualPreset(segment.visualPreset);
  const stickScene = useMemo(() => normalizeStickScene(segment), [segment]);

  useEffect(() => {
    segmentRef.current = segment;
  }, [segment]);

  useEffect(() => {
    selectedMediaIndexRef.current = selectedMediaIndex;
  }, [selectedMediaIndex]);

  useEffect(() => {
    if (!mediaItems.length) {
      if (selectedMediaIndex !== 0) setSelectedMediaIndex(0);
      return;
    }
    const clampedIndex = Math.min(selectedMediaIndexRef.current, mediaItems.length - 1);
    if (clampedIndex !== selectedMediaIndex) setSelectedMediaIndex(clampedIndex);
  }, [mediaItems.length, selectedMediaIndex]);

  useEffect(() => {
    setRemoteUrlDraft(activeMedia?.url && isRemoteMediaUrl(activeMedia.url) ? activeMedia.url : '');
    setMediaFeedback(null);
  }, [activeMedia?.id, activeMedia?.url]);

  const revokeObjectUrlById = (id: string) => {
    const objectUrl = objectUrlMapRef.current[id];
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    delete objectUrlMapRef.current[id];
  };

  const revokeRemovedObjectUrls = (nextItems: SegmentMediaItem[]) => {
    const nextIds = new Set(nextItems.map((item) => item.id));
    Object.keys(objectUrlMapRef.current).forEach((id) => {
      if (!nextIds.has(id)) revokeObjectUrlById(id);
    });
  };

  useEffect(() => {
    return () => {
      Object.keys(objectUrlMapRef.current).forEach((id) => revokeObjectUrlById(id));
    };
  }, []);

  const triggerPreviewJump = (offsetFrames = 0) => {
    onPreviewRequest?.(offsetFrames);
  };

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, button, label, [data-stop-preview-jump="true"]')) return;
    triggerPreviewJump();
  };

  const handleEditorFocusCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (isActive || target.closest('[data-stop-preview-jump="true"]')) {
      return;
    }

    if (target.closest('input, textarea, select, button')) {
      triggerPreviewJump();
    }
  };

  const handleEditorMouseDownCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (isActive || target.closest('[data-stop-preview-jump="true"]')) {
      return;
    }

    if (target.closest('input, textarea, select, button, label')) {
      triggerPreviewJump();
    }
  };

  const update = <K extends keyof SegmentConfig>(key: K, value: SegmentConfig[K]) => {
    onChange({...segmentRef.current, [key]: value});
  };

  const updateStickScene = (patch: Partial<StickSceneConfig> | ((current: StickSceneConfig) => StickSceneConfig)) => {
    const currentScene = normalizeStickScene(segmentRef.current);
    const nextScene = typeof patch === 'function' ? patch(currentScene) : {...currentScene, ...patch};
    onChange({...segmentRef.current, stickScene: nextScene});
  };

  const handleVisualPresetChange = (value: VisualPreset) => {
    const nextSegment = {...segmentRef.current, visualPreset: value};
    if (!isStickVisualPreset(value)) {
      onChange(nextSegment);
      return;
    }

    onChange(applyStickVisualPreset(segmentRef.current, value));
  };

  const queuePreviewJump = (mediaCount: number, mediaIndex: number) => {
    window.setTimeout(() => onPreviewRequest?.(getPreviewOffsetForMedia(segmentRef.current, mediaCount, mediaIndex, fps)), 0);
  };

  const setStickTemplate = (template: StickSceneConfig['template']) => {
    updateStickScene((current) => ({...current, template}));
  };

  const resetStickSceneAuto = () => {
    const normalized = normalizeStickScene(segmentRef.current);
    onChange({...segmentRef.current, stickScene: normalized});
  };

  const syncStickTemplateToPreset = () => {
    if (!isStickVisualPreset(segmentRef.current.visualPreset)) {
      return;
    }

    updateStickScene((current) => ({...current, template: getStickTemplateFromPreset(segmentRef.current.visualPreset)}));
  };

  const updateStickActorAt = (index: number, patch: Partial<StickActorConfig>) => {
    updateStickScene((current) => ({
      ...current,
      actors: current.actors.map((actor, actorIndex) => (actorIndex === index ? {...actor, ...patch} : actor)),
    }));
  };

  const addStickActor = () => {
    updateStickScene((current) => {
      if (current.actors.length >= 3) {
        return current;
      }

      return {
        ...current,
        actors: [...current.actors, buildEditorStickActor(current.actors.length)],
      };
    });
  };

  const removeStickActor = (index: number) => {
    updateStickScene((current) => {
      if (current.actors.length <= 1) {
        return current;
      }

      const removedActorId = current.actors[index]?.id;
      const nextActors = current.actors.filter((_, actorIndex) => actorIndex !== index);
      const fallbackActorId = nextActors[0]?.id || 'actor-1';
      return {
        ...current,
        actors: nextActors,
        bubbles: (current.bubbles || []).map((bubble) => ({
          ...bubble,
          actorId: bubble.actorId === removedActorId ? fallbackActorId : bubble.actorId,
        })),
        beats: (current.beats || []).map((beat) => ({
          ...beat,
          actorId: beat.actorId === removedActorId ? fallbackActorId : beat.actorId,
        })),
      };
    });
  };

  const updateStickBubbleAt = (index: number, patch: Partial<StickBubbleConfig>) => {
    updateStickScene((current) => ({
      ...current,
      bubbles: (current.bubbles || []).map((bubble, bubbleIndex) => (bubbleIndex === index ? {...bubble, ...patch} : bubble)),
    }));
  };

  const addStickBubble = () => {
    updateStickScene((current) => {
      const bubbles = current.bubbles || [];
      if (bubbles.length >= 6) {
        return current;
      }

      return {
        ...current,
        bubbles: [...bubbles, buildEditorStickBubble(current.actors[0]?.id || 'actor-1', bubbles.length)],
      };
    });
  };

  const alignStickBubblesToVoiceoverCues = () => {
    const segmentDuration = Math.max(1, segmentRef.current.durationInFrames || 1);
    const cueFrames = (segmentRef.current.cuePointsSec ?? [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .map((value) => Math.round(value * fps))
      .filter((value) => value >= 0 && value < segmentDuration - 1);

    updateStickScene((current) => {
      const bubbles = current.bubbles || [];
      if (!bubbles.length || !cueFrames.length) {
        return current;
      }

      const uniqueCueFrames = Array.from(new Set(cueFrames)).sort((left, right) => left - right);
      const candidates = [0, ...uniqueCueFrames.filter((frame) => frame > 0)];
      const bubbleCount = bubbles.length;
      const minGap = 12;
      const minDuration = 18;

      const starts: number[] = [];
      if (bubbleCount === 1) {
        starts.push(0);
      } else if (candidates.length >= bubbleCount) {
        for (let i = 0; i < bubbleCount; i += 1) {
          const pickIndex = Math.round((i * (candidates.length - 1)) / (bubbleCount - 1));
          starts.push(candidates[pickIndex] ?? Math.round((i * (segmentDuration - 1)) / (bubbleCount - 1)));
        }
      } else {
        for (let i = 0; i < bubbleCount; i += 1) {
          starts.push(Math.round((i * (segmentDuration - 1)) / Math.max(1, bubbleCount - 1)));
        }
      }

      const normalizedStarts = starts
        .map((value) => Math.max(0, Math.min(segmentDuration - 1, Math.round(value))))
        .map((value, index, array) => {
          if (index === 0) {
            return 0;
          }

          const previous = array[index - 1] ?? 0;
          return Math.max(value, previous + minGap);
        })
        .map((value, index) => {
          const maxAllowed = segmentDuration - 1 - Math.max(0, (bubbleCount - 1 - index) * minGap);
          return Math.max(0, Math.min(maxAllowed, value));
        });

      const nextBubbles = bubbles.map((bubble, index) => {
        const startFrame = normalizedStarts[index] ?? bubble.startFrame;
        const nextStart = normalizedStarts[index + 1];
        const rawDuration = typeof nextStart === 'number' ? nextStart - startFrame : segmentDuration - startFrame;
        const durationInFrames = Math.max(minDuration, Math.min(segmentDuration - startFrame, rawDuration));
        return {
          ...bubble,
          startFrame,
          durationInFrames,
        };
      });

      return {
        ...current,
        bubbles: nextBubbles,
      };
    });
  };

  const removeStickBubble = (index: number) => {
    updateStickScene((current) => ({
      ...current,
      bubbles: (current.bubbles || []).filter((_, bubbleIndex) => bubbleIndex !== index),
    }));
  };

  const updateStickBeatAt = (index: number, patch: Partial<StickBeatConfig>) => {
    updateStickScene((current) => ({
      ...current,
      beats: (current.beats || []).map((beat, beatIndex) => (beatIndex === index ? {...beat, ...patch} : beat)),
    }));
  };

  const addStickBeat = () => {
    updateStickScene((current) => {
      const beats = current.beats || [];
      if (beats.length >= 8) {
        return current;
      }

      return {
        ...current,
        beats: [...beats, buildEditorStickBeat(current.actors[0]?.id || 'actor-1', beats.length)],
      };
    });
  };

  const removeStickBeat = (index: number) => {
    updateStickScene((current) => ({
      ...current,
      beats: (current.beats || []).filter((_, beatIndex) => beatIndex !== index),
    }));
  };

  const createBeatFromBubble = (bubbleIndex: number) => {
    updateStickScene((current) => {
      const bubble = current.bubbles?.[bubbleIndex];
      const beats = current.beats || [];
      if (!bubble) {
        return current;
      }

      const nextBeatBase = buildBeatFromBubble(bubble, bubbleIndex);
      const replaceIndex = findNearbyBubbleBeatIndex(beats, nextBeatBase);
      if (beats.length >= 8 && replaceIndex < 0) {
        return current;
      }

      let nextId = replaceIndex >= 0 ? beats[replaceIndex]?.id || nextBeatBase.id : nextBeatBase.id;
      let suffix = 2;
      while (beats.some((beat, beatIndex) => beat.id === nextId && beatIndex !== replaceIndex)) {
        nextId = `${nextBeatBase.id}-${suffix}`;
        suffix += 1;
      }

      return {
        ...current,
        beats: mergeBubbleBeatIntoScene(beats, {...nextBeatBase, id: nextId}),
      };
    });
  };

  const applyStickBeatPreset = (preset: 'qa' | 'escalate' | 'compare') => {
    updateStickScene((current) => ({
      ...current,
      beats: buildPresetStickBeats(preset, current.actors, segmentRef.current.durationInFrames),
    }));
  };

  const applyAdaptiveStickBeatPreset = () => {
    const preset = stickScene.template === 'conflict' ? 'escalate' : stickScene.template === 'compare' ? 'compare' : 'qa';
    applyStickBeatPreset(preset);
  };

  const snapStickBeatsToBubbles = () => {
    updateStickScene((current) => {
      const bubbles = [...(current.bubbles || [])].sort((left, right) => left.startFrame - right.startFrame);
      const beats = current.beats || [];
      if (!bubbles.length || !beats.length) {
        return current;
      }

      const actorBubbleIndexes = new Map<string, number>();
      let globalBubbleIndex = 0;
      const aligned = [...beats]
        .sort((left, right) => left.startFrame - right.startFrame)
        .map((beat) => {
          const actorBubbles = bubbles.filter((bubble) => bubble.actorId === beat.actorId);
          const actorIndex = actorBubbleIndexes.get(beat.actorId || '') ?? 0;
          const matchedBubble = actorBubbles[actorIndex] ?? bubbles[Math.min(globalBubbleIndex, bubbles.length - 1)] ?? bubbles[bubbles.length - 1];
          actorBubbleIndexes.set(beat.actorId || '', actorIndex + 1);
          globalBubbleIndex += 1;
          return {
            ...beat,
            startFrame: matchedBubble.startFrame,
          };
        })
        .sort((left, right) => left.startFrame - right.startFrame);

      return {
        ...current,
        beats: aligned,
      };
    });
  };

  const openVoiceoverPicker = (event?: React.SyntheticEvent<HTMLElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!canUploadVoiceover) {
      return;
    }

    voiceoverUploadRef.current?.click();
  };

  const handleSegmentVoiceoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onUploadVoiceover) {
      return;
    }

    await onUploadVoiceover(file);
  };

  const commitMediaItems = (nextItemsInput: SegmentMediaItem[], requestedIndex = selectedMediaIndexRef.current) => {
    const baseSegment = segmentRef.current;
    const nextItems = nextItemsInput.map((item, index) => mergeMediaItem(item, {}, `素材 ${index + 1}`)).filter((item) => item.url || item.prompt);
    revokeRemovedObjectUrls(nextItems);
    const nextIndex = nextItems.length ? Math.max(0, Math.min(requestedIndex, nextItems.length - 1)) : 0;
    const currentItem = nextItems[nextIndex];
    selectedMediaIndexRef.current = nextIndex;
    setSelectedMediaIndex(nextIndex);
    onChange({
      ...baseSegment,
      mediaItems: nextItems.length ? nextItems : undefined,
      mediaLabel: currentItem?.label ?? baseSegment.mediaLabel,
      mediaUrl: currentItem?.url,
      mediaPrompt: currentItem?.prompt ?? '',
      visualPreset: nextItems.length ? 'image' : baseSegment.visualPreset
    });
    return {nextItems, nextIndex};
  };

  const removeMediaItemById = (itemId: string) => {
    const currentItems = getSegmentMediaItems(segmentRef.current);
    const targetIndex = currentItems.findIndex((item) => item.id === itemId);
    if (targetIndex === -1) {
      revokeObjectUrlById(itemId);
      return;
    }

    revokeObjectUrlById(itemId);
    const nextItems = currentItems.filter((item) => item.id !== itemId);
    const nextIndex = nextItems.length ? Math.max(0, Math.min(selectedMediaIndexRef.current, nextItems.length - 1)) : 0;
    commitMediaItems(nextItems, nextIndex);
  };

  const updateSelectedMediaLabel = (value: string) => {
    setMediaFeedback(null);
    const latestItems = getSegmentMediaItems(segmentRef.current);
    if (!latestItems.length) {
      onChange({...segmentRef.current, mediaLabel: value});
      return;
    }
    const targetIndex = Math.min(selectedMediaIndexRef.current, latestItems.length - 1);
    const nextItems = latestItems.map((item, index) => (index === targetIndex ? mergeMediaItem(item, {label: value}, `素材 ${index + 1}`) : item));
    commitMediaItems(nextItems, targetIndex);
  };

  const updateSelectedMediaPrompt = (value: string) => {
    setMediaFeedback(null);
    const latestItems = getSegmentMediaItems(segmentRef.current);
    if (!latestItems.length) {
      onChange({...segmentRef.current, mediaPrompt: value, visualPreset: value.trim() ? 'image' : segmentRef.current.visualPreset});
      return;
    }
    const targetIndex = Math.min(selectedMediaIndexRef.current, latestItems.length - 1);
    const nextItems = latestItems.map((item, index) =>
      index === targetIndex ? mergeMediaItem(item, {prompt: value, source: value.trim() ? 'generated' : item.source}, `素材 ${index + 1}`) : item
    );
    commitMediaItems(nextItems, targetIndex);
  };

  const focusMediaIndex = (index: number) => {
    setMediaFeedback(null);
    const latestItems = getSegmentMediaItems(segmentRef.current);
    const result = commitMediaItems(latestItems, index);
    queuePreviewJump(result.nextItems.length, result.nextIndex);
  };

  const deleteCurrentMedia = () => {
    setMediaFeedback(null);
    const latestItems = getSegmentMediaItems(segmentRef.current);
    if (!latestItems.length) {
      onChange({...segmentRef.current, mediaItems: undefined, mediaUrl: undefined, mediaPrompt: ''});
      setRemoteUrlDraft('');
      return;
    }
    const targetIndex = Math.min(selectedMediaIndexRef.current, latestItems.length - 1);
    const targetItem = latestItems[targetIndex];
    revokeObjectUrlById(targetItem.id);
    const nextItems = latestItems.filter((item) => item.id !== targetItem.id);
    const nextIndex = Math.max(0, Math.min(targetIndex, nextItems.length - 1));
    const result = commitMediaItems(nextItems, nextIndex);
    setRemoteUrlDraft('');
    queuePreviewJump(result.nextItems.length, result.nextIndex);
  };

  const applyRemoteMedia = (mode: UploadMode = mediaItems.length ? 'replace' : 'append') => {
    if (!canMutateMedia) return;

    setMediaFeedback(null);
    const value = remoteUrlDraft.trim();
    if (!value) return;
    if (!isSupportedRemoteMediaUrl(value)) {
      setMediaFeedback({type: 'error', message: '图片链接格式不正确，请输入 http/https 直链。'});
      return;
    }
    const latestItems = getSegmentMediaItems(segmentRef.current);
    const targetIndex = mode === 'replace' && latestItems.length ? Math.min(selectedMediaIndexRef.current, latestItems.length - 1) : latestItems.length;
    const existingItem = mode === 'replace' && latestItems.length ? latestItems[targetIndex] : undefined;
    if (existingItem) revokeObjectUrlById(existingItem.id);
    const nextItem = mergeMediaItem(
      existingItem ?? {id: createMediaItemId(segmentRef.current.id), label: `素材 ${targetIndex + 1}`},
      {url: value, label: existingItem?.label ?? segmentRef.current.mediaLabel ?? `素材 ${targetIndex + 1}`, source: 'remote'},
      `素材 ${targetIndex + 1}`
    );
    const nextItems = [...latestItems];
    if (existingItem) nextItems[targetIndex] = nextItem;
    else nextItems.push(nextItem);
    const result = commitMediaItems(nextItems, targetIndex);
    queuePreviewJump(result.nextItems.length, result.nextIndex);
  };

  const processSelectedFiles = async (fileSource: FileList | File[] | null | undefined, mode: UploadMode) => {
    if (!canMutateMedia) return;

    const files = getImageFiles(fileSource);
    if (!files.length) return;

    setMediaFeedback(null);
    const latestItems = getSegmentMediaItems(segmentRef.current);
    const replaceIndex = latestItems.length ? Math.min(selectedMediaIndexRef.current, latestItems.length - 1) : 0;
    const replaceCandidate = latestItems[replaceIndex];
    const shouldFillPromptSlot =
      mode === 'append' && Boolean(replaceCandidate) && !replaceCandidate?.url && Boolean((replaceCandidate?.prompt || '').trim());
    const draftItems = [...latestItems];
    const insertedIds: string[] = [];

    files.forEach((file, offset) => {
      const replacingCurrent = (mode === 'replace' || shouldFillPromptSlot) && latestItems.length && offset === 0;
      const targetIndex = replacingCurrent ? replaceIndex : mode === 'replace' && latestItems.length ? replaceIndex + offset : draftItems.length;
      const existingItem = replacingCurrent ? latestItems[replaceIndex] : undefined;
      const itemId = existingItem?.id ?? createMediaItemId(segmentRef.current.id);
      if (existingItem) revokeObjectUrlById(itemId);
      const objectUrl = URL.createObjectURL(file);
      objectUrlMapRef.current[itemId] = objectUrl;
      const nextItem = mergeMediaItem(
        existingItem ?? {id: itemId, label: file.name || `素材 ${targetIndex + 1}`},
        {id: itemId, label: file.name || existingItem?.label || `素材 ${targetIndex + 1}`, url: objectUrl, source: 'local'},
        `素材 ${targetIndex + 1}`
      );
      if (replacingCurrent) draftItems[replaceIndex] = nextItem;
      else draftItems.splice(targetIndex, 0, nextItem);
      insertedIds.push(itemId);
    });

    const selectedIndex =
      (mode === 'replace' || shouldFillPromptSlot) && latestItems.length ? replaceIndex : Math.max(0, draftItems.length - files.length);
    const initialCommit = commitMediaItems(draftItems, selectedIndex);
    queuePreviewJump(initialCommit.nextItems.length, initialCommit.nextIndex);

    let failedCount = 0;

    await Promise.all(
      files.map(async (file, offset) => {
        const itemId = insertedIds[offset];
        try {
          const dataUrl = await readFileAsDataUrl(file);
          const currentItems = getSegmentMediaItems(segmentRef.current);
          const targetIndex = currentItems.findIndex((item) => item.id === itemId);
          if (targetIndex === -1) {
            revokeObjectUrlById(itemId);
            return;
          }
          const nextItems = currentItems.map((item, index) =>
            index === targetIndex ? mergeMediaItem(item, {url: dataUrl, label: file.name || item.label, source: 'local'}, `素材 ${index + 1}`) : item
          );
          const activeItemId = currentItems[Math.min(selectedMediaIndexRef.current, currentItems.length - 1)]?.id;
          const activeIndex = activeItemId ? nextItems.findIndex((item) => item.id === activeItemId) : targetIndex;
          revokeObjectUrlById(itemId);
          commitMediaItems(nextItems, activeIndex === -1 ? targetIndex : activeIndex);
        } catch {
          failedCount += 1;
          removeMediaItemById(itemId);
        }
      })
    );

    if (failedCount > 0) {
      setMediaFeedback({
        type: 'error',
        message: failedCount === files.length ? '图片读取失败，已自动移除本次素材。' : `有 ${failedCount} 张图片读取失败，已自动移除。`,
      });
    }
  };

  const openFilePicker = (mode: UploadMode, event?: React.SyntheticEvent<HTMLElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!canMutateMedia) return;

    setMediaFeedback(null);
    uploadModeRef.current = mode;
    const input = uploadRef.current;
    if (!input) return;
    try {
      if ('showPicker' in input && typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      // fall through to click()
    }
    input.click();
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    void processSelectedFiles(event.target.files, uploadModeRef.current);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    if (!canMutateMedia) return;

    const files = getImageFiles(event.dataTransfer.files);
    if (!files.length) {
      if ((event.dataTransfer.files?.length ?? 0) > 0) {
        setMediaFeedback({type: 'error', message: '这里只支持拖入图片文件。'});
      }
      return;
    }

    void processSelectedFiles(files, 'append');
  };

  const handleDropzoneKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    openFilePicker('append', event);
  };

  const handleClipboardImages = (clipboardData: DataTransfer | null) => {
    if (!canMutateMedia) return false;

    const files = getImageFiles(clipboardData?.files);
    if (files.length) {
      void processSelectedFiles(files, 'append');
      return true;
    }
    const itemFiles = Array.from(clipboardData?.items ?? [])
      .map((item) => (item.kind === 'file' && item.type.startsWith('image/') ? item.getAsFile() : null))
      .filter((item): item is File => Boolean(item));
    if (!itemFiles.length) return false;
    void processSelectedFiles(itemFiles, 'append');
    return true;
  };

  const handlePanelPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!handleClipboardImages(event.clipboardData)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    handleClipboardImagesRef.current = handleClipboardImages;
  }, [handleClipboardImages]);

  useEffect(() => {
    if (!isActive) return;
    const handleWindowPaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (!handleClipboardImagesRef.current(event.clipboardData)) return;
      event.preventDefault();
    };
    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [isActive]);

  const selectedMediaLabel = activeMedia?.label ?? segment.mediaLabel;
  const selectedMediaPrompt = activeMedia?.prompt ?? segment.mediaPrompt ?? '';
  const mediaHintText = mediaItems.length
    ? `当前段已添加 ${mediaItems.length} 张素材。播放到这段时会自动轮播，当前选中的是第 ${safeSelectedMediaIndex + 1} 张。`
    : hasUploadedMedia
      ? `已加载本地图片：${selectedMediaLabel || '未命名素材'}。图片会先秒显预览，再后台转成可导出格式。`
      : hasRemoteMedia
        ? '当前正在使用远程图片链接。若链接失效，预览会跟着失效。'
        : '当前没有图片素材时，模板会继续使用图形占位或提示词逻辑。';

  return (
    <div
      className={`segment-card${isActive ? ' segment-card--active' : ''}`}
      onClick={handleCardClick}
      onFocusCapture={handleEditorFocusCapture}
      onMouseDownCapture={handleEditorMouseDownCapture}
    >
      <div className="segment-card__header">
        <div>
          <div className="segment-card__title">{segment.label}</div>
          <div className="segment-card__meta">约 {(segment.durationInFrames / fps).toFixed(1)} 秒 · {layoutLabelMap[segment.layout]} · 点击卡片或编辑表单即可定位预览</div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
          <button type="button" className="ghost" onClick={() => triggerPreviewJump()} data-stop-preview-jump="true">
            {isActive ? '当前正在预览' : '预览本段'}
          </button>
          <div className="segment-card__badge">{segment.navLabel}</div>
        </div>
      </div>

      <div className="field-grid field-grid--three">
        <label className="field">
          <span>导航文案</span>
          <input value={segment.navLabel} onChange={(event) => update('navLabel', event.target.value)} />
        </label>
        <label className="field">
          <span>时长（帧）</span>
          <input
            type="number"
            min={24}
            step={6}
            value={segment.durationInFrames}
            onChange={(event) => update('durationInFrames', Number(event.target.value) || 30)}
          />
        </label>
        <label className="field">
          <span>布局类型</span>
          <select value={segment.layout} onChange={(event) => update('layout', event.target.value as SegmentLayout)}>
            {layoutOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-grid field-grid--two">
        <label className="field">
          <span>动画节奏</span>
          <select value={segment.motionPreset} onChange={(event) => update('motionPreset', event.target.value as MotionPreset)}>
            {motionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>主视觉类型</span>
          <select value={segment.visualPreset} onChange={(event) => handleVisualPresetChange(event.target.value as VisualPreset)}>
            {visualOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span>主标题</span>
        <input value={segment.title} onChange={(event) => update('title', event.target.value)} />
      </label>
      <label className="field">
        <span>副标题</span>
        <input value={segment.subtitle} onChange={(event) => update('subtitle', event.target.value)} />
      </label>
      <label className="field">
        <span>底部结论</span>
        <input value={segment.bottomConclusion} onChange={(event) => update('bottomConclusion', event.target.value)} />
      </label>
      <label className="field">
        <span>口播段落</span>
        <textarea rows={4} value={segment.voiceoverText} onChange={(event) => update('voiceoverText', event.target.value)} />
      </label>
      <label className="field">
        <span>人话版结论（底部辅助）</span>
        <input value={segment.humanConclusion ?? ''} onChange={(event) => update('humanConclusion', event.target.value)} />
      </label>
      <label className="field">
        <span>英文副字幕（可选）</span>
        <textarea rows={3} value={segment.subtitleSecondaryText ?? ''} onChange={(event) => update('subtitleSecondaryText', event.target.value)} />
      </label>
      <div className="field-hint">
        {subtitleMode === 'single'
          ? '当前是单语模式，英文副字幕先保存，预览不展示。'
          : subtitleMode === 'bilingual-keywords'
            ? '当前是术语双语，英文内容会以紧凑 Key 样式出现。'
            : '当前是全程双语，英文副字幕会在底部安全区显示。'}
      </div>
      <label className="field">
        <span>左侧要点（每行一条）</span>
        <textarea rows={4} value={listToText(segment.points)} onChange={(event) => update('points', textToList(event.target.value))} />
      </label>

      {isStickSegment ? (
        <div
          style={{
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div className="panel__title" style={{marginBottom: 0}}>简笔动画配置</div>
          <div className="field-hint" style={{marginTop: 0}}>当前段落会优先渲染简笔模板；不填细节时，系统会按文案自动补全角色、对白和字幕。</div>

          <div className="segment-actions">
            <button type="button" onClick={resetStickSceneAuto} disabled={isInteractionDisabled}>按当前文案重置自动编排</button>
            <button type="button" className="ghost" onClick={syncStickTemplateToPreset} disabled={isInteractionDisabled}>同步为当前预设模板</button>
          </div>

          <div className="field-grid field-grid--two">
            <label className="field">
              <span>模板类型</span>
              <select value={stickScene.template} onChange={(event) => setStickTemplate(event.target.value as StickSceneConfig['template'])}>
                {stickTemplateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>背景风格</span>
              <select
                value={stickScene.backgroundStyle ?? 'plain'}
                onChange={(event) => updateStickScene({backgroundStyle: event.target.value as NonNullable<StickSceneConfig['backgroundStyle']>})}
              >
                {stickBackgroundOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="field-grid field-grid--two">
            <label className="field">
              <span>顶部字幕</span>
              <input value={stickScene.topCaption ?? ''} onChange={(event) => updateStickScene({topCaption: event.target.value})} />
            </label>
            <label className="field">
              <span>底部字幕</span>
              <input value={stickScene.bottomCaption ?? ''} onChange={(event) => updateStickScene({bottomCaption: event.target.value})} />
            </label>
          </div>

          <div className="field-grid field-grid--two">
            <label className="field">
              <span>人物关系</span>
              <select
                value={stickScene.relationship ?? ''}
                onChange={(event) => updateStickScene({relationship: (event.target.value || undefined) as StickSceneConfig['relationship']})}
              >
                <option value="">未指定</option>
                {stickRelationshipOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field--checkbox">
              <span>自动镜头</span>
              <input type="checkbox" checked={stickScene.autoCamera ?? true} onChange={(event) => updateStickScene({autoCamera: event.target.checked})} />
            </label>
          </div>

          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
            <div className="panel__title" style={{marginBottom: 0, fontSize: 16}}>角色</div>
            <div className="segment-actions" style={{marginTop: 0}}>
              <button type="button" className="ghost" onClick={addStickActor} disabled={isInteractionDisabled || stickScene.actors.length >= 3}>新增角色</button>
            </div>
          </div>

          {stickScene.actors.map((actor, actorIndex) => (
            <div key={actor.id} style={{borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,16,28,0.34)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
                <div className="segment-card__badge">角色 {actorIndex + 1}</div>
                <button type="button" className="ghost" onClick={() => removeStickActor(actorIndex)} disabled={isInteractionDisabled || stickScene.actors.length <= 1}>删除角色</button>
              </div>
              <div className="field-grid field-grid--three">
                <label className="field">
                  <span>名称</span>
                  <input value={actor.name ?? ''} onChange={(event) => updateStickActorAt(actorIndex, {name: event.target.value})} />
                </label>
                <label className="field">
                  <span>角色</span>
                  <select value={actor.role ?? 'other'} onChange={(event) => updateStickActorAt(actorIndex, {role: event.target.value as StickActorConfig['role']})}>
                    {stickRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>站位</span>
                  <select value={actor.position ?? 'center'} onChange={(event) => updateStickActorAt(actorIndex, {position: event.target.value as StickActorConfig['position']})}>
                    {stickPositionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="field-grid field-grid--three">
                <label className="field">
                  <span>情绪</span>
                  <select value={actor.emotion ?? 'neutral'} onChange={(event) => updateStickActorAt(actorIndex, {emotion: event.target.value as StickActorConfig['emotion']})}>
                    {stickEmotionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>动作</span>
                  <select value={actor.pose ?? 'stand'} onChange={(event) => updateStickActorAt(actorIndex, {pose: event.target.value as StickActorConfig['pose']})}>
                    {stickPoseOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>配件</span>
                  <select value={actor.accessory ?? 'none'} onChange={(event) => updateStickActorAt(actorIndex, {accessory: event.target.value as StickActorConfig['accessory']})}>
                    {stickAccessoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="field-grid field-grid--two">
                <label className="field">
                  <span>线条颜色</span>
                  <input value={actor.color ?? ''} onChange={(event) => updateStickActorAt(actorIndex, {color: event.target.value})} placeholder="#F3FAFF" />
                </label>
                <label className="field">
                  <span>强调颜色</span>
                  <input value={actor.accentColor ?? ''} onChange={(event) => updateStickActorAt(actorIndex, {accentColor: event.target.value})} placeholder="#6CAEFF" />
                </label>
              </div>
            </div>
          ))}

          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
            <div className="panel__title" style={{marginBottom: 0, fontSize: 16}}>对白 / 气泡</div>
            <div className="segment-actions" style={{marginTop: 0}}>
              <button
                type="button"
                className="ghost"
                onClick={alignStickBubblesToVoiceoverCues}
                disabled={isInteractionDisabled || !(segment.cuePointsSec?.length && (stickScene.bubbles?.length ?? 0) > 0)}
                title="用口播对齐生成的动画点（cuePoints）来分配对白出现时间"
              >
                按口播节奏对齐
              </button>
              <button type="button" className="ghost" onClick={addStickBubble} disabled={isInteractionDisabled || (stickScene.bubbles?.length ?? 0) >= 6}>新增对白</button>
            </div>
          </div>

          {(stickScene.bubbles ?? []).map((bubble, bubbleIndex) => {
            const generatedBeat = buildBeatFromBubble(bubble, bubbleIndex);
            const replaceableBeatIndex = findNearbyBubbleBeatIndex(stickScene.beats || [], generatedBeat);
            const canGenerateBeat = (stickScene.beats?.length ?? 0) < 8 || replaceableBeatIndex >= 0;
            const generationActionLabel = replaceableBeatIndex >= 0 ? 'Replace Beat' : 'Generate Beat';

            return (
            <div key={`${bubble.actorId}-${bubbleIndex}-${bubble.startFrame}`} style={{borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,16,28,0.34)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
                <div className="segment-card__badge">对白 {bubbleIndex + 1}</div>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => createBeatFromBubble(bubbleIndex)}
                    disabled={isInteractionDisabled || !canGenerateBeat}
                    title={replaceableBeatIndex >= 0 ? 'Will replace the nearest auto beat for this actor' : 'Generate a beat from this bubble'}
                  >
                    {generationActionLabel}
                  </button>
                  <button type="button" className="ghost" onClick={() => removeStickBubble(bubbleIndex)} disabled={isInteractionDisabled}>删除对白</button>
                </div>
              </div>
              <div className="field-grid field-grid--three">
                <label className="field">
                  <span>归属角色</span>
                  <select value={bubble.actorId} onChange={(event) => updateStickBubbleAt(bubbleIndex, {actorId: event.target.value})}>
                    {stickScene.actors.map((actor) => (
                      <option key={actor.id} value={actor.id}>
                        {actor.name || actor.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>语气</span>
                  <select value={bubble.tone ?? 'say'} onChange={(event) => updateStickBubbleAt(bubbleIndex, {tone: event.target.value as StickBubbleConfig['tone']})}>
                    {stickBubbleToneOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field field--checkbox">
                  <span>强调</span>
                  <input type="checkbox" checked={bubble.emphasis ?? false} onChange={(event) => updateStickBubbleAt(bubbleIndex, {emphasis: event.target.checked})} />
                </label>
              </div>
              <label className="field">
                <span>对白内容</span>
                <textarea rows={3} value={bubble.text} onChange={(event) => updateStickBubbleAt(bubbleIndex, {text: event.target.value})} />
              </label>
              <div className="field-grid field-grid--two">
                <label className="field">
                  <span>开始帧</span>
                  <input type="number" min={0} value={bubble.startFrame} onChange={(event) => updateStickBubbleAt(bubbleIndex, {startFrame: Number(event.target.value) || 0})} />
                </label>
                <label className="field">
                  <span>持续帧数</span>
                  <input type="number" min={1} value={bubble.durationInFrames} onChange={(event) => updateStickBubbleAt(bubbleIndex, {durationInFrames: Math.max(1, Number(event.target.value) || 1)})} />
                </label>
              </div>
            </div>
            );
          })}

          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
            <div>
              <div className="panel__title" style={{marginBottom: 0, fontSize: 16}}>Beats</div>
              <div className="field-hint" style={{marginTop: 4}}>Assign turn, nod, shake, enter, exit, question, or exclamation to any actor.</div>
            </div>
            <div className="segment-actions" style={{marginTop: 0}}>
              <button type="button" className="ghost" onClick={applyAdaptiveStickBeatPreset} disabled={isInteractionDisabled}>按模板预设</button>
              <button type="button" className="ghost" onClick={snapStickBeatsToBubbles} disabled={isInteractionDisabled || !(stickScene.beats?.length && stickScene.bubbles?.length)}>吸附到对白</button>
              {stickBeatPresetOptions.map((preset) => (
                <button key={preset.value} type="button" className="ghost" onClick={() => applyStickBeatPreset(preset.value)} disabled={isInteractionDisabled}>
                  {preset.label}
                </button>
              ))}
              <button type="button" className="ghost" onClick={addStickBeat} disabled={isInteractionDisabled || (stickScene.beats?.length ?? 0) >= 8}>Add Beat</button>
            </div>
          </div>

          {(stickScene.beats ?? []).map((beat, beatIndex) => {
            const isSymbolBeat = beat.type === 'question' || beat.type === 'exclamation';
            return (
              <div key={`${beat.id}-${beatIndex}`} style={{borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,16,28,0.34)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
                  <div className="segment-card__badge">Beat {beatIndex + 1}</div>
                  <button type="button" className="ghost" onClick={() => removeStickBeat(beatIndex)} disabled={isInteractionDisabled}>Remove Beat</button>
                </div>

                <div className="field-grid field-grid--three">
                  <label className="field">
                    <span>Actor</span>
                    <select value={beat.actorId ?? ''} onChange={(event) => updateStickBeatAt(beatIndex, {actorId: event.target.value || undefined})}>
                      {stickScene.actors.map((actor) => (
                        <option key={actor.id} value={actor.id}>
                          {actor.name || actor.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Type</span>
                    <select value={(beat.type as typeof stickBeatTypeOptions[number]['value']) ?? 'turn'} onChange={(event) => updateStickBeatAt(beatIndex, {type: event.target.value as StickBeatConfig['type'], text: event.target.value === 'question' ? (beat.text || '?') : event.target.value === 'exclamation' ? (beat.text || '!') : beat.text})}>
                      {stickBeatTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Intensity</span>
                    <input type="number" min={0.5} max={2} step={0.1} value={typeof beat.value === 'number' ? beat.value : 1} onChange={(event) => updateStickBeatAt(beatIndex, {value: Math.max(0.5, Math.min(2, Number(event.target.value) || 1))})} />
                  </label>
                </div>

                <div className="field-grid field-grid--three">
                  <label className="field">
                    <span>Start Frame</span>
                    <input type="number" min={0} value={beat.startFrame} onChange={(event) => updateStickBeatAt(beatIndex, {startFrame: Math.max(0, Number(event.target.value) || 0)})} />
                  </label>
                  <label className="field">
                    <span>Duration</span>
                    <input type="number" min={1} value={beat.durationInFrames ?? 18} onChange={(event) => updateStickBeatAt(beatIndex, {durationInFrames: Math.max(1, Number(event.target.value) || 1)})} />
                  </label>
                  <label className="field">
                    <span>ID</span>
                    <input value={beat.id} onChange={(event) => updateStickBeatAt(beatIndex, {id: event.target.value})} />
                  </label>
                </div>

                <label className="field">
                  <span>{isSymbolBeat ? 'Symbol Text (Optional)' : 'Extra Text (Optional)'}</span>
                  <input value={beat.text ?? ''} placeholder={beat.type === 'question' ? '?' : beat.type === 'exclamation' ? '!' : 'hook'} onChange={(event) => updateStickBeatAt(beatIndex, {text: event.target.value})} />
                </label>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="media-panel" data-stop-preview-jump="true" tabIndex={0} onClick={(event) => event.stopPropagation()} onPaste={handlePanelPaste}>
        <div className="media-panel__preview">
          <div className="media-panel__badge">{mediaSourceLabel}</div>
          {mediaItems.length > 1 ? <div className="media-panel__counter">{safeSelectedMediaIndex + 1} / {mediaItems.length}</div> : null}
          {previewUrl ? (
            <img className="media-panel__image" src={previewUrl} alt={selectedMediaLabel || segment.title} />
          ) : (
            <div className="media-panel__empty">
              <div className="media-panel__empty-title">还没有图片素材</div>
              <div className="media-panel__empty-text">{selectedMediaPrompt ? '当前素材只有提示词，还没有实际图片。' : '可以上传本地图片、拖拽图片、直接粘贴图片，或者填一个远程图片链接。'}</div>
            </div>
          )}
        </div>

        <div className="media-panel__controls">
          <div className="media-strip">
            <div className="media-strip__header">
              <div>
                <div className="media-strip__title">当前段素材库</div>
                <div className="media-strip__meta">支持上传 / 拖拽 / 粘贴 / 链接；一段可放多张，预览会自动轮播。</div>
              </div>
              <div className="segment-card__badge">{mediaItems.length ? `${mediaItems.length} 张` : '0 张'}</div>
            </div>

            <div className="media-strip__list">
              {mediaItems.length ? (
                mediaItems.map((item, index) => (
                  <button key={item.id} type="button" className={`media-thumb${index === safeSelectedMediaIndex ? ' media-thumb--active' : ''}`} onClick={() => focusMediaIndex(index)}>
                    <div className="media-thumb__visual">
                      {item.url ? <img className="media-thumb__image" src={item.url} alt={item.label} /> : <div className="media-thumb__placeholder">提示词</div>}
                      <span className="media-thumb__index">{index + 1}</span>
                    </div>
                    <div className="media-thumb__name">{item.label || `素材 ${index + 1}`}</div>
                  </button>
                ))
              ) : (
                <div className="media-strip__empty">暂无素材。上传后会自动加入这一段的轮播列表。</div>
              )}
            </div>
          </div>

          <div className="field-grid field-grid--two">
            <label className="field">
              <span>素材说明</span>
              <input value={selectedMediaLabel} onChange={(event) => updateSelectedMediaLabel(event.target.value)} />
            </label>
            <label className="field">
              <span>远程图片 URL</span>
              <input
                value={remoteUrlDraft}
                placeholder="可贴直链图片 URL；如果用本地上传，这里可以留空"
                onChange={(event) => {
                  setRemoteUrlDraft(event.target.value);
                  setMediaFeedback(null);
                }}
              />
            </label>
          </div>

      <div className="segment-actions">
        <button type="button" className="ghost" onClick={openVoiceoverPicker} disabled={!canUploadVoiceover}>
          {isVoiceoverUploading ? '本段识别中...' : '上传本段口播'}
        </button>
        <button type="button" onClick={(event) => openFilePicker('append', event)} disabled={!canMutateMedia}>
          {mediaItems.length ? '新增图片素材' : '上传图片素材'}
        </button>
            <button type="button" className="ghost" onClick={(event) => openFilePicker('replace', event)} disabled={!mediaItems.length || !canMutateMedia}>
              替换当前素材
            </button>
            <button type="button" className="ghost" onClick={() => applyRemoteMedia(mediaItems.length ? 'replace' : 'append')} disabled={!canApplyRemoteMedia}>
              {mediaItems.length ? '链接替换当前' : '应用图片链接'}
            </button>
            <button type="button" className="ghost" onClick={deleteCurrentMedia} disabled={(!mediaItems.length && !segment.mediaUrl && !segment.mediaPrompt) || !canMutateMedia}>
              删除当前素材
            </button>
          </div>

          <div
            className={`upload-dropzone${isDragOver ? ' upload-dropzone--active' : ''}${canMutateMedia ? '' : ' upload-dropzone--disabled'}`}
            role="button"
            tabIndex={canMutateMedia ? 0 : -1}
            aria-disabled={!canMutateMedia}
            onClick={(event) => openFilePicker('append', event)}
            onKeyDown={handleDropzoneKeyDown}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={handleDrop}
          >
            方式1：点击这里或上面的按钮选择图片。<br />
            方式2：把图片直接拖到这里。<br />
            方式3：先点一下素材面板，再直接 Ctrl+V 粘贴图片。
          </div>

          <div className="upload-fallback-row">
            <span>备用选择</span>
            <input type="file" accept="image/*" multiple onChange={handleUpload} disabled={!canMutateMedia} />
          </div>

          <div className="field-hint">{mediaHintText}</div>
          {mediaFeedback ? (
            <div
              className={`field-hint field-hint--status${mediaFeedback.type === 'error' ? ' field-hint--error' : ''}`}
              role={mediaFeedback.type === 'error' ? 'alert' : 'status'}
              aria-live={mediaFeedback.type === 'error' ? 'assertive' : 'polite'}
            >
              {mediaFeedback.message}
            </div>
          ) : null}

          <input ref={voiceoverUploadRef} className="file-input-native" type="file" accept="audio/*,video/*" onChange={handleSegmentVoiceoverUpload} disabled={!canUploadVoiceover} />

          <label className="field">
            <span>主视觉提示词</span>
            <textarea rows={3} value={selectedMediaPrompt} onChange={(event) => updateSelectedMediaPrompt(event.target.value)} />
          </label>
        </div>
      </div>

      <div className="field-grid field-grid--two">
        <label className="field">
          <span>证据文案</span>
          <input value={segment.evidenceText ?? ''} onChange={(event) => update('evidenceText', event.target.value)} />
        </label>
        <label className="field field--checkbox">
          <span>需要 GitHub / README 证据</span>
          <input type="checkbox" checked={segment.needsGithubEvidence ?? false} onChange={(event) => update('needsGithubEvidence', event.target.checked)} />
        </label>
      </div>

      {typeof segment.audioStartSec === 'number' && typeof segment.audioEndSec === 'number' ? (
        <div className="field-hint">
          口播对齐：{formatSeconds(segment.audioStartSec)} - {formatSeconds(segment.audioEndSec)} · 动画点 {segment.cuePointsSec?.length ?? 0} 个
        </div>
      ) : null}

      <input ref={uploadRef} className="file-input-native" type="file" accept="image/*" multiple onChange={handleUpload} />
    </div>
  );
};

export const App: React.FC = () => {
  const [config, setConfig] = useState<AccountProjectConfig>(() => readStoredConfig());
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [importDraft, setImportDraft] = useState('');
  const [importFeedback, setImportFeedback] = useState<FeedbackState | null>(null);
  const [publishCopyFeedback, setPublishCopyFeedback] = useState<FeedbackState | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [voiceoverAlignState, setVoiceoverAlignState] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [voiceoverAlignFeedback, setVoiceoverAlignFeedback] = useState<VoiceoverAlignFeedback | null>(null);
  const [segmentVoiceoverUploadingIndex, setSegmentVoiceoverUploadingIndex] = useState<number | null>(null);
  const [renderState, setRenderState] = useState<'idle' | 'processing' | 'done' | 'error' | 'canceled'>('idle');
  const [renderMessage, setRenderMessage] = useState('');
  const [renderDetails, setRenderDetails] = useState<string[]>([]);
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderPhaseText, setRenderPhaseText] = useState('');
  const [renderOutputPath, setRenderOutputPath] = useState('');
  const [renderEncoderMode, setRenderEncoderMode] = useState<RenderEncoderMode>('nvenc');
  const [renderMode, setRenderMode] = useState<RenderMode>('full');
  const [importSkinCard, setImportSkinCard] = useState<ImportSkinCardState | null>(null);
  const [editorSessionKey, setEditorSessionKey] = useState(0);
  const lastRenderRequestRef = useRef<RenderRequestSnapshot | null>(null);
  const isVoiceoverProcessing = voiceoverAlignState === 'processing';
  const isRenderProcessing = renderState === 'processing';
  const isEditorBusy = isVoiceoverProcessing || isRenderProcessing;
  const hasImportDraft = importDraft.trim().length > 0;
  const canRetryLastRender = !isRenderProcessing && Boolean(lastRenderRequestRef.current) && (renderState === 'error' || renderState === 'canceled');

  const updateRenderFeedback = (message: string, details: Array<string | null | undefined> = []) => {
    setRenderMessage(message);
    setRenderDetails(compactRenderDetails(details));
  };
  const voiceoverAlignMessage = voiceoverAlignFeedback?.message || '';
  const voiceoverAlignDetails = voiceoverAlignFeedback?.details || [];

  const updateVoiceoverAlignFeedback = (message: string, details: Array<string | null | undefined> = []) => {
    setVoiceoverAlignFeedback({message, details: compactVoiceoverDetails(details)});
  };
  const canOpenOutputDir = renderState === 'done' && Boolean(renderOutputPath);
  const activeVisualSkin = normalizeAccountVisualSkin(config.meta.visualSkin);
  const skinRecommendation = useMemo(() => recommendAccountVisualSkin(config), [config]);
  const recommendedSkinOption =
    accountVisualSkinOptions.find((item) => item.value === skinRecommendation.skin) ?? accountVisualSkinOptions[0];
  const currentSkinOption =
    accountVisualSkinOptions.find((item) => item.value === activeVisualSkin) ?? accountVisualSkinOptions[0];
  const importCardSkinOption = importSkinCard
    ? accountVisualSkinOptions.find((item) => item.value === importSkinCard.recommendedSkin) ?? recommendedSkinOption
    : null;
  const isImportCardRecommendationApplied = importSkinCard ? activeVisualSkin === importSkinCard.recommendedSkin : false;
  const playerRef = useRef<PlayerRef>(null);
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  const voiceoverUploadRef = useRef<HTMLInputElement | null>(null);
  const segmentedVoiceoverUploadRef = useRef<HTMLInputElement | null>(null);
  const batchPreviewTimersRef = useRef<number[]>([]);
  const latestProjectRef = useRef<AccountProjectConfig>(config);
  const previewAudioUrlMapRef = useRef<Record<string, string>>({});
  const previewAudioDataUrlMapRef = useRef<Record<string, string>>({});
  const ipLogoUploadRef = useRef<HTMLInputElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const beatTimelineRef = useRef<HTMLDivElement | null>(null);
  const [draggingBeat, setDraggingBeat] = useState<{segmentIndex: number; beatId: string} | null>(null);
  const [beatSnapGrid, setBeatSnapGrid] = useState<2 | 5 | 10>(5);
  const [dragSnapActive, setDragSnapActive] = useState(false);

  useEffect(() => {
    latestProjectRef.current = config;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeConfigForStorage(config)));
      setSaveState('saved');
      const timer = window.setTimeout(() => setSaveState('idle'), 1200);
      return () => window.clearTimeout(timer);
    } catch {
      setSaveState('error');
    }
  }, [config]);

  useEffect(() => {
    if (config.meta.publishTitle || config.meta.publishDescription || config.meta.publishTopics) {
      return;
    }

    const inferred = inferPublishCopywriting(config);
    if (!inferred) {
      return;
    }

    setConfig((current) => ({...current, meta: {...current.meta, ...inferred}}));
  }, []);

  const revokePreviewAudioUrl = (key: string) => {
    const current = previewAudioUrlMapRef.current[key];
    if (current?.startsWith('blob:')) {
      URL.revokeObjectURL(current);
    }
    delete previewAudioUrlMapRef.current[key];
    delete previewAudioDataUrlMapRef.current[key];
  };

  const createPreviewAudioUrl = (key: string, file: File, dataUrl?: string) => {
    revokePreviewAudioUrl(key);
    const url = URL.createObjectURL(file);
    previewAudioUrlMapRef.current[key] = url;
    if (dataUrl) {
      previewAudioDataUrlMapRef.current[key] = dataUrl;
    }
    return url;
  };

  const buildRenderProjectWithVoiceover = (project: AccountProjectConfig) => {
    const nextProject = cloneProjectConfig(project);
    nextProject.meta.previewAudioMuted = false;

    const globalAudioDataUrl = previewAudioDataUrlMapRef.current.__global__;
    if (globalAudioDataUrl) {
      nextProject.meta.previewAudioUrl = globalAudioDataUrl;
      nextProject.meta.previewAudioEnabled = true;
    }

    nextProject.segments = nextProject.segments.map((segment) => {
      const dataUrl = previewAudioDataUrlMapRef.current[`segment:${segment.id}`];
      return dataUrl
        ? {
            ...segment,
            voiceoverPreviewUrl: dataUrl,
          }
        : segment;
    });

    return nextProject;
  };

  const commitProject = (project: AccountProjectConfig) => {
    const nextProject = cloneProjectConfig(project);
    nextProject.meta.width = normalizeCompositionWidth(nextProject.meta.width, defaultAccountProject.meta.width);
    nextProject.meta.height = normalizeCompositionHeight(nextProject.meta.height, defaultAccountProject.meta.height);
    nextProject.meta.fps = normalizeCompositionFps(nextProject.meta.fps, defaultAccountProject.meta.fps);
    latestProjectRef.current = nextProject;
    flushSync(() => {
      setConfig(nextProject);
    });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeConfigForStorage(nextProject)));
    } catch {}
    return nextProject;
  };

  const handleApplyVisualSkin = (visualSkin: AccountVisualSkin) => {
    commitProject(applyVisualSkinToProject(latestProjectRef.current, visualSkin));
  };

  const handleRecommendVisualSkin = () => {
    handleApplyVisualSkin(skinRecommendation.skin);
  };

  const dismissImportSkinCard = () => {
    setImportSkinCard(null);
  };

  const scrollSidebarToTop = () => {
    window.setTimeout(() => {
      sidebarRef.current?.scrollTo({top: 0, behavior: 'smooth'});
    }, 0);
  };

  const resetProjectScopedUiState = () => {
    setVoiceoverAlignState('idle');
    setVoiceoverAlignFeedback(null);
    setSegmentVoiceoverUploadingIndex(null);
    setRenderState('idle');
    setRenderMessage('');
    setRenderDetails([]);
    setRenderJobId(null);
    setRenderProgress(0);
    setRenderPhaseText('');
    setRenderOutputPath('');
    lastRenderRequestRef.current = null;
  };

  const importProjectWithRecommendationCard = (project: AccountProjectConfig, sourceLabel: string) => {
    const nextProject = cloneProjectConfig(project);
    const hasExplicitSkin = hasExplicitProjectVisualSkin(nextProject.meta.visualSkin);
    const committedProject = hasExplicitSkin ? ensureProjectVisualSkin(nextProject) : nextProject;
    const recommendation = recommendAccountVisualSkin(committedProject, {preferExplicitHint: hasExplicitSkin});

    resetProjectScopedUiState();
    commitProject(committedProject);
    setImportSkinCard({
      sourceLabel,
      projectName: committedProject.meta.projectName,
      recommendedSkin: recommendation.skin,
      reasons: recommendation.reasons,
      hasExplicitSkin,
    });
    setEditorSessionKey((value) => value + 1);
    setActiveSegmentIndex(0);
    scrollSidebarToTop();
    return committedProject;
  };

  const handleImportDraftChange = (value: string) => {
    setImportDraft(value);
    setImportFeedback(null);
  };

  const handleApplyImportSkinCard = () => {
    if (!importSkinCard) {
      return;
    }

    handleApplyVisualSkin(importSkinCard.recommendedSkin);
  };

  const attachGlobalPreviewAudio = (file: File, dataUrl?: string) => {
    revokePreviewAudioUrl('__global__');
    for (const segment of latestProjectRef.current.segments) {
      revokePreviewAudioUrl(`segment:${segment.id}`);
    }

    const previewUrl = createPreviewAudioUrl('__global__', file, dataUrl);
    return commitProject({
      ...latestProjectRef.current,
      meta: {
        ...latestProjectRef.current.meta,
        previewAudioUrl: previewUrl,
        previewAudioName: file.name,
        previewAudioEnabled: true,
        previewAudioMuted: false,
      },
      segments: latestProjectRef.current.segments.map((segment) => ({
        ...segment,
        voiceoverPreviewUrl: undefined,
        voiceoverPreviewName: undefined,
      })),
    });
  };

  const attachSegmentPreviewAudioFiles = (
    files: Array<{segmentId: string; file: File; dataUrl?: string}>,
    options?: {clearOtherSegments?: boolean; clearGlobal?: boolean}
  ) => {
    if (options?.clearGlobal !== false) {
      revokePreviewAudioUrl('__global__');
    }

    const incomingIds = new Set(files.map((item) => item.segmentId));
    if (options?.clearOtherSegments) {
      for (const segment of latestProjectRef.current.segments) {
        if (!incomingIds.has(segment.id)) {
          revokePreviewAudioUrl(`segment:${segment.id}`);
        }
      }
    }

    const previewUrlMap = new Map<string, {url: string; name: string}>();
    for (const item of files) {
      previewUrlMap.set(item.segmentId, {
        url: createPreviewAudioUrl(`segment:${item.segmentId}`, item.file, item.dataUrl),
        name: item.file.name,
      });
    }

    return commitProject({
      ...latestProjectRef.current,
      meta: {
        ...latestProjectRef.current.meta,
        previewAudioUrl: undefined,
        previewAudioName: undefined,
        previewAudioEnabled: true,
        previewAudioMuted: false,
      },
      segments: latestProjectRef.current.segments.map((segment) => {
        const preview = previewUrlMap.get(segment.id);
        if (preview) {
          return {
            ...segment,
            voiceoverPreviewUrl: preview.url,
            voiceoverPreviewName: preview.name,
          };
        }

        if (options?.clearOtherSegments) {
          return {
            ...segment,
            voiceoverPreviewUrl: undefined,
            voiceoverPreviewName: undefined,
          };
        }

        return segment;
      }),
    });
  };

  const durationInFrames = useMemo(() => getProjectDuration(config), [config]);
  const previewAspectRatio = useMemo(() => `${config.meta.width} / ${config.meta.height}`, [config.meta.width, config.meta.height]);
  const previewFormatText = useMemo(
    () => `${config.meta.width}×${config.meta.height} / ${config.meta.fps}fps`,
    [config.meta.width, config.meta.height, config.meta.fps]
  );
  const activeSegment = config.segments[activeSegmentIndex] ?? config.segments[0];
  const activeSegmentIsStick = isStickVisualPreset(activeSegment?.visualPreset);
  const activeSegmentStickScene = useMemo(
    () => (activeSegment && activeSegmentIsStick ? normalizeStickScene(activeSegment) : null),
    [activeSegment, activeSegmentIsStick]
  );
  const activeStickVisualPreset: StickVisualPreset = activeSegment && isStickVisualPreset(activeSegment.visualPreset) ? activeSegment.visualPreset : 'stick-dialogue';
  const activeStickVisualPresetLabel = stickVisualPresetOptions.find((option) => option.value === activeStickVisualPreset)?.label ?? '简笔对话';
  const activeSegmentStartFrame = useMemo(
    () => config.segments.slice(0, activeSegmentIndex).reduce((sum, segment) => sum + segment.durationInFrames, 0),
    [activeSegmentIndex, config.segments]
  );
  const activeSegmentEndFrame = activeSegmentStartFrame + Math.max(0, (activeSegment?.durationInFrames ?? 1) - 1);
  const activeDraggedBeat = useMemo(() => {
    if (!draggingBeat || draggingBeat.segmentIndex !== activeSegmentIndex) {
      return null;
    }

    return activeSegmentStickScene?.beats?.find((beat) => beat.id === draggingBeat.beatId) ?? null;
  }, [activeSegmentIndex, activeSegmentStickScene, draggingBeat]);
  const previewSignature = useMemo(
    () => config.segments.map((segment) => `${segment.id}:${segment.durationInFrames}:${segment.voiceoverPreviewName || ''}`).join('|'),
    [config.segments]
  );
  const playerKey = useMemo(
    () => [config.meta.projectName, config.meta.width, config.meta.height, config.meta.fps, durationInFrames, config.meta.previewAudioName || '', previewSignature].join(':'),
    [config.meta.projectName, config.meta.width, config.meta.height, config.meta.fps, durationInFrames, config.meta.previewAudioName, previewSignature]
  );

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    const handleFullscreenChange = () => {
      setIsPlayerFullscreen(player.isFullscreen());
    };

    player.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      player.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [playerKey]);

  useEffect(() => {
    if (!isPlayerFullscreen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.code !== 'Space' && event.key !== 'Spacebar') {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName?.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable) {
          return;
        }
      }

      event.preventDefault();
      playerRef.current?.toggle();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlayerFullscreen]);

  const updateBeatFrameFromClientX = (
    clientX: number,
    segmentIndex: number,
    beatId: string,
    options?: {shiftKey?: boolean}
  ) => {
    const timeline = beatTimelineRef.current;
    const segment = latestProjectRef.current.segments[segmentIndex];
    if (!timeline || !segment) {
      return;
    }

    const rect = timeline.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    let nextStartFrame = Math.round(ratio * Math.max(0, segment.durationInFrames - 1));

    if (options?.shiftKey) {
      nextStartFrame = Math.round(nextStartFrame / beatSnapGrid) * beatSnapGrid;
      nextStartFrame = Math.max(0, Math.min(Math.max(0, segment.durationInFrames - 1), nextStartFrame));
    }

    updateSegmentStickScene(segmentIndex, (currentScene) => ({
      ...currentScene,
      beats: (currentScene.beats || [])
        .map((beat) => (beat.id === beatId ? {...beat, startFrame: nextStartFrame} : beat))
        .sort((left, right) => left.startFrame - right.startFrame),
    }));
  };

  useEffect(() => {
    if (!draggingBeat) {
      return;
    }

    const handleMove = (event: MouseEvent) => {
      setDragSnapActive(event.shiftKey);
      updateBeatFrameFromClientX(event.clientX, draggingBeat.segmentIndex, draggingBeat.beatId, {shiftKey: event.shiftKey});
    };

    const handleUp = () => {
      setDraggingBeat(null);
      setDragSnapActive(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [beatSnapGrid, draggingBeat]);

  useEffect(() => {
    if (!renderJobId) {
      return;
    }

    let disposed = false;
    let isSyncing = false;
    let currentController: AbortController | null = null;
    let statusReadFailureCount = 0;
    const maxStatusReadFailures = 3;

    const syncRenderStatus = async () => {
      if (disposed || isSyncing) {
        return;
      }

      isSyncing = true;
      const controller = new AbortController();
      currentController = controller;

      try {
        const response = await fetch(`/api/render-status?jobId=${encodeURIComponent(renderJobId)}`, {signal: controller.signal});
        const result = (await response.json()) as RenderJobSnapshot & {error?: string; details?: string};
        if (!response.ok || result.error) {
          throw new Error(result.details || result.error || '读取渲染状态失败');
        }

        if (disposed || controller.signal.aborted) {
          return;
        }

        statusReadFailureCount = 0;
        setRenderProgress(Math.max(0, Math.min(1, result.progress ?? 0)));
        setRenderPhaseText(result.phaseText || '处理中');
        updateRenderFeedback(result.message || '处理中', buildRenderJobDetails(result));
        if (result.outputPath) {
          setRenderOutputPath(result.outputPath);
        }

        if (result.status === 'done') {
          setRenderState('done');
          setRenderPhaseText(result.phaseText || '已完成');
          setRenderJobId(null);
          return;
        }

        if (result.status === 'canceled') {
          setRenderState('canceled');
          setRenderPhaseText(result.phaseText || '已取消');
          setRenderJobId(null);
          setRenderOutputPath('');
          updateRenderFeedback(result.message || '渲染已取消', buildRenderJobDetails(result));
          return;
        }

        if (result.status === 'error') {
          setRenderState('error');
          setRenderPhaseText(result.phaseText || '导出失败');
          setRenderJobId(null);
          setRenderOutputPath('');
          updateRenderFeedback(result.error || result.message || 'MP4 导出失败', buildRenderJobDetails(result));
        }
      } catch (error) {
        if (disposed || controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
          return;
        }

        statusReadFailureCount += 1;
        const errorMessage = error instanceof Error ? error.message : '读取渲染状态失败';
        if (statusReadFailureCount < maxStatusReadFailures) {
          setRenderState('processing');
          setRenderPhaseText('状态同步重试中');
          updateRenderFeedback(`读取渲染状态失败，正在自动重试（${statusReadFailureCount}/${maxStatusReadFailures}）`, [errorMessage]);
          return;
        }

        setRenderState('error');
        setRenderPhaseText('状态读取失败');
        setRenderJobId(null);
        setRenderOutputPath('');
        updateRenderFeedback(errorMessage, [`连续 ${statusReadFailureCount} 次读取渲染状态失败，已停止自动轮询。`]);
      } finally {
        if (currentController === controller) {
          currentController = null;
        }
        isSyncing = false;
      }
    };

    void syncRenderStatus();
    const timer = window.setInterval(() => {
      void syncRenderStatus();
    }, 1200);

    return () => {
      disposed = true;
      currentController?.abort();
      window.clearInterval(timer);
    };
  }, [renderJobId]);



  const updateSegment = (index: number, nextSegment: SegmentConfig) => {
    setConfig((current) => {
      const nextSegments = [...current.segments];
      nextSegments[index] = nextSegment;
      return {...current, segments: nextSegments};
    });
  };

  const updateSegmentStickScene = (index: number, updater: (current: StickSceneConfig) => StickSceneConfig) => {
    setConfig((current) => {
      const targetSegment = current.segments[index];
      if (!targetSegment) {
        return current;
      }

      const nextSegments = [...current.segments];
      nextSegments[index] = {
        ...targetSegment,
        stickScene: updater(normalizeStickScene(targetSegment)),
      };
      return {...current, segments: nextSegments};
    });
  };

  const seekToSegment = (index: number, offsetFrames = 0) => {
    const from = config.segments.slice(0, index).reduce((sum, segment) => sum + segment.durationInFrames, 0);
    const segmentDuration = config.segments[index]?.durationInFrames ?? 0;
    const safeOffset = Math.max(0, Math.min(offsetFrames, Math.max(0, segmentDuration - 1)));
    playerRef.current?.pause();
    playerRef.current?.seekTo(from + safeOffset);
  };

  const jumpToSegment = (index: number, offsetFrames = 0, options?: {preserveBatchPreview?: boolean}) => {
    if (!options?.preserveBatchPreview) {
      clearBatchPreviewTimers();
    }

    setActiveSegmentIndex(index);
    seekToSegment(index, offsetFrames);
  };

  const clearBatchPreviewTimers = () => {
    batchPreviewTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    batchPreviewTimersRef.current = [];
  };

  const bulkConvertSegmentsToStick = (scope: 'all' | 'following') => {
    const startIndex = scope === 'following' ? activeSegmentIndex : 0;
    setConfig((current) => ({
      ...current,
      segments: current.segments.map((segment, index) => (index >= startIndex ? applyStickVisualPreset(segment, activeStickVisualPreset) : segment)),
    }));
    seekToSegment(activeSegmentIndex, 0);
  };

  const bulkConvertSegmentsToStickAuto = () => {
    setConfig((current) => ({
      ...current,
      segments: current.segments.map((segment, index) => {
        const id = segment.id || `segment-${index + 1}`;
        const preset: StickVisualPreset =
          id === 'hook' || id === 'p1' || id === 'p5'
            ? 'stick-narration'
            : id === 'p2'
              ? 'stick-dialogue'
              : id === 'p3'
                ? 'stick-conflict'
                : id === 'p4'
                  ? 'stick-compare'
                  : 'stick-dialogue';
        return applyStickVisualPreset(segment, preset);
      }),
    }));
    seekToSegment(activeSegmentIndex, 0);
  };

  const previewSegmentsInOrder = (segmentIndexes: number[]) => {
    clearBatchPreviewTimers();
    const uniqueIndexes = Array.from(new Set(segmentIndexes)).sort((a, b) => a - b);
    if (!uniqueIndexes.length) {
      return;
    }

    uniqueIndexes.forEach((segmentIndex, orderIndex) => {
      const timer = window.setTimeout(() => {
        jumpToSegment(segmentIndex, 0, {preserveBatchPreview: true});
      }, orderIndex * 1000);
      batchPreviewTimersRef.current.push(timer);
    });
  };

  useEffect(() => {
    return () => {
      clearBatchPreviewTimers();
      revokePreviewAudioUrl('__global__');
      Object.keys(previewAudioUrlMapRef.current).forEach((key) => revokePreviewAudioUrl(key));
    };
  }, []);

  const exportJson = async () => {
    const payload = JSON.stringify(stripPreviewAudioFromProject(config), null, 2);
    downloadTextFile(`${config.meta.projectName || 'project'}-account-template.json`, payload);
    await copyToClipboard(payload);
  };

  const exportTemplateJson = async () => {
    const payload = JSON.stringify(toTemplateConfig(config), null, 2);
    downloadTextFile(`${config.meta.projectName || 'project'}-prompt-template.json`, payload);
    await copyToClipboard(payload);
  };

  const copyPublishCopywriting = async () => {
    const title = (config.meta.publishTitle ?? '').trim();
    const description = (config.meta.publishDescription ?? '').trim();
    const topics = (config.meta.publishTopics ?? '').trim();
    let payload = [title, description, topics].filter(Boolean).join('\n').trim();

    if (!payload) {
      const inferred = inferPublishCopywriting(config);
      if (inferred) {
        setConfig((current) => ({...current, meta: {...current.meta, ...inferred}}));
        payload = [inferred.publishTitle, inferred.publishDescription, inferred.publishTopics].filter(Boolean).join('\n').trim();
      }
    }

    if (!payload) {
      setPublishCopyFeedback({type: 'error', message: '发布文案为空：请先填写发布标题/简介/话题。'});
      return;
    }

    const voiceoverScript = buildVoiceoverScript(config);
    const combined = [`${payload}`, voiceoverScript ? '\n口播脚本：\n' : '', voiceoverScript].filter(Boolean).join('');

    const ok = await copyToClipboard(combined);
    setPublishCopyFeedback(ok ? {type: 'success', message: '已复制发布文案 + 口播脚本到剪贴板。'} : {type: 'error', message: '复制失败：当前环境不允许写入剪贴板。'});
    window.setTimeout(() => setPublishCopyFeedback(null), 1800);
  };

  const requestVoiceoverAlignment = async (file: File, project: ReturnType<typeof buildSegmentVoiceoverProject> | {meta: {fps: number}; segments: Array<{id: string; label: string; voiceoverText: string}>}) => {
    const audioDataUrl = await readFileAsDataUrl(file);
    const audioBase64 = audioDataUrl.split(',')[1] ?? '';

    const response = await fetch('/api/align-voiceover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        audioBase64,
        language: 'zh',
        model: 'large-v3-turbo',
        device: 'cuda',
        computeType: 'float16',
        project
      })
    });

    const result = (await response.json()) as VoiceoverAlignResult;
    return ensureVoiceoverAlignResult(response, result, '口播对齐失败');
  };

  const mergeAlignmentIntoProject = (project: AccountProjectConfig, result: VoiceoverAlignResult, options?: {resetStartToZero?: boolean}) => {
    const fps = project.meta.fps;
    const tailPaddingFrames = Math.max(0, Math.ceil(fps * 0.9));
    const tailPaddingSec = tailPaddingFrames > 0 ? tailPaddingFrames / fps : 0;
    const alignedSegments = result.segments ?? [];
    const lastSegmentId =
      alignedSegments.reduce<{id: string; endSec: number} | null>((best, item) => {
        const endSec = Number(item.end_sec) || 0;
        if (!best || endSec > best.endSec) {
          return {id: item.id, endSec};
        }
        return best;
      }, null)?.id ?? null;

    let updatedCount = 0;
    const nextProject: AccountProjectConfig = {
      ...project,
      segments: project.segments.map((segment) => {
        const aligned = result.segments?.find((item) => item.id === segment.id);
        if (!aligned) {
          return segment;
        }

        const shouldPadTail = options?.resetStartToZero ? true : Boolean(lastSegmentId && aligned.id === lastSegmentId);
        const padFrames = shouldPadTail ? tailPaddingFrames : 0;
        const padSec = shouldPadTail ? tailPaddingSec : 0;
        const alignedStartSec = Number(aligned.start_sec) || 0;
        const alignedEndSec = Number(aligned.end_sec) || 0;
        const alignedDurationSec = Math.max(0, alignedEndSec - alignedStartSec);
        const alignedDurationFrames = Math.ceil(alignedDurationSec * fps);

        updatedCount += 1;
        return {
          ...segment,
          durationInFrames: Math.max(24, alignedDurationFrames + padFrames),
          audioStartSec: options?.resetStartToZero ? 0 : alignedStartSec,
          audioEndSec: options?.resetStartToZero ? alignedDurationSec + padSec : alignedEndSec + padSec,
          cuePointsSec: aligned.cue_points_sec ?? []
        };
      })
    };

    return {nextProject, updatedCount, totalFrames: getProjectDuration(nextProject)};
  };

  const applyAlignmentToSegments = (result: VoiceoverAlignResult, options?: {resetStartToZero?: boolean}) => {
    const merged = mergeAlignmentIntoProject(latestProjectRef.current, result, options);
    const nextProject = commitProject(merged.nextProject);
    return {
      ...merged,
      nextProject,
      totalFrames: getProjectDuration(nextProject),
    };
  };

  const startRenderJob = async (
    project: AccountProjectConfig,
    targetLabel: string,
    suggestedName: string,
    encoder: RenderEncoderMode = renderEncoderMode,
  ) => {
    if (isVoiceoverProcessing) {
      setRenderState('error');
      setRenderPhaseText('请稍候');
      setRenderOutputPath('');
      updateRenderFeedback('口播对齐仍在处理中，请完成后再导出。');
      return;
    }

    if (isRenderProcessing) {
      return;
    }

    if (hasPendingBlobMedia(project)) {
      setRenderState('error');
      setRenderPhaseText('请稍候');
      setRenderOutputPath('');
      updateRenderFeedback('有图片仍在后台处理中，请等待 1 秒后再导出 MP4。');
      return;
    }

    try {
      const renderProject =
        renderMode === 'instant'
          ? createInstantRenderProject(project)
          : renderMode === 'hybrid'
            ? createHybridRenderProject(project)
            : project;
      lastRenderRequestRef.current = {
        project: cloneProjectConfig(renderProject),
        targetLabel,
        suggestedName,
        encoder,
        renderMode,
      };
      setRenderState('processing');
      setRenderJobId(null);
      setRenderProgress(0.01);
      setRenderPhaseText('排队中');
      setRenderOutputPath('');
      updateRenderFeedback(`正在准备导出：${targetLabel}`);

      const response = await fetch('/api/render-mp4', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          suggestedName,
          targetLabel,
          encoder,
          project: buildRenderProjectWithVoiceover(renderProject)
        })
      });

      const result = (await response.json()) as {
        error?: string;
        details?: string;
        job_id?: string;
        output_path?: string;
        output_name?: string;
      };

      if (!response.ok || result.error || !result.job_id) {
        throw new Error(result.details || result.error || 'MP4 导出失败');
      }

      setRenderJobId(result.job_id);
      setRenderOutputPath(result.output_path || '');
      updateRenderFeedback(`已提交渲染任务：${targetLabel}`);
    } catch (error) {
      setRenderState('error');
      setRenderPhaseText('导出失败');
      setRenderOutputPath('');
      updateRenderFeedback(error instanceof Error ? error.message : 'MP4 导出失败');
    }
  };

  const cancelRenderJob = async () => {
    if (!renderJobId) {
      return;
    }

    const previousPhaseText = renderPhaseText;

    try {
      setRenderPhaseText('取消中');
      updateRenderFeedback('正在取消渲染任务...');
      const response = await fetch('/api/render-cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({jobId: renderJobId})
      });

      const result = (await response.json()) as {error?: string; details?: string; message?: string};
      if (!response.ok || result.error) {
        throw new Error(result.details || result.error || '取消渲染任务失败');
      }

      setRenderState('canceled');
      setRenderJobId(null);
      setRenderOutputPath('');
      setRenderPhaseText('已取消');
      updateRenderFeedback(result.message || '渲染已取消');
    } catch (error) {
      setRenderState('processing');
      setRenderPhaseText(previousPhaseText || '处理中');
      updateRenderFeedback(error instanceof Error ? error.message : '取消渲染任务失败');
    }
  };

  const retryLastRender = async () => {
    const lastRequest = lastRenderRequestRef.current;
    if (!lastRequest) {
      return;
    }

    setRenderMode(lastRequest.renderMode);
    await startRenderJob(lastRequest.project, lastRequest.targetLabel, lastRequest.suggestedName, lastRequest.encoder);
  };

  const renderMp4 = async () => {
    const projectToRender = latestProjectRef.current;
    const label = renderMode === 'instant' ? '整条视频（极速导出）' : renderMode === 'hybrid' ? '整条视频（混合加速）' : '整条视频';
    await startRenderJob(projectToRender, label, projectToRender.meta.projectName || 'account-project');
  };

  const renderCurrentSegmentMp4 = async () => {
    const projectToRender = latestProjectRef.current;
    const segment = projectToRender.segments[activeSegmentIndex] ?? activeSegment;
    if (!segment) {
      return;
    }

    const singleSegmentProject = createSingleSegmentProject(projectToRender, activeSegmentIndex);
    await startRenderJob(singleSegmentProject, `单段导出：${segment.label}`, `${projectToRender.meta.projectName || 'account-project'}-${segment.id}`);
  };

  const openOutputDir = async () => {
    if (!renderOutputPath) {
      return;
    }

    try {
      const response = await fetch('/api/open-output-dir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({outputPath: renderOutputPath})
      });

      const result = (await response.json()) as {error?: string; details?: string};
      if (!response.ok || result.error) {
        throw new Error(result.details || result.error || '打开输出目录失败');
      }
    } catch (error) {
      updateRenderFeedback(error instanceof Error ? error.message : '打开输出目录失败');
    }
  };

  const openVoiceoverPicker = () => {
    if (isEditorBusy) {
      return;
    }

    voiceoverUploadRef.current?.click();
  };

  const openSegmentedVoiceoverPicker = () => {
    if (isEditorBusy) {
      return;
    }

    segmentedVoiceoverUploadRef.current?.click();
  };

  const openIpLogoPicker = () => {
    if (isEditorBusy) {
      return;
    }

    ipLogoUploadRef.current?.click();
  };

  const handleIpLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || isEditorBusy) {
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setConfig((current) => ({
        ...current,
        meta: {
          ...current.meta,
          ipEnabled: true,
          ipLogoUrl: dataUrl,
        },
      }));
    } catch (error) {
      updateRenderFeedback(error instanceof Error ? error.message : 'Logo 上传失败');
    }
  };

  const handleVoiceoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || isEditorBusy) {
      return;
    }

    clearBatchPreviewTimers();

    try {
      setVoiceoverAlignState('processing');
      updateVoiceoverAlignFeedback(`正在识别 ${file.name}，并自动对齐各段时长...`);
      const alignProject = {
        meta: {
          fps: config.meta.fps
        },
        segments: config.segments.map((segment) => ({
          id: segment.id,
          label: segment.label,
          voiceoverText: segment.voiceoverText
        }))
      };
      const result = await requestVoiceoverAlignment(file, alignProject);
      const merged = applyAlignmentToSegments(result);
      attachGlobalPreviewAudio(file);

      setActiveSegmentIndex(0);
      setVoiceoverAlignState('done');
      updateVoiceoverAlignFeedback(
        `口播对齐完成：已写回 ${merged.updatedCount} 段，总时长 ${(merged.totalFrames / config.meta.fps).toFixed(1)} 秒，并接入整条口播预览音频。`,
        buildVoiceoverSuccessDetails(result),
      );
    } catch (error) {
      setVoiceoverAlignState('error');
      const feedback = toVoiceoverAlignFeedback(error, '口播对齐失败');
      updateVoiceoverAlignFeedback(feedback.message, feedback.details);
    }
  };

  const handleSingleSegmentVoiceoverUpload = async (segmentIndex: number, file: File) => {
    const segment = config.segments[segmentIndex];
    if (!segment) {
      return;
    }

    clearBatchPreviewTimers();

    try {
      setSegmentVoiceoverUploadingIndex(segmentIndex);
      setVoiceoverAlignState('processing');
      updateVoiceoverAlignFeedback(`正在识别 ${segment.label} 的口播：${file.name}`);
      const project = buildSegmentVoiceoverProject(config, segmentIndex);
      const result = await requestVoiceoverAlignment(file, project);
      const merged = applyAlignmentToSegments(result, {resetStartToZero: true});
      attachSegmentPreviewAudioFiles([{segmentId: segment.id, file}], {clearGlobal: true, clearOtherSegments: false});
      setActiveSegmentIndex(segmentIndex);
      setVoiceoverAlignState('done');
      updateVoiceoverAlignFeedback(
        `${segment.label} 对齐完成：已写回 ${merged.updatedCount} 段，动画点 ${result.segments?.[0]?.cue_points_sec?.length ?? 0} 个，并接入本段口播预览音频。`,
        buildVoiceoverSuccessDetails(result, [`项目总时长：${(merged.totalFrames / config.meta.fps).toFixed(1)} 秒`]),
      );
    } catch (error) {
      setVoiceoverAlignState('error');
      const feedback = toVoiceoverAlignFeedback(error, '本段口播对齐失败');
      updateVoiceoverAlignFeedback(feedback.message, feedback.details);
    } finally {
      setSegmentVoiceoverUploadingIndex(null);
    }
  };

  const handleSegmentedVoiceoverBatchUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('audio/') || file.type.startsWith('video/'));
    event.target.value = '';

    if (!files.length) {
      return;
    }

    const resolution = resolveBatchVoiceoverMatches(config.segments, files);
    const matched = resolution.accepted;

    if (!matched.length) {
      setVoiceoverAlignState('error');
      const extraHints: string[] = [];
      if (resolution.duplicateFiles.length) {
        extraHints.push(`重复文件 ${resolution.duplicateFiles.length} 个`);
      }
      if (resolution.duplicateMatches.length) {
        extraHints.push(`重复匹配 ${resolution.duplicateMatches.length} 个`);
      }
      updateVoiceoverAlignFeedback(
        '没有匹配到任何段落。建议文件名用 hook、p1、p2、p3 或 1、2、3 这种格式。',
        extraHints.length ? [`已自动忽略：${extraHints.join('，')}`] : [],
      );
      return;
    }

    try {
      setVoiceoverAlignState('processing');
      updateVoiceoverAlignFeedback(`正在批量识别 ${matched.length} 段分段口播...`);
      clearBatchPreviewTimers();

      const batchFiles = await Promise.all(
        matched.map(async (item) => {
          const audioDataUrl = await readFileAsDataUrl(item.file);
          return {
            fileName: item.file.name,
            mimeType: item.file.type,
            audioBase64: audioDataUrl.split(',')[1] ?? '',
            segmentId: config.segments[item.segmentIndex].id,
            label: config.segments[item.segmentIndex].label,
            voiceoverText: config.segments[item.segmentIndex].voiceoverText,
            segmentIndex: item.segmentIndex,
          };
        })
      );

      const response = await fetch('/api/align-voiceover-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fps: config.meta.fps,
          language: 'zh',
          model: 'large-v3-turbo',
          device: 'cuda',
          computeType: 'float16',
          files: batchFiles,
        })
      });

      const result = ensureVoiceoverAlignResult(
        response,
        (await response.json()) as VoiceoverAlignResult,
        '批量分段口播导入失败',
      );

      const merged = applyAlignmentToSegments(result, {resetStartToZero: true});
      attachSegmentPreviewAudioFiles(matched.map((item) => ({segmentId: config.segments[item.segmentIndex].id, file: item.file})), {
        clearGlobal: true,
        clearOtherSegments: true,
      });
      const previewIndexes = batchFiles.map((item) => item.segmentIndex);
      const successCount = result.segments.length;
      const ignoredSummary: string[] = [];
      if (resolution.duplicateFiles.length) {
        ignoredSummary.push(`重复文件 ${resolution.duplicateFiles.length} 个`);
      }
      if (resolution.duplicateMatches.length) {
        ignoredSummary.push(`重复匹配 ${resolution.duplicateMatches.length} 个`);
      }
      if (resolution.unmatched.length) {
        ignoredSummary.push(`未匹配 ${resolution.unmatched.length} 个`);
      }

      previewSegmentsInOrder(previewIndexes);
      setVoiceoverAlignState('done');
      updateVoiceoverAlignFeedback(
        `批量导入完成：成功匹配并写回 ${successCount} 段，并接入分段口播预览音频；预览区会按段落顺序自动巡检一遍。`,
        buildVoiceoverSuccessDetails(result, [
          `项目总时长：${(merged.totalFrames / config.meta.fps).toFixed(1)} 秒`,
          ignoredSummary.length ? `已自动忽略：${ignoredSummary.join('，')}` : '',
        ]),
      );
    } catch (error) {
      setVoiceoverAlignState('error');
      const feedback = toVoiceoverAlignFeedback(error, '批量分段口播导入失败');
      updateVoiceoverAlignFeedback(feedback.message, feedback.details);
    } finally {
      setSegmentVoiceoverUploadingIndex(null);
    }
  };

  const loadExampleProject = () => {
    if (isEditorBusy) {
      return;
    }

    clearBatchPreviewTimers();
    setImportFeedback(null);
    importProjectWithRecommendationCard(toEditorConfig(sampleProjectPayload), '已加载示例项目');
    setImportDraft(JSON.stringify(sampleProjectPayload, null, 2));
  };

  const importPureJson = () => {
    if (!hasImportDraft || isEditorBusy) {
      return;
    }

    clearBatchPreviewTimers();

    try {
      const parsed = JSON.parse(importDraft);
      importProjectWithRecommendationCard(toEditorConfig(parsed), '已导入纯 JSON');
      setImportDraft('');
      setImportFeedback({type: 'success', message: '已导入纯 JSON，可继续检查分镜与皮肤建议。'});
    } catch {
      setImportFeedback({type: 'error', message: '纯 JSON 导入失败，请检查 JSON 格式。'});
    }
  };

  const importPromptOutput = () => {
    if (!hasImportDraft || isEditorBusy) {
      return;
    }

    clearBatchPreviewTimers();

    try {
      const parsed = extractPromptJson(importDraft);
      importProjectWithRecommendationCard(toEditorConfig(parsed), '已根据提示词结果生成项目');
      setImportDraft('');
      setImportFeedback({type: 'success', message: '已根据提示词结果生成项目，可继续微调镜头与字幕。'});
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败';
      setImportFeedback({type: 'error', message: `一键生成失败：${message}`});
    }
  };

  const resetConfig = () => {
    if (isEditorBusy) {
      return;
    }

    clearBatchPreviewTimers();
    setImportFeedback(null);
    dismissImportSkinCard();
    resetProjectScopedUiState();
    setEditorSessionKey((value) => value + 1);
    commitProject(ensureProjectVisualSkin(cloneProjectConfig(defaultAccountProject)));
    setActiveSegmentIndex(0);
  };

  return (
    <div className={`app-shell app-shell--${activeVisualSkin}`}>
      <aside className="sidebar" ref={sidebarRef}>
        <div className="sidebar__header">
          <div>
            <div className="eyebrow">Oxecho 定制模板编辑器</div>
            <h1>按段落设置口播、动画、素材</h1>
          </div>
          <div className={`save-state save-state--${saveState}`}>{saveState === 'saved' ? '已自动保存' : saveState === 'error' ? '本地保存失败' : '编辑中'}</div>
        </div>

        {importSkinCard ? (
          <div className="panel import-skin-card">
            <div className="import-skin-card__header">
              <div>
                <div className="import-skin-card__eyebrow">导入完成</div>
                <div className="import-skin-card__title">已生成项目皮肤推荐</div>
              </div>
              <button type="button" className="ghost import-skin-card__close" onClick={dismissImportSkinCard}>
                收起
              </button>
            </div>
            <div className="import-skin-card__meta">
              {importSkinCard.sourceLabel} / {importSkinCard.projectName || '未命名项目'}
            </div>
            <div className="import-skin-card__summary">
              {importSkinCard.hasExplicitSkin
                ? `检测到项目内已指定皮肤：${importCardSkinOption?.label ?? currentSkinOption.label}。当前预览已按该风格承接。`
                : isImportCardRecommendationApplied
                  ? `推荐皮肤：${importCardSkinOption?.label ?? currentSkinOption.label}。当前预览已切到该风格。`
                  : `推荐皮肤：${importCardSkinOption?.label ?? currentSkinOption.label}。当前仍按 ${currentSkinOption.label} 预览，点右侧可一键应用。`}
            </div>
            {importSkinCard.reasons.length ? (
              <div className="import-skin-card__reasons">
                {importSkinCard.reasons.map((reason) => (
                  <div key={reason} className="import-skin-card__reason">
                    {reason}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="segment-actions import-skin-card__actions">
              <button
                type="button"
                onClick={handleApplyImportSkinCard}
                disabled={isImportCardRecommendationApplied}
              >
                {isImportCardRecommendationApplied ? '当前已应用推荐' : '一键应用推荐皮肤'}
              </button>
              <button type="button" className="ghost" onClick={dismissImportSkinCard}>
                先保持当前预览
              </button>
            </div>
          </div>
        ) : null}

        <div className="panel">
          <div className="panel__title">全局设置</div>
          <div className="field-grid field-grid--two">
            <label className="field">
              <span>项目名</span>
              <input value={config.meta.projectName} onChange={(event) => setConfig({...config, meta: {...config.meta, projectName: event.target.value}})} />
            </label>
            <label className="field">
              <span>账号名</span>
              <input value={config.meta.accountName} onChange={(event) => setConfig({...config, meta: {...config.meta, accountName: event.target.value}})} />
            </label>
          </div>
          <label className="field">
            <span>账号定位</span>
            <input value={config.meta.positioning} onChange={(event) => setConfig({...config, meta: {...config.meta, positioning: event.target.value}})} />
          </label>
          <div className="field-grid field-grid--two">
            <label className="field">
              <span>左标签</span>
              <input value={config.tags.left} onChange={(event) => setConfig({...config, tags: {...config.tags, left: event.target.value}})} />
            </label>
            <label className="field">
              <span>右标签</span>
              <input value={config.tags.right} onChange={(event) => setConfig({...config, tags: {...config.tags, right: event.target.value}})} />
            </label>
          </div>
          <div style={{marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)'}}>
            <div className="field-hint" style={{marginTop: 0, marginBottom: 10}}>
              个人 IP（会显示在每段左上角；留空自动用标签/定位）
            </div>
            <div className="field-grid field-grid--two">
              <label className="field field--checkbox">
                <span>启用 IP</span>
                <input
                  type="checkbox"
                  checked={config.meta.ipEnabled !== false}
                  onChange={(event) => setConfig({...config, meta: {...config.meta, ipEnabled: event.target.checked}})}
                />
              </label>
              <div className="field">
                <span>IP Logo</span>
                <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                  <input
                    value={config.meta.ipLogoUrl ?? ''}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        meta: {...config.meta, ipLogoUrl: event.target.value.trim() ? event.target.value : undefined},
                      })
                    }
                    placeholder="可填远程 URL，或点右侧上传"
                  />
                  <button type="button" className="ghost" onClick={openIpLogoPicker} disabled={isEditorBusy}>
                    上传
                  </button>
                </div>
              </div>
            </div>
            <div className="field-grid field-grid--two">
              <label className="field">
                <span>IP 名称</span>
                <input
                  value={config.meta.ipName ?? ''}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      meta: {...config.meta, ipName: event.target.value.trim() ? event.target.value : undefined},
                    })
                  }
                  placeholder="留空使用左标签"
                />
              </label>
              <label className="field">
                <span>IP 账号（可选）</span>
                <input
                  value={config.meta.ipHandle ?? ''}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      meta: {...config.meta, ipHandle: event.target.value.trim() ? event.target.value : undefined},
                    })
                  }
                  placeholder="@xxx（也可不带 @）"
                />
              </label>
            </div>
            <label className="field">
              <span>IP Slogan（可选）</span>
              <input
                value={config.meta.ipSlogan ?? ''}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    meta: {...config.meta, ipSlogan: event.target.value.trim() ? event.target.value : undefined},
                  })
                }
                placeholder="留空使用账号定位/右标签"
              />
            </label>
          </div>
          <div className="field-grid field-grid--two">
            <label className="field">
              <span>发布标题</span>
              <input
                value={config.meta.publishTitle ?? ''}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    meta: {...config.meta, publishTitle: event.target.value.trim() ? event.target.value : undefined},
                  })
                }
                placeholder="用于抖音/B站/小红书的标题"
              />
            </label>
            <label className="field">
              <span>发布话题</span>
              <input
                value={config.meta.publishTopics ?? ''}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    meta: {...config.meta, publishTopics: event.target.value.trim() ? event.target.value : undefined},
                  })
                }
                placeholder="#AI开源 #工具推荐"
              />
            </label>
          </div>
          <label className="field">
            <span>发布简介</span>
            <textarea
              rows={3}
              value={config.meta.publishDescription ?? ''}
              onChange={(event) =>
                setConfig({
                  ...config,
                  meta: {...config.meta, publishDescription: event.target.value.trim() ? event.target.value : undefined},
                })
              }
              placeholder="一句话讲清楚：这项目是什么、值不值得看"
            />
          </label>
          <div className="field-grid field-grid--two">
            <label className="field field--checkbox">
              <span>自动音效</span>
              <input
                type="checkbox"
                checked={config.meta.sfxEnabled !== false}
                onChange={(event) => setConfig({...config, meta: {...config.meta, sfxEnabled: event.target.checked}})}
              />
            </label>
            <label className="field">
              <span>音效音量</span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={typeof config.meta.sfxVolume === 'number' ? config.meta.sfxVolume : 0.7}
                onChange={(event) => setConfig({...config, meta: {...config.meta, sfxVolume: Math.max(0, Math.min(2, Number(event.target.value) || 0))}})}
              />
            </label>
          </div>
          <div className="segment-actions" style={{marginTop: 0}}>
            <button type="button" className="ghost" onClick={copyPublishCopywriting}>
              复制发布文案
            </button>
          </div>
          {publishCopyFeedback ? (
            <div
              className={`field-hint field-hint--status${publishCopyFeedback.type === 'error' ? ' field-hint--error' : ''}`}
              role={publishCopyFeedback.type === 'error' ? 'alert' : 'status'}
              aria-live={publishCopyFeedback.type === 'error' ? 'assertive' : 'polite'}
              style={{marginTop: 6}}
            >
              {publishCopyFeedback.message}
            </div>
          ) : null}
          <div className="field-grid field-grid--three">
            <label className="field">
              <span>分辨率宽度</span>
              <input
                type="number"
                min={320}
                step={10}
                value={config.meta.width}
                onChange={(event) => setConfig({...config, meta: {...config.meta, width: normalizeCompositionWidth(event.target.value, defaultAccountProject.meta.width)}})}
              />
            </label>
            <label className="field">
              <span>分辨率高度</span>
              <input
                type="number"
                min={320}
                step={10}
                value={config.meta.height}
                onChange={(event) => setConfig({...config, meta: {...config.meta, height: normalizeCompositionHeight(event.target.value, defaultAccountProject.meta.height)}})}
              />
            </label>
            <label className="field">
              <span>帧率</span>
              <input
                type="number"
                min={1}
                max={120}
                step={1}
                value={config.meta.fps}
                onChange={(event) => setConfig({...config, meta: {...config.meta, fps: normalizeCompositionFps(event.target.value, defaultAccountProject.meta.fps)}})}
              />
            </label>
          </div>
          <div className="field-grid field-grid--two">
            <label className="field">
              <span>字幕模式</span>
              <select
                value={normalizeSubtitleMode(config.meta.subtitleMode)}
                onChange={(event) => setConfig({...config, meta: {...config.meta, subtitleMode: normalizeSubtitleMode(event.target.value)}})}
              >
                {subtitleModeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <div className="subtitle-preset-row">
                {subtitleModePresets.map((item) => {
                  const active = normalizeSubtitleMode(config.meta.subtitleMode) === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={`subtitle-preset-button${active ? ' subtitle-preset-button--active' : ''}`}
                      onClick={() => setConfig({...config, meta: {...config.meta, subtitleMode: item.value}})}
                      title={item.description}
                    >
                      <span className="subtitle-preset-button__label">{item.label}</span>
                      <span className="subtitle-preset-button__desc">{item.description}</span>
                    </button>
                  );
                })}
              </div>
            </label>
            <div className="field">
              <span>当前模式说明</span>
              <div className="field-hint" style={{marginTop: 10, marginBottom: 0}}>
                {subtitleModeOptions.find((item) => item.value === normalizeSubtitleMode(config.meta.subtitleMode))?.description}
              </div>
              <div className="field-hint" style={{marginTop: 8, marginBottom: 0}}>
                {`当前一键预设：${getSubtitleModeLabel(config.meta.subtitleMode)}`}
              </div>
            </div>
          </div>
          <div className="field-grid field-grid--two">
            <label className="field">
              <span>转场风格</span>
              <select
                value={normalizeTransitionPreset(config.meta.transitionPreset)}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    meta: {...config.meta, transitionPreset: normalizeTransitionPreset(event.target.value)},
                  })
                }
              >
                {transitionPresetOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <div className="field-hint" style={{marginTop: 8, marginBottom: 0}}>
                {transitionPresetOptions.find((item) => item.value === normalizeTransitionPreset(config.meta.transitionPreset))?.description}
              </div>
            </label>
            <div className="field">
              <span>当前转场说明</span>
              <div className="field-hint" style={{marginTop: 10, marginBottom: 0}}>
                {`当前预设：${getTransitionPresetLabel(config.meta.transitionPreset)}`}
              </div>
            </div>
          </div>
          <div className="field-grid field-grid--two">
            <label className="field">
              <span>主强调色</span>
              <input type="color" value={config.theme.accentColor} onChange={(event) => setConfig({...config, theme: {...config.theme, accentColor: event.target.value}})} />
            </label>
            <label className="field">
              <span>辅助色</span>
              <input type="color" value={config.theme.secondaryColor} onChange={(event) => setConfig({...config, theme: {...config.theme, secondaryColor: event.target.value}})} />
            </label>
          </div>
          <div className="field">
            <span>项目皮肤</span>
            <div className="skin-switch">
              {accountVisualSkinOptions.map((item) => {
                const isActive = item.value === activeVisualSkin;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={`skin-switch__button${isActive ? ' skin-switch__button--active' : ''}`}
                    onClick={() => handleApplyVisualSkin(item.value)}
                  >
                    <div className="skin-switch__title">{item.label}</div>
                    <div className="skin-switch__desc">{item.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="skin-switch__footer">
            <div className="skin-switch__recommendation">
              推荐默认皮肤：{recommendedSkinOption.label}
              {skinRecommendation.reasons.length ? `（依据：${skinRecommendation.reasons.join(' / ')}）` : ''}
            </div>
            <button
              type="button"
              className="ghost skin-switch__apply"
              onClick={handleRecommendVisualSkin}
              disabled={activeVisualSkin === skinRecommendation.skin}
            >
              {activeVisualSkin === skinRecommendation.skin ? '当前已应用推荐' : '按项目内容推荐'}
            </button>
          </div>
          <div className="stats-row stats-row--three">
            <div className="stat-card">
              <div className="stat-card__label">总时长</div>
              <div className="stat-card__value">{(durationInFrames / config.meta.fps).toFixed(1)}秒</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">总帧数</div>
              <div className="stat-card__value">{durationInFrames}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">输出规格</div>
              <div className="stat-card__value stat-card__value--small">{config.meta.width} × {config.meta.height} · {config.meta.fps}fps</div>
            </div>
          </div>
        </div>

          <div className="panel">
            <div className="panel__title">导入 / 导出 / 一键生成</div>
            <div className="field-grid field-grid--two" style={{marginBottom: 12}}>
              <label className="field">
                <span>{'\u6e32\u67d3\u7b56\u7565'}</span>
                <select
                  value={renderMode}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setRenderMode(nextValue === 'instant' || nextValue === 'hybrid' ? nextValue : 'full');
                  }}
                  disabled={isEditorBusy}
                >
                  <option value="full">{'\u5168\u6e32\u67d3\uff08\u8d28\u91cf\u4f18\u5148\uff09'}</option>
                  <option value="hybrid">{'\u6df7\u5408\u52a0\u901f\uff08hook+p2+\u7ed3\u8bed\u5168\u6e32\uff0c\u5176\u4ed6\u8f6c\u4e3a\u8f7b\u6b65\u4f5c\uff09'}</option>
                  <option value="instant">{'\u6781\u901f\u5bfc\u51fa\uff08\u5168\u90e8\u8f6c\u8f7b\u5361\u7247\uff09'}</option>
                </select>
                <div className="field-hint" style={{marginTop: 8, marginBottom: 0}}>
                  {renderMode === 'instant'
                    ? '\u6240\u6709\u6bb5\u843d\u7b80\u5316\u6210\u8f7b\u5361\u7247\uff0c\u901f\u5ea6\u6700\u5feb\u3002'
                    : renderMode === 'hybrid'
                      ? '\u5176\u4ed6\u6bb5\u843d\u6539\u4e3a\u8f7b\u6b65\u5361\u7247\uff0c\u663e\u8457\u63d0\u901f\uff0c\u754c\u9762\u98ce\u683c\u4fdd\u7559\u3002'
                      : '\u5b8c\u5168\u4f7f\u7528\u539f\u672c\u6a21\u677f\u6e32\u67d3\uff0c\u6548\u679c\u6700\u5b8c\u6574\u3002'}
                </div>
              </label>
              <label className="field">
                <span>{'\u7f16\u7801\u65b9\u5f0f'}</span>
                <select
                  value={renderEncoderMode}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue === 'nvenc' || nextValue === 'nvenc-fast') {
                      setRenderEncoderMode(nextValue);
                    } else {
                      setRenderEncoderMode('x264');
                    }
                  }}
                  disabled={isEditorBusy}
                >
                  <option value="x264">{'\u517c\u5bb9\u4f18\u5148\uff08CPU x264\uff09'}</option>
                  <option value="nvenc">{'\u901f\u5ea6\u4f18\u5148\uff08NVENC\uff0cPNG \u5e8f\u5217\uff09'}</option>
                  <option value="nvenc-fast">{'\u6781\u901f\u6e32\u67d3\uff08NVENC + JPEG \u5e8f\u5217\uff09'}</option>
                </select>
                <div className="field-hint" style={{marginTop: 8, marginBottom: 0}}>
                  {renderEncoderMode === 'nvenc-fast'
                    ? '\u4f7f\u7528 JPEG \u5e8f\u5217\u63d0\u901f\uff0c\u7ec6\u8282\u7565\u6709\u635f\u5931\uff0c\u4f46\u5bfc\u51fa\u901f\u5ea6\u6700\u5feb\u3002'
                    : renderEncoderMode === 'nvenc'
                      ? '\u9700\u8981\u672c\u673a FFmpeg \u652f\u6301 NVENC\uff0c\u5e76\u4f1a\u4ea7\u751f\u4e34\u65f6\u5e27\u5e8f\u5217\uff08\u78c1\u76d8\u5360\u7528\u66f4\u5927\uff09\u3002'
                        : '\u9ed8\u8ba4\u7f16\u7801\uff0c\u8d28\u91cf\u4e0e\u517c\u5bb9\u6027\u6700\u7a33\u3002'}
                </div>
              </label>
              <div className="field" />
            </div>
            <div className="segment-actions">
              <button type="button" onClick={exportJson}>
                导出当前项目 JSON
              </button>
            <button type="button" className="ghost" onClick={exportTemplateJson}>
              导出模板配置 JSON
            </button>
            <button type="button" className="ghost" onClick={loadExampleProject} disabled={isEditorBusy}>
              加载示例项目
            </button>
            <button type="button" className="ghost" onClick={resetConfig} disabled={isEditorBusy}>
              恢复默认
            </button>
            <button type="button" className="ghost" onClick={openVoiceoverPicker} disabled={isEditorBusy}>
              {isVoiceoverProcessing ? '口播识别中...' : '上传口播自动对齐'}
            </button>
            <button type="button" className="ghost" onClick={openSegmentedVoiceoverPicker} disabled={isEditorBusy}>
              {isVoiceoverProcessing ? '批量识别中...' : '批量导入分段口播'}
            </button>
            <button type="button" className="ghost" onClick={renderMp4} disabled={isEditorBusy}>
              {isRenderProcessing ? '整条导出中...' : '一键导出整条 MP4'}
            </button>
            <button type="button" className="ghost" onClick={renderCurrentSegmentMp4} disabled={isEditorBusy || !activeSegment}>
              {isRenderProcessing ? '单段导出中...' : '导出当前段 MP4'}
            </button>
            <button type="button" className="ghost" onClick={cancelRenderJob} disabled={renderState !== 'processing' || !renderJobId}>
              取消渲染
            </button>
            <button
              type="button"
              className="ghost"
              onClick={retryLastRender}
              disabled={!canRetryLastRender}
            >
              重试上次导出
            </button>
            <button type="button" className="ghost" onClick={openOutputDir} disabled={!canOpenOutputDir}>
              打开输出目录
            </button>
          </div>
          <div className="field-hint">
            先导入口播音频，再用本地 faster-whisper 自动识别每个段落时长，并生成可用于卡点的动画时间点。
          </div>
          <div className="field-hint">
            如果你是分段录音，优先用“上传本段口播”或“批量导入分段口播”，准确度通常比整条自动切段更高。文件名可用 `hook`、`p1`、`p2` 或 `1`、`2`、`3`。
          </div>
          <div className="field-hint">
            口播导入成功后，播放器预览会直接带声音；MP4 导出仍默认不混入口播音频，方便你后期单独合成。
          </div>
          {voiceoverAlignMessage ? (
            <div
              className={`field-hint field-hint--status${voiceoverAlignState === 'error' ? ' field-hint--error' : ''}`}
              role={voiceoverAlignState === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              <div className="field-hint__summary">{voiceoverAlignMessage}</div>
              {voiceoverAlignDetails.length ? (
                <ul className="field-hint__list">
                  {voiceoverAlignDetails.map((detail) => (
                    <li key={detail} className="field-hint__item">
                      {detail}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {renderState !== 'idle' ? (
            <div className={`render-progress-card${renderState === 'error' ? ' render-progress-card--error' : renderState === 'canceled' ? ' render-progress-card--canceled' : ''}`}>
              <div className="render-progress-card__header">
                <div>
                  <div className="render-progress-card__title">渲染进度</div>
                  <div className="render-progress-card__meta">{renderPhaseText || '处理中'} · {(renderProgress * 100).toFixed(0)}%</div>
                </div>
                <div className={`segment-card__badge${renderState === 'error' || renderState === 'canceled' ? ' render-progress-card__badge--error' : ''}`}>
                  {renderState === 'done' ? '完成' : renderState === 'error' ? '失败' : renderState === 'canceled' ? '已取消' : '处理中'}
                </div>
              </div>
              <div className="render-progress-bar">
                <div className="render-progress-bar__fill" style={{width: `${Math.max(4, renderProgress * 100)}%`}} />
              </div>
              {renderMessage ? <div className="render-progress-card__summary">{renderMessage}</div> : null}
              {renderDetails.length ? (
                <ul className="render-progress-card__details">
                  {renderDetails.map((detail) => (
                    <li key={detail} className="render-progress-card__detail">
                      {detail}
                    </li>
                  ))}
                </ul>
              ) : null}
              {renderOutputPath ? <div className="render-progress-card__path">输出：{renderOutputPath}</div> : null}
            </div>
          ) : null}
          <label className="field">
            <span>粘贴完整提示词输出或纯 JSON</span>
            <textarea rows={10} value={importDraft} onChange={(event) => handleImportDraftChange(event.target.value)} />
          </label>
          {importFeedback ? (
            <div
              className={`field-hint field-hint--status${importFeedback.type === 'error' ? ' field-hint--error' : ''}`}
              role={importFeedback.type === 'error' ? 'alert' : 'status'}
              aria-live={importFeedback.type === 'error' ? 'assertive' : 'polite'}
            >
              {importFeedback.message}
            </div>
          ) : null}
          <div className="segment-actions">
            <button type="button" onClick={importPromptOutput} disabled={!hasImportDraft || isEditorBusy}>
              从提示词结果一键生成项目
            </button>
            <button type="button" className="ghost" onClick={importPureJson} disabled={!hasImportDraft || isEditorBusy}>
              仅按 JSON 导入
            </button>
          </div>
          <input ref={voiceoverUploadRef} className="file-input-native" type="file" accept="audio/*,video/*" onChange={handleVoiceoverUpload} disabled={isEditorBusy} />
          <input ref={segmentedVoiceoverUploadRef} className="file-input-native" type="file" accept="audio/*,video/*" multiple onChange={handleSegmentedVoiceoverBatchUpload} disabled={isEditorBusy} />
          <input ref={ipLogoUploadRef} className="file-input-native" type="file" accept="image/*" onChange={handleIpLogoUpload} disabled={isEditorBusy} />
        </div>

        <div className="panel">
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'}}>
            <div>
              <div className="panel__title">段落编辑</div>
              <div className="field-hint" style={{marginTop: 4, marginBottom: 0}}>批量切换会沿用当前段模板：{activeStickVisualPresetLabel}</div>
            </div>
            <div className="segment-actions" style={{marginTop: 0}}>
              <button type="button" onClick={() => bulkConvertSegmentsToStick('all')} disabled={isEditorBusy}>全部转简笔动画</button>
              <button type="button" className="ghost" onClick={() => bulkConvertSegmentsToStick('following')} disabled={isEditorBusy}>选中后续段落</button>
              <button type="button" className="ghost" onClick={bulkConvertSegmentsToStickAuto} disabled={isEditorBusy}>自动分配简笔模板</button>
            </div>
          </div>
          <div className="segment-list">
            {config.segments.map((segment, index) => (
              <SegmentEditor
                key={`${editorSessionKey}:${segment.id}`}
                segment={segment}
                fps={config.meta.fps}
                isActive={index === activeSegmentIndex}
                onChange={(next) => updateSegment(index, next)}
                subtitleMode={normalizeSubtitleMode(config.meta.subtitleMode)}
                onPreviewRequest={(offsetFrames) => jumpToSegment(index, offsetFrames ?? 0)}
                onUploadVoiceover={(file) => handleSingleSegmentVoiceoverUpload(index, file)}
                isVoiceoverUploading={segmentVoiceoverUploadingIndex === index}
                isInteractionDisabled={isEditorBusy}
              />
            ))}
          </div>
        </div>
      </aside>

      <main className="preview-pane">
        <div className="preview-pane__sticky">
          <div className="preview-pane__header">
            <div>
              <div className="eyebrow">实时预览</div>
              <h2>账号定制横屏模板</h2>
            </div>
            <div className="preview-pane__hint">当前预览输出为 {previewFormatText}。把提示词结果整段贴进来，也能自动提取 JSON 生成项目。</div>
          </div>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap'}}>
            <div style={{fontSize: 12, color: 'rgba(234,246,255,0.8)'}}>
              当前定位：<strong style={{color: '#F5FBFF'}}>{activeSegment?.label || '未选择段落'}</strong>
              {` · ${activeSegmentStartFrame}f - ${activeSegmentEndFrame}f`}
            </div>
            <div className="segment-actions" style={{marginTop: 0}}>
              <button type="button" className="ghost" onClick={() => jumpToSegment(activeSegmentIndex, 0)}>定位到当前段</button>
            </div>
          </div>
          <div className="preview-frame">
            <Player
              key={playerKey}
              ref={playerRef}
              component={AccountDeepTemplate}
              inputProps={config}
              durationInFrames={durationInFrames}
              compositionWidth={config.meta.width}
              compositionHeight={config.meta.height}
              fps={config.meta.fps}
              acknowledgeRemotionLicense
              controls={!isPlayerFullscreen}
              style={{width: '100%', aspectRatio: previewAspectRatio, borderRadius: 24, overflow: 'hidden'}}
            />
          </div>
          {activeSegmentIsStick && activeSegmentStickScene?.beats?.length ? (
            <div style={{marginTop: 14, padding: '12px 14px', borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap'}}>
                <div style={{fontSize: 14, fontWeight: 800, color: '#EAF6FF'}}>当前段 Beat 时间轴</div>
                <div style={{display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                    {beatSnapGridOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="ghost"
                        onClick={() => setBeatSnapGrid(option.value)}
                        style={{
                          padding: '6px 10px',
                          borderColor: beatSnapGrid === option.value ? 'rgba(92,157,255,0.72)' : undefined,
                          background: beatSnapGrid === option.value ? 'rgba(92,157,255,0.18)' : undefined,
                          color: beatSnapGrid === option.value ? '#F5FBFF' : undefined,
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div style={{fontSize: 12, color: 'rgba(234,246,255,0.72)'}}>Click to jump | Hold Shift to snap</div>
                </div>
              </div>
              <div ref={beatTimelineRef} style={{position: 'relative', height: 56, userSelect: draggingBeat ? 'none' : 'auto'}}>
                <div style={{position: 'absolute', left: 0, right: 0, top: 24, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.12)'}} />
                {activeDraggedBeat ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${Math.max(0, Math.min(100, (activeDraggedBeat.startFrame / Math.max(1, activeSegment.durationInFrames - 1)) * 100))}%`,
                      top: -2,
                      transform: 'translateX(-50%)',
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: 'rgba(10,18,28,0.92)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#F5FBFF',
                      fontSize: 11,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      zIndex: 3,
                    }}
                  >
                    {activeDraggedBeat.startFrame}f{dragSnapActive ? ` | ${beatSnapGrid}f grid` : ''}
                  </div>
                ) : null}
                {activeSegmentStickScene.beats.map((beat, beatIndex) => {
                  const left = `${Math.max(0, Math.min(100, (beat.startFrame / Math.max(1, activeSegment.durationInFrames - 1)) * 100))}%`;
                  const durationPercent = Math.max(2, ((beat.durationInFrames ?? 18) / Math.max(1, activeSegment.durationInFrames)) * 100);
                  const color = beat.type === 'question' ? '#6CAEFF' : beat.type === 'exclamation' ? '#FF8C8C' : beat.type === 'shake' ? '#FFB86C' : beat.type === 'enter' || beat.type === 'exit' ? '#62DFC5' : '#C9D4FF';
                  return (
                    <button
                      key={`${beat.id}-${beatIndex}`}
                      type="button"
                      onClick={() => jumpToSegment(activeSegmentIndex, beat.startFrame)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setDraggingBeat({segmentIndex: activeSegmentIndex, beatId: beat.id});
                        setDragSnapActive(event.shiftKey);
                        updateBeatFrameFromClientX(event.clientX, activeSegmentIndex, beat.id, {shiftKey: event.shiftKey});
                      }}
                      title={`${beat.type} @ ${beat.startFrame}f`}
                      style={{
                        position: 'absolute',
                        left,
                        top: 10,
                        transform: 'translateX(-50%)',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: draggingBeat?.segmentIndex === activeSegmentIndex && draggingBeat?.beatId === beat.id ? 'grabbing' : 'grab',
                      }}
                    >
                      <div style={{fontSize: 11, fontWeight: 800, color, marginBottom: 4, whiteSpace: 'nowrap'}}>{beat.type}</div>
                      <div style={{width: 12, height: 12, borderRadius: 999, background: color, boxShadow: `0 0 0 4px ${color}22`}} />
                      <div style={{marginTop: 6, width: `clamp(18px, ${durationPercent}%, 72px)`, height: 4, borderRadius: 999, background: color, opacity: 0.72, transform: 'translateX(calc(-50% + 6px))'}} />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};
