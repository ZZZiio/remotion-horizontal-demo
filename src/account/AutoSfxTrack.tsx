import React, {useMemo} from 'react';
import {Audio, Sequence} from 'remotion';
import type {AccountProjectConfig} from './config';

type SfxEvent = {
  id: string;
  from: number;
  durationInFrames: number;
  src: string;
  volume: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
};

const writeString = (view: DataView, offset: number, value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};

const encodeWav = (samples: Float32Array, sampleRate: number) => {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = clamp(samples[index] ?? 0, -1, 1);
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
};

const buildClickWav = (sampleRate = 44100, durationSec = 0.07) => {
  const length = Math.max(1, Math.round(durationSec * sampleRate));
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const t = index / sampleRate;
    const env = Math.exp(-t * 34);
    samples[index] = Math.sin(2 * Math.PI * 1200 * t) * env * 0.55;
  }
  const bytes = encodeWav(samples, sampleRate);
  return `data:audio/wav;base64,${bytesToBase64(bytes)}`;
};

const buildWhooshWav = (sampleRate = 44100, durationSec = 0.22) => {
  const length = Math.max(1, Math.round(durationSec * sampleRate));
  const samples = new Float32Array(length);
  const rand = seededRandom(1337);

  for (let index = 0; index < length; index += 1) {
    const t = index / sampleRate;
    const progress = t / durationSec;
    const attack = clamp(progress / 0.08, 0, 1);
    const release = clamp((1 - progress) / 0.38, 0, 1);
    const env = Math.pow(attack, 1.2) * Math.pow(release, 1.4);
    const noise = (rand() * 2 - 1) * 0.55;
    const sweepFreq = 420 + progress * 1380;
    const tone = Math.sin(2 * Math.PI * sweepFreq * t) * 0.25;
    samples[index] = (noise + tone) * env * 0.9;
  }

  const bytes = encodeWav(samples, sampleRate);
  return `data:audio/wav;base64,${bytesToBase64(bytes)}`;
};

const CLICK_SRC = buildClickWav();
const WHOOSH_SRC = buildWhooshWav();
const CLICK_DURATION_SEC = 0.07;
const WHOOSH_DURATION_SEC = 0.22;

const pickKeywordFrames = (segment: {durationInFrames: number; cuePointsSec?: number[]}, fps: number) => {
  const duration = Math.max(1, segment.durationInFrames || 1);
  const rawFrames = (segment.cuePointsSec ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .map((value) => Math.round(value * fps))
    .filter((frame) => frame > 0 && frame < duration - 1);

  if (!rawFrames.length) {
    const f1 = Math.round(duration * 0.35);
    const f2 = Math.round(duration * 0.7);
    return [f1, f2].filter((frame) => frame > 10 && frame < duration - 10);
  }

  const unique = Array.from(new Set(rawFrames)).sort((a, b) => a - b);
  const minGap = Math.round(fps * 0.85);
  const safeStart = Math.round(fps * 0.35);
  const safeEnd = duration - Math.round(fps * 0.25);
  const safeFrames = unique.filter((frame) => frame >= safeStart && frame <= safeEnd);

  // Reduce SFX spam: only pick 1st / 3rd / 5th cue points (per segment),
  // then enforce a minimum gap to avoid clustered clicks.
  const candidateIndexes = [0, 2, 4];
  const candidates = candidateIndexes
    .map((index) => safeFrames[index])
    .filter((frame): frame is number => typeof frame === 'number');

  const selected: number[] = [];
  const fallbackPool = candidates.length ? candidates : safeFrames.length ? safeFrames : unique;
  for (const frame of fallbackPool) {
    if (!selected.length || frame - selected[selected.length - 1]! >= minGap) {
      selected.push(frame);
    }
    if (selected.length >= 3) break;
  }

  return selected.length ? selected : unique.slice(0, 1);
};

export const AutoSfxTrack: React.FC<{config: AccountProjectConfig}> = ({config}) => {
  const fps = config.meta.fps;
  const enabled = config.meta.sfxEnabled !== false;
  const baseVolume = typeof config.meta.sfxVolume === 'number' ? config.meta.sfxVolume : 0.7;

  const events = useMemo(() => {
    if (!enabled) return [] as SfxEvent[];

    let cursor = 0;
    const nextEvents: SfxEvent[] = [];

    config.segments.forEach((segment, segmentIndex) => {
      const segmentStart = cursor;
      cursor += segment.durationInFrames;

      const isFirst = segmentIndex === 0;
      const transitionVolume = clamp(baseVolume * (isFirst ? 0.55 : 0.8), 0, 2);
      nextEvents.push({
        id: `transition-${segment.id}-${segmentStart}`,
        from: segmentStart,
        durationInFrames: Math.max(4, Math.ceil(WHOOSH_DURATION_SEC * fps)),
        src: WHOOSH_SRC,
        volume: transitionVolume,
      });

      const keywordFrames = pickKeywordFrames(segment, fps);
      const keywordVolume = clamp(baseVolume * 0.55, 0, 2);
      keywordFrames.forEach((frame, index) => {
        nextEvents.push({
          id: `keyword-${segment.id}-${frame}-${index}`,
          from: segmentStart + frame,
          durationInFrames: Math.max(3, Math.ceil(CLICK_DURATION_SEC * fps)),
          src: CLICK_SRC,
          volume: keywordVolume,
        });
      });
    });

    return nextEvents;
  }, [baseVolume, config.segments, enabled, fps]);

  if (!events.length) {
    return null;
  }

  return (
    <>
      {events.map((event) => (
        <Sequence key={event.id} from={event.from} durationInFrames={event.durationInFrames}>
          <Audio src={event.src} volume={event.volume} />
        </Sequence>
      ))}
    </>
  );
};
