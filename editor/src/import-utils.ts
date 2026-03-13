import type {
  AccountProjectConfig,
  AccountSubtitleMode,
  MotionPreset,
  SegmentConfig,
  SegmentLayout,
  SegmentMediaItem,
  VisualPreset,
} from '../../src/account/config';
import {
  cloneProjectConfig,
  defaultAccountProject,
  getSegmentMediaItems,
  normalizeCompositionFps,
  normalizeCompositionHeight,
  normalizeCompositionWidth,
} from '../../src/account/config';
import {
  getSkinLabel,
  normalizeAccountVisualSkin,
  parseAccountVisualSkinHint,
} from '../../src/account/skins';

const normalizeSubtitleMode = (value: unknown): AccountSubtitleMode => {
  if (value === 'bilingual' || value === 'bilingual-full') {
    return 'bilingual-full';
  }
  if (value === 'bilingual-keywords') {
    return 'bilingual-keywords';
  }
  return 'single';
};

export const layoutOptions: Array<{value: SegmentLayout; label: string}> = [
  {value: 'hero', label: '主封面'},
  {value: 'concept', label: '概念解释'},
  {value: 'dashboard', label: '信息面板'},
  {value: 'phone', label: '手机界面'},
  {value: 'summary', label: '总结收束'},
];

export const motionOptions: Array<{value: MotionPreset; label: string}> = [
  {value: 'lift', label: '抬升淡入'},
  {value: 'stagger', label: '依次进入'},
  {value: 'spotlight', label: '聚光强调'},
  {value: 'calm', label: '平稳过渡'},
];

export const visualOptions: Array<{value: VisualPreset; label: string}> = [
  {value: 'orb', label: 'Orb'},
  {value: 'nodes', label: 'Nodes'},
  {value: 'dashboard', label: 'Dashboard'},
  {value: 'phone', label: 'Phone'},
  {value: 'image', label: 'Image'},
  {value: 'stick-dialogue', label: 'Stick Dialogue'},
  {value: 'stick-conflict', label: 'Stick Conflict'},
  {value: 'stick-compare', label: 'Stick Compare'},
  {value: 'stick-narration', label: 'Stick Narration'},
];

export const layoutLabelMap: Record<string, string> = Object.fromEntries(
  layoutOptions.map((item) => [item.value, item.label]),
);

const isLayout = (value: string): value is SegmentLayout => {
  return layoutOptions.some((item) => item.value === value);
};

const isMotion = (value: string): value is MotionPreset => {
  return motionOptions.some((item) => item.value === value);
};

const isVisual = (value: string): value is VisualPreset => {
  return visualOptions.some((item) => item.value === value);
};

const normalizeText = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined) {
    return fallback;
  }
  return typeof value === 'string' ? value : String(value);
};

const normalizeFiniteNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const nextValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : undefined;
};

const normalizeBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};

const normalizeMediaItems = (
  value: unknown,
  fallbackLabel?: string,
): SegmentMediaItem[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items: SegmentMediaItem[] = value
    .map((item: any, index: number) => {
      const raw = item ?? {};
      const urlRaw = raw.url ?? raw.media_url ?? raw.mediaUrl;
      const promptRaw = raw.prompt ?? raw.media_prompt ?? raw.mediaPrompt;
      const url =
        typeof urlRaw === 'string' && urlRaw.trim() ? String(urlRaw) : undefined;
      const prompt =
        typeof promptRaw === 'string' && String(promptRaw).trim()
          ? String(promptRaw)
          : undefined;
      const sourceRaw = raw.source ?? raw.media_source;
      const source: SegmentMediaItem['source'] =
        sourceRaw === 'local' || sourceRaw === 'remote' || sourceRaw === 'generated'
          ? sourceRaw
          : url
            ? url.startsWith('http')
              ? 'remote'
              : 'local'
            : prompt
              ? 'generated'
              : undefined;
      return {
        id: normalizeText(raw.id, `media-${index + 1}`),
        label: normalizeText(
          raw.label ?? raw.media_label,
          fallbackLabel ?? `素材 ${index + 1}`,
        ),
        url,
        prompt,
        source,
      };
    })
    .filter((item: any) => item.url || item.prompt);
  return items.length ? items : undefined;
};

const normalizeSegments = (
  segments: unknown,
  fps: number,
  navigationItems?: string[],
): SegmentConfig[] => {
  const defaults = defaultAccountProject.segments;
  const incoming = Array.isArray(segments) ? segments : [];
  const sourceSegments = incoming.length ? incoming : defaults;
  return sourceSegments.map((segment: any, index: number) => {
    const defaultSegment = defaults[index] ?? defaults[defaults.length - 1];
    const raw = segment ?? {};
    const durationSeconds = normalizeFiniteNumber(
      raw.duration_sec ?? raw.durationSeconds,
    );
    const durationFrames = normalizeFiniteNumber(
      raw.durationInFrames ?? raw.duration_frames ?? raw.duration_in_frames,
    );
    const mediaItems = normalizeMediaItems(
      raw.mediaItems ?? raw.media_items,
      defaultSegment.mediaLabel,
    );
    const fallbackMedia = mediaItems?.[0];
    const points: string[] = Array.isArray(raw.points)
      ? raw.points.map((item: unknown) => String(item)).filter(Boolean)
      : defaultSegment.points;
    return {
      ...defaultSegment,
      id: normalizeText(raw.id, defaultSegment.id),
      label: normalizeText(raw.label ?? raw.name, defaultSegment.label),
      navLabel: normalizeText(
        raw.navLabel ?? raw.nav_label ?? navigationItems?.[index] ?? raw.name,
        defaultSegment.navLabel,
      ),
      durationInFrames:
        typeof durationFrames === 'number'
          ? Math.max(24, Math.round(durationFrames))
          : typeof durationSeconds === 'number'
            ? Math.max(24, Math.round(durationSeconds * fps))
            : defaultSegment.durationInFrames,
      layout: isLayout(
        String(raw.layout ?? defaultSegment.layout),
      )
        ? (String(raw.layout ?? defaultSegment.layout) as SegmentLayout)
        : defaultSegment.layout,
      motionPreset: isMotion(
        String(raw.motion_preset ?? raw.motionPreset ?? defaultSegment.motionPreset),
      )
        ? (String(raw.motion_preset ?? raw.motionPreset ?? defaultSegment.motionPreset) as MotionPreset)
        : defaultSegment.motionPreset,
      visualPreset: isVisual(
        String(raw.visual_preset ?? raw.visualPreset ?? defaultSegment.visualPreset),
      )
        ? (String(raw.visual_preset ?? raw.visualPreset ?? defaultSegment.visualPreset) as VisualPreset)
        : defaultSegment.visualPreset,
      title: normalizeText(raw.title, defaultSegment.title),
      subtitle: normalizeText(raw.subtitle ?? raw.sub_title, defaultSegment.subtitle),
      bottomConclusion: normalizeText(
        raw.bottomConclusion ?? raw.bottom_conclusion,
        defaultSegment.bottomConclusion,
      ),
      voiceoverText: normalizeText(
        raw.voiceoverText ?? raw.voiceover_text,
        defaultSegment.voiceoverText,
      ),
      humanConclusion: normalizeText(
        raw.humanConclusion ?? raw.human_conclusion,
        defaultSegment.humanConclusion ?? '',
      ),
      subtitleSecondaryText: normalizeText(
        raw.subtitleSecondaryText ?? raw.subtitle_secondary_text,
        defaultSegment.subtitleSecondaryText ?? '',
      ),
      points,
      mediaLabel: normalizeText(
        raw.mediaLabel ?? raw.media_label ?? fallbackMedia?.label,
        defaultSegment.mediaLabel,
      ),
      mediaUrl: raw.mediaUrl
        ? String(raw.mediaUrl)
        : raw.media_url
          ? String(raw.media_url)
          : (fallbackMedia?.url ?? defaultSegment.mediaUrl),
      mediaPrompt: normalizeText(
        raw.mediaPrompt ?? raw.media_prompt ?? fallbackMedia?.prompt,
        defaultSegment.mediaPrompt ?? '',
      ),
      mediaItems,
      stickScene:
        (raw.stickScene ?? raw.stick_scene) &&
        typeof (raw.stickScene ?? raw.stick_scene) === 'object'
          ? (raw.stickScene ?? raw.stick_scene)
          : undefined,
      evidenceText: normalizeText(
        raw.evidenceText ?? raw.evidence_text,
        defaultSegment.evidenceText ?? '',
      ),
      audioStartSec: normalizeFiniteNumber(raw.audioStartSec ?? raw.audio_start_sec),
      audioEndSec: normalizeFiniteNumber(raw.audioEndSec ?? raw.audio_end_sec),
      cuePointsSec: Array.isArray(raw.cuePointsSec ?? raw.cue_points_sec)
        ? (raw.cuePointsSec ?? raw.cue_points_sec)
            .map((item: unknown) => Number(item))
            .filter((item: number) => Number.isFinite(item))
        : undefined,
      needsGithubEvidence:
        normalizeBoolean(raw.needsGithubEvidence ?? raw.needs_github_evidence) ??
        defaultSegment.needsGithubEvidence ??
        false,
    };
  });
};

export const toEditorConfig = (payload: unknown): AccountProjectConfig => {
  const defaultConfig = cloneProjectConfig(defaultAccountProject);
  if (!payload || typeof payload !== 'object') {
    throw new Error('导入内容不是有效对象。');
  }
  const raw = payload as any;

  if (raw.meta && raw.theme && raw.tags && raw.segments) {
    const meta = raw.meta;
    const fps = normalizeCompositionFps(meta.fps, defaultConfig.meta.fps);
    return {
      meta: {
        projectName: normalizeText(
          meta.projectName ?? meta.project_name,
          defaultConfig.meta.projectName,
        ),
        accountName: normalizeText(
          meta.accountName ?? meta.account_name,
          defaultConfig.meta.accountName,
        ),
        positioning: normalizeText(
          meta.positioning ?? meta.account_positioning,
          defaultConfig.meta.positioning,
        ),
        width: normalizeCompositionWidth(meta.width, defaultConfig.meta.width),
        height: normalizeCompositionHeight(meta.height, defaultConfig.meta.height),
        fps,
        visualSkin: parseAccountVisualSkinHint(
          normalizeText(
            meta.visualSkin ?? meta.visual_skin ?? raw.theme.visual_style,
            '',
          ),
        ),
        subtitleMode: normalizeSubtitleMode(meta.subtitleMode ?? meta.subtitle_mode),
      },
      theme: {
        accentColor: normalizeText(
          raw.theme.accentColor ?? raw.theme.accent_color,
          defaultConfig.theme.accentColor,
        ),
        secondaryColor: normalizeText(
          raw.theme.secondaryColor ?? raw.theme.secondary_color,
          defaultConfig.theme.secondaryColor,
        ),
        pageLight: normalizeText(
          raw.theme.pageLight ?? raw.theme.page_light,
          defaultConfig.theme.pageLight,
        ),
        pageDark: normalizeText(
          raw.theme.pageDark ?? raw.theme.page_dark,
          defaultConfig.theme.pageDark,
        ),
      },
      tags: {
        left: normalizeText(
          raw.tags.left ?? raw.tags.left_tag,
          defaultConfig.tags.left,
        ),
        right: normalizeText(
          raw.tags.right ?? raw.tags.right_tag,
          defaultConfig.tags.right,
        ),
      },
      segments: normalizeSegments(raw.segments, fps),
    };
  }

  if (raw.meta && raw.segments) {
    const meta = raw.meta;
    const theme = raw.theme ?? {};
    const cover = raw.cover ?? {};
    const navigation = raw.navigation ?? {};
    const fps = normalizeCompositionFps(meta.fps, defaultConfig.meta.fps);
    const navigationItems: string[] | undefined = Array.isArray(navigation.items)
      ? navigation.items.map((item: unknown) => String(item))
      : undefined;
    const config: AccountProjectConfig = {
      meta: {
        projectName: normalizeText(
          meta.project_name ?? meta.projectName,
          defaultConfig.meta.projectName,
        ),
        accountName: normalizeText(
          meta.account_name ?? meta.accountName,
          defaultConfig.meta.accountName,
        ),
        positioning: normalizeText(
          meta.account_positioning ?? meta.positioning,
          defaultConfig.meta.positioning,
        ),
        width: normalizeCompositionWidth(meta.width, defaultConfig.meta.width),
        height: normalizeCompositionHeight(meta.height, defaultConfig.meta.height),
        fps,
        visualSkin: parseAccountVisualSkinHint(
          normalizeText(
            meta.visual_skin ?? meta.visualSkin ?? theme.visual_style,
            '',
          ),
        ),
        subtitleMode: normalizeSubtitleMode(
          meta.subtitle_mode ?? meta.subtitleMode,
        ),
      },
      theme: {
        accentColor: normalizeText(
          theme.accent_color ?? theme.accentColor,
          defaultConfig.theme.accentColor,
        ),
        secondaryColor: normalizeText(
          theme.secondary_color ?? theme.secondaryColor,
          defaultConfig.theme.secondaryColor,
        ),
        pageLight: normalizeText(
          theme.page_light ?? theme.pageLight,
          defaultConfig.theme.pageLight,
        ),
        pageDark: normalizeText(
          theme.page_dark ?? theme.pageDark,
          defaultConfig.theme.pageDark,
        ),
      },
      tags: {
        left: normalizeText(
          cover.left_tag ?? cover.leftTag,
          defaultConfig.tags.left,
        ),
        right: normalizeText(
          cover.right_tag ?? cover.rightTag,
          defaultConfig.tags.right,
        ),
      },
      segments: normalizeSegments(raw.segments, fps, navigationItems),
    };
    if (config.segments[0]) {
      config.segments[0] = {
        ...config.segments[0],
        title: normalizeText(
          cover.main_title ?? cover.mainTitle,
          config.segments[0].title,
        ),
        subtitle: normalizeText(
          cover.sub_title ?? cover.subTitle,
          config.segments[0].subtitle,
        ),
        bottomConclusion: normalizeText(
          cover.bottom_conclusion ?? cover.bottomConclusion,
          config.segments[0].bottomConclusion,
        ),
      };
    }
    return config;
  }

  throw new Error('没有找到可识别的项目配置结构。');
};

const inferMediaType = (
  segment: SegmentConfig,
): 'uploaded_image' | 'generated_image' | 'mixed' => {
  const mediaItems = getSegmentMediaItems(segment);
  const hasUrl = mediaItems.some((item) => item.url);
  const hasPrompt = mediaItems.some((item) => item.prompt);
  if (hasUrl && hasPrompt) {
    return 'mixed';
  }
  if (hasUrl) {
    return 'uploaded_image';
  }
  return 'generated_image';
};

export const toTemplateConfig = (config: AccountProjectConfig) => {
  const firstSegment = config.segments[0];
  return {
    meta: {
      project_name: config.meta.projectName,
      account_name: config.meta.accountName,
      account_positioning: config.meta.positioning,
      width: config.meta.width,
      height: config.meta.height,
      fps: config.meta.fps,
      visual_skin: normalizeAccountVisualSkin(config.meta.visualSkin),
      subtitle_mode: normalizeSubtitleMode(config.meta.subtitleMode),
    },
    theme: {
      accent_color: config.theme.accentColor,
      secondary_color: config.theme.secondaryColor,
      page_light: config.theme.pageLight,
      page_dark: config.theme.pageDark,
      visual_style: getSkinLabel(config.meta.visualSkin),
      title_style: '',
    },
    cover: {
      main_title: firstSegment?.title ?? config.meta.projectName,
      sub_title: firstSegment?.subtitle ?? '',
      left_tag: config.tags.left,
      right_tag: config.tags.right,
      bottom_conclusion: firstSegment?.bottomConclusion ?? '',
    },
    navigation: {
      items: config.segments.map((segment) => segment.navLabel),
    },
    segments: config.segments.map((segment) => {
      const mediaItems = getSegmentMediaItems(segment);
      return {
        id: segment.id,
        name: segment.label,
        duration_sec: Number(
          (segment.durationInFrames / config.meta.fps).toFixed(2),
        ),
        layout: segment.layout,
        motion_preset: segment.motionPreset,
        visual_preset: segment.visualPreset,
        title: segment.title,
        subtitle: segment.subtitle,
        bottom_conclusion: segment.bottomConclusion,
        voiceover_text: segment.voiceoverText,
        human_conclusion: segment.humanConclusion ?? '',
        subtitle_secondary_text: segment.subtitleSecondaryText ?? '',
        points: segment.points,
        media_label: segment.mediaLabel,
        media_type: inferMediaType(segment),
        media_url: segment.mediaUrl,
        media_prompt: segment.mediaPrompt ?? '',
        media_items: mediaItems.map((item) => ({
          id: item.id,
          label: item.label,
          media_url: item.url,
          media_prompt: item.prompt ?? '',
          source: item.source ?? '',
        })),
        stick_scene: segment.stickScene,
        audio_start_sec: segment.audioStartSec,
        audio_end_sec: segment.audioEndSec,
        cue_points_sec: segment.cuePointsSec ?? [],
        needs_github_evidence: segment.needsGithubEvidence ?? false,
        evidence_text: segment.evidenceText ?? '',
      };
    }),
  };
};

const extractBalancedJson = (text: string): string | null => {
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let isEscaped = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }
  return null;
};

export const extractPromptJson = (text: string): unknown => {
  const candidates: string[] = [];
  const fencedMatches = Array.from(text.matchAll(/```json\s*([\s\S]*?)```/gi));
  for (const match of fencedMatches) {
    candidates.push(match[1].trim());
  }
  const plainFencedMatches = Array.from(text.matchAll(/```\s*([\s\S]*?)```/gi));
  for (const match of plainFencedMatches) {
    candidates.push(match[1].trim());
  }
  if (text.trim().startsWith('{')) {
    candidates.push(text.trim());
  }
  const balanced = extractBalancedJson(text);
  if (balanced) {
    candidates.push(balanced.trim());
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }
  throw new Error(
    '没有从内容里提取到有效 JSON。请确认提示词输出末尾带 ```json 代码块。',
  );
};
