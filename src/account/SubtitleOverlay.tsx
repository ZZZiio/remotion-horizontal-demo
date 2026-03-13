import React, {useMemo} from 'react';
import {cuePulse, fadeInUp} from '../lib/motion';
import type {AccountSkinProfile} from './skins';

const PUNCTUATION = new Set(['\uFF0C', '\u3002', '\uFF01', '\uFF1F', '\uFF1B', '\uFF1A', ',', '.', '!', '?', ';', ':']);
const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('zh', {granularity: 'grapheme'}) : null;

const splitGraphemes = (text: string) => {
  if (!text) {
    return [] as string[];
  }

  if (!graphemeSegmenter) {
    return Array.from(text);
  }

  return Array.from(graphemeSegmenter.segment(text), (item) => item.segment);
};

const splitByPunctuation = (text: string) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [] as string[];
  }

  const chunks: string[] = [];
  let buffer = '';
  for (const char of normalized) {
    buffer += char;
    if (PUNCTUATION.has(char)) {
      chunks.push(buffer.trim());
      buffer = '';
    }
  }

  if (buffer.trim()) {
    chunks.push(buffer.trim());
  }

  return chunks.filter(Boolean);
};

const splitLongChunk = (chunk: string, idealLength = 18) => {
  if (chunk.length <= idealLength + 4) {
    return [chunk];
  }

  const pieces: string[] = [];
  let current = '';
  for (const char of chunk) {
    current += char;
    if (current.length >= idealLength && ['\uFF0C', '\u3001', ' ', ',', '\uFF1B'].includes(char)) {
      pieces.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    pieces.push(current.trim());
  }

  if (pieces.length <= 1) {
    const forced: string[] = [];
    for (let index = 0; index < chunk.length; index += idealLength) {
      forced.push(chunk.slice(index, index + idealLength).trim());
    }
    return forced.filter(Boolean);
  }

  return pieces.filter(Boolean);
};

const mergeToTargetCount = (items: string[], targetCount: number) => {
  if (items.length <= targetCount) {
    return items;
  }

  const totalLength = items.reduce((sum, item) => sum + item.length, 0);
  const targetLength = Math.ceil(totalLength / targetCount);
  const merged: string[] = [];
  let current = '';

  for (const item of items) {
    if (!current) {
      current = item;
      continue;
    }

    if (merged.length < targetCount - 1 && current.length + item.length <= targetLength + 6) {
      current += item;
    } else {
      merged.push(current.trim());
      current = item;
    }
  }

  if (current.trim()) {
    merged.push(current.trim());
  }

  if (merged.length <= targetCount) {
    return merged;
  }

  const compact = [...merged];
  while (compact.length > targetCount) {
    const last = compact.pop() ?? '';
    compact[compact.length - 1] = `${compact[compact.length - 1]}${last}`;
  }

  return compact;
};

const buildSubtitleChunks = (voiceoverText: string, cueFrames: number[]) => {
  const fallback = voiceoverText.replace(/\s+/g, ' ').trim();
  if (!fallback) {
    return [''];
  }

  const raw = splitByPunctuation(fallback);
  const expanded = (raw.length ? raw : [fallback]).flatMap((item) => splitLongChunk(item));
  const targetCount = Math.max(1, Math.min(6, cueFrames.length + 1 || 1));
  const chunks = mergeToTargetCount(expanded, targetCount);
  return chunks.length ? chunks : [fallback];
};

const clampCueFramesForSubtitles = (cueFrames: number[], durationInFrames: number, fps: number) => {
  if (!cueFrames.length) {
    return [] as number[];
  }

  const minGapFrames = Math.max(4, Math.round(fps * 0.4));
  const maxCues = Math.min(10, Math.max(2, Math.floor(durationInFrames / (fps * 2.4))));
  const filtered = cueFrames
    .filter((frame) => Number.isFinite(frame) && frame > 0 && frame < durationInFrames)
    .sort((a, b) => a - b);

  const deduped: number[] = [];
  for (const frame of filtered) {
    if (!deduped.length || frame - deduped[deduped.length - 1] >= minGapFrames) {
      deduped.push(frame);
    }
  }

  if (deduped.length <= maxCues) {
    return deduped;
  }

  const stride = (deduped.length - 1) / maxCues;
  const sampled: number[] = [];
  for (let index = 1; index <= maxCues; index += 1) {
    const pick = Math.min(deduped.length - 1, Math.round(index * stride));
    sampled.push(deduped[pick]);
  }

  const unique = Array.from(new Set(sampled)).sort((a, b) => a - b);
  return unique.length ? unique : deduped.slice(0, maxCues);
};

const buildHighlightKeywords = (points: string[]) => {
  if (!points?.length) {
    return [] as string[];
  }

  const tokens: string[] = [];
  for (const point of points) {
    const normalized = String(point ?? '').replace(/[\uFF08(].*?[\uFF09)]/g, '').trim();
    if (!normalized) {
      continue;
    }
    const parts = normalized
      .split(/[\uFF0C\u3002\uFF1F\uFF01\uFF1B.;:\s]+/g)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 8);
    for (const part of parts) {
      tokens.push(part);
    }
  }

  const unique: string[] = [];
  for (const token of tokens) {
    if (!unique.includes(token)) {
      unique.push(token);
    }
  }

  return unique.sort((a, b) => b.length - a.length).slice(0, 6);
};

const highlightText = (text: string, keywords: string[]) => {
  if (!keywords.length) {
    return text;
  }

  const parts: Array<string | {value: string}> = [];
  let cursor = 0;
  while (cursor < text.length) {
    let bestIndex = -1;
    let bestWord = '';
    for (const keyword of keywords) {
      const index = text.indexOf(keyword, cursor);
      if (index === -1) {
        continue;
      }
      if (bestIndex === -1 || index < bestIndex || (index === bestIndex && keyword.length > bestWord.length)) {
        bestIndex = index;
        bestWord = keyword;
      }
    }

    if (bestIndex === -1) {
      parts.push(text.slice(cursor));
      break;
    }

    if (bestIndex > cursor) {
      parts.push(text.slice(cursor, bestIndex));
    }

    parts.push({value: bestWord});
    cursor = bestIndex + bestWord.length;
  }

  return parts;
};

const buildSwitchFrames = (durationInFrames: number, cueFrames: number[], chunkCount: number) => {
  const desired = Math.max(0, chunkCount - 1);
  if (desired === 0) {
    return [] as number[];
  }

  if (cueFrames.length >= desired) {
    return cueFrames.slice(0, desired);
  }

  const fallback: number[] = [];
  for (let index = 1; index <= desired; index++) {
    fallback.push(Math.round((durationInFrames * index) / chunkCount));
  }

  return fallback;
};

export const SubtitleOverlay: React.FC<{
  frame: number;
  fps: number;
  durationInFrames: number;
  voiceoverText: string;
  cueFrames: number[];
  points: string[];
  skin: AccountSkinProfile;
  left?: number;
  bottom?: number;
  width?: number;
  subtitleMode?: 'single' | 'bilingual-keywords' | 'bilingual-full';
  secondaryText?: string;
  takeawayText?: string;
}> = ({
  frame,
  fps,
  durationInFrames,
  voiceoverText,
  cueFrames,
  points = [],
  skin,
  left = 72,
  bottom = 114,
  width = 780,
}) => {
  const normalizedCueFrames = useMemo(
    () => clampCueFramesForSubtitles(cueFrames, durationInFrames, fps),
    [cueFrames, durationInFrames, fps],
  );
  const subtitleChunks = useMemo(
    () => buildSubtitleChunks(voiceoverText, normalizedCueFrames),
    [voiceoverText, normalizedCueFrames],
  );
  const switchFrames = useMemo(
    () => buildSwitchFrames(durationInFrames, normalizedCueFrames, subtitleChunks.length),
    [durationInFrames, normalizedCueFrames, subtitleChunks.length],
  );
  const highlightKeywords = useMemo(() => buildHighlightKeywords(points), [points]);

  const activeIndex = Math.min(
    subtitleChunks.length - 1,
    switchFrames.reduce((count, switchFrame) => (frame >= switchFrame ? count + 1 : count), 0),
  );
  const activeChunk = subtitleChunks[activeIndex] || voiceoverText;
  const chunkStartFrame = activeIndex === 0 ? 0 : (switchFrames[activeIndex - 1] ?? 0);
  const chunkEndFrame = activeIndex < switchFrames.length ? (switchFrames[activeIndex] ?? durationInFrames) : durationInFrames;
  const chunkDuration = Math.max(1, chunkEndFrame - chunkStartFrame);
  const fadeInFrames = Math.max(8, Math.round(fps * 0.4));
  const fadeOutFrames = Math.max(8, Math.round(fps * 0.4));
  const chunkFadeIn = Math.min(1, Math.max(0, (frame - chunkStartFrame) / fadeInFrames));
  const chunkFadeOut = Math.min(1, Math.max(0, (chunkEndFrame - frame) / fadeOutFrames));
  const chunkOpacity = Math.max(0, Math.min(1, chunkFadeIn * chunkFadeOut));
  const highlightedParts = useMemo(() => highlightText(activeChunk, highlightKeywords), [activeChunk, highlightKeywords]);
  const pulse = cuePulse({frame, cueFrames: switchFrames.length ? switchFrames : normalizedCueFrames, spread: 12, intensity: 1});

  return (
    <div
      style={{
        position: 'absolute',
        left,
        bottom,
        width,
        zIndex: 60,
        pointerEvents: 'none',
        ...fadeInUp({frame, fps, delay: 8, duration: 18, distance: 18}),
      }}
    >
      <div
        style={{
          padding: '14px 18px 15px',
          borderRadius: 22,
          background: 'linear-gradient(135deg, rgba(6,15,25,0.92), rgba(9,22,34,0.84))',
          border: `1px solid ${skin.overlayCardBorder}`,
          boxShadow: '0 18px 44px rgba(0,0,0,0.26)',
          backdropFilter: 'blur(14px)',
        }}
      >
            <div
              style={{
                fontSize: 25,
                lineHeight: 1.4,
                fontWeight: 900,
                color: '#F5FCFF',
                textShadow: `0 0 ${Math.round(10 + pulse * 10)}px ${skin.secondaryColor}18`,
                letterSpacing: 0.2,
                wordBreak: 'break-word',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                opacity: chunkOpacity,
                transition: 'opacity 0.12s linear',
              }}
            >
          {Array.isArray(highlightedParts)
            ? highlightedParts.map((part, index) =>
                typeof part === 'string' ? (
                  part
                ) : (
                  <span
                    key={`${part.value}-${index}`}
                    style={{
                      color: skin.accentColor,
                      textShadow: `0 0 14px ${skin.accentColor}66`,
                    }}
                  >
                    {part.value}
                  </span>
                ),
              )
            : highlightedParts}
        </div>
      </div>
    </div>
  );
};








