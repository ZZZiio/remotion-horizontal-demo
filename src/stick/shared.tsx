import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {StickActorConfig, StickBubbleConfig, StickBeatConfig} from '../account/config';
import {StickActor} from './actors/StickActor';

export const isStickVisualPreset = (value?: string | null) => {
  return value === 'stick-dialogue' || value === 'stick-conflict' || value === 'stick-compare' || value === 'stick-narration';
};

export const getActorX = (position: StickActorConfig['position']) => {
  switch (position) {
    case 'left':
      return 148;
    case 'right':
      return 494;
    case 'center':
    default:
      return 320;
  }
};

export const stageStyles: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  background: 'linear-gradient(180deg, rgba(5,14,24,0.96), rgba(9,21,33,0.92))',
};

export const StageCamera: React.FC<{
  children: React.ReactNode;
  enabled?: boolean;
  focusX?: number;
  focusY?: number;
  zoom?: number;
}> = ({children, enabled = true, focusX = 320, focusY = 180, zoom = 1.04}) => {
  const frame = useCurrentFrame();
  const driftX = Math.sin(frame / 24) * 1.6;
  const driftY = Math.cos(frame / 28) * 1.2;
  const targetZoom = enabled ? zoom : 1;
  const translateX = enabled ? (320 - focusX) * 0.22 + driftX : 0;
  const translateY = enabled ? (170 - focusY) * 0.14 + driftY : 0;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${targetZoom})`,
        transformOrigin: '50% 50%',
      }}
    >
      {children}
    </div>
  );
};

const isBeatActiveAtFrame = (beat: StickBeatConfig, frame: number) => {
  const duration = beat.durationInFrames ?? 24;
  return frame >= beat.startFrame && frame < beat.startFrame + duration;
};

export const getActiveEffectBeat = (beats: StickBeatConfig[] | undefined, frame: number) => {
  return beats?.find((beat) => beat.type !== 'caption' && isBeatActiveAtFrame(beat, frame));
};

export const getActiveActorBeat = (beats: StickBeatConfig[] | undefined, actorId: string, frame: number) => {
  return beats
    ?.slice()
    .reverse()
    .find((beat) => beat.actorId === actorId && ['enter', 'exit', 'shake', 'nod', 'turn', 'freeze'].includes(beat.type) && isBeatActiveAtFrame(beat, frame));
};

export const getBeatProgress = (beat: StickBeatConfig | undefined, frame: number) => {
  if (!beat) {
    return 0;
  }

  return Math.max(0, frame - beat.startFrame);
};

export const getSmartCameraState = ({
  actors,
  bubbles,
  beats,
  frame,
  fallbackX = 320,
  fallbackY = 176,
}: {
  actors: StickActorConfig[];
  bubbles?: StickBubbleConfig[];
  beats?: StickBeatConfig[];
  frame: number;
  fallbackX?: number;
  fallbackY?: number;
}) => {
  const effectBeat = getActiveEffectBeat(beats, frame);
  const beatActor = effectBeat?.actorId ? actors.find((actor) => actor.id === effectBeat.actorId) : undefined;
  const motionBeatActor = actors.find((actor) => getActiveActorBeat(beats, actor.id, frame));
  const bubbleActor = actors.find((actor) => findActiveBubble(bubbles ?? [], actor.id, frame));
  const focusActor = beatActor ?? motionBeatActor ?? bubbleActor;
  const focusX = focusActor ? getActorX(focusActor.position ?? 'center') : fallbackX;
  const focusY = fallbackY;
  const motionBeat = motionBeatActor ? getActiveActorBeat(beats, motionBeatActor.id, frame) : undefined;
  const zoom = effectBeat?.type === 'exclamation' || effectBeat?.type === 'question'
    ? 1.1
    : motionBeat?.type === 'shake' || motionBeat?.type === 'turn'
      ? 1.09
      : motionBeat?.type === 'enter' || motionBeat?.type === 'exit'
        ? 1.06
        : focusActor
          ? 1.07
          : 1.03;

  return {
    focusX,
    focusY,
    zoom,
    effectBeat,
    focusActor,
  };
};

export const getActorBeatMotion = ({
  actor,
  beat,
  frame,
}: {
  actor: StickActorConfig;
  beat?: StickBeatConfig;
  frame: number;
}) => {
  if (!beat) {
    return {
      translateX: 0,
      translateY: 0,
      rotate: 0,
      scale: 1,
      scaleX: 1,
      opacity: 1,
      mirrorFlip: false,
      freeze: false,
    };
  }

  const duration = Math.max(1, beat.durationInFrames ?? 24);
  const progress = Math.max(0, Math.min(duration, frame - beat.startFrame));
  const intensity = Math.max(0.6, Math.min(1.8, beat.value ?? 1));
  const offscreenDirection = actor.position === 'right' ? 1 : actor.position === 'center' ? 0 : -1;

  if (beat.type === 'enter') {
    return {
      translateX: interpolate(progress, [0, duration], [offscreenDirection * 118, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      translateY: interpolate(progress, [0, duration], [18, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      rotate: interpolate(progress, [0, duration], [offscreenDirection * 8, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      scale: interpolate(progress, [0, duration], [0.86, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      scaleX: 1,
      opacity: interpolate(progress, [0, Math.min(8, duration)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      mirrorFlip: false,
      freeze: false,
    };
  }

  if (beat.type === 'exit') {
    return {
      translateX: interpolate(progress, [0, duration], [0, offscreenDirection * 118], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      translateY: interpolate(progress, [0, duration], [0, -10], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      rotate: interpolate(progress, [0, duration], [0, offscreenDirection * 9], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      scale: interpolate(progress, [0, duration], [1, 0.88], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      scaleX: 1,
      opacity: interpolate(progress, [0, duration], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      mirrorFlip: false,
      freeze: false,
    };
  }

  if (beat.type === 'shake') {
    return {
      translateX: Math.sin(progress * 1.8) * 12 * intensity,
      translateY: Math.cos(progress * 1.2) * 2.2,
      rotate: Math.sin(progress * 1.55) * 5 * intensity,
      scale: 1,
      scaleX: 1,
      opacity: 1,
      mirrorFlip: false,
      freeze: false,
    };
  }

  if (beat.type === 'nod') {
    return {
      translateX: 0,
      translateY: Math.abs(Math.sin((progress / duration) * Math.PI * 2)) * 7 * intensity,
      rotate: Math.sin((progress / duration) * Math.PI * 2) * 7,
      scale: 1,
      scaleX: 1,
      opacity: 1,
      mirrorFlip: false,
      freeze: false,
    };
  }

  if (beat.type === 'turn') {
    const squish = interpolate(progress, [0, duration * 0.35, duration * 0.5, duration], [1, 0.74, 0.22, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return {
      translateX: Math.sin((progress / duration) * Math.PI) * 10 * intensity,
      translateY: 0,
      rotate: Math.sin((progress / duration) * Math.PI) * 4,
      scale: 1,
      scaleX: squish,
      opacity: 1,
      mirrorFlip: progress >= duration * 0.5,
      freeze: false,
    };
  }

  if (beat.type === 'freeze') {
    return {
      translateX: 0,
      translateY: 0,
      rotate: 0,
      scale: 1,
      scaleX: 1,
      opacity: 1,
      mirrorFlip: false,
      freeze: true,
    };
  }

  return {
    translateX: 0,
    translateY: 0,
    rotate: 0,
    scale: 1,
    scaleX: 1,
    opacity: 1,
    mirrorFlip: false,
    freeze: false,
  };
};

export const StickBackdrop: React.FC<{
  accentColor: string;
  secondaryColor: string;
  variant?: 'plain' | 'room' | 'office' | 'street' | 'classroom';
  dramatic?: boolean;
}> = ({accentColor, secondaryColor, variant = 'plain', dramatic = false}) => {
  return (
    <div style={stageStyles}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: dramatic
            ? 'radial-gradient(circle at 50% 18%, rgba(255,96,96,0.20), transparent 38%), linear-gradient(180deg, rgba(18,7,12,0.12), transparent 34%)'
            : `radial-gradient(circle at 50% 20%, ${accentColor}22, transparent 38%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 144,
          background: 'linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.06))',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      />
      {variant !== 'plain' ? (
        <>
          <div style={{position: 'absolute', left: 46, top: 54, width: 102, height: 70, borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)'}} />
          <div style={{position: 'absolute', right: 44, top: 58, width: 128, height: 76, borderRadius: 20, border: `1px solid ${secondaryColor}33`}} />
          {variant === 'office' || variant === 'classroom' ? (
            <div style={{position: 'absolute', left: 208, top: 58, width: 224, height: 94, borderRadius: 20, border: '1px solid rgba(255,255,255,0.09)'}} />
          ) : null}
          {variant === 'street' ? (
            <div style={{position: 'absolute', left: 0, right: 0, bottom: 88, height: 2, background: 'rgba(255,255,255,0.10)'}} />
          ) : null}
        </>
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          opacity: 0.22,
        }}
      />
    </div>
  );
};

export const CaptionStrip: React.FC<{
  text?: string;
  position: 'top' | 'bottom';
  accentColor: string;
  tone?: 'normal' | 'warning' | 'success';
}> = ({text, position, accentColor, tone = 'normal'}) => {
  if (!text) {
    return null;
  }

  const palette = tone === 'warning' ? 'rgba(255,108,108,0.18)' : tone === 'success' ? 'rgba(72,220,170,0.18)' : 'rgba(10,18,28,0.72)';
  return (
    <div
      style={{
        position: 'absolute',
        left: 28,
        right: 28,
        top: position === 'top' ? 24 : undefined,
        bottom: position === 'bottom' ? 24 : undefined,
        padding: '12px 18px',
        borderRadius: 18,
        background: palette,
        border: `1px solid ${accentColor}55`,
        color: '#F4FBFF',
        fontSize: position === 'top' ? 24 : 20,
        fontWeight: 900,
        lineHeight: 1.35,
        textAlign: 'center',
        zIndex: 20,
      }}
    >
      {text}
    </div>
  );
};

export const SpeechBubble: React.FC<{
  bubble: StickBubbleConfig;
  x: number;
  y: number;
  accentColor: string;
  visible: boolean;
  activeFrame: number;
}> = ({bubble, x, y, accentColor, visible, activeFrame}) => {
  if (!visible) {
    return null;
  }

  const popScale = bubble.tone === 'shout' ? 1.03 : bubble.tone === 'whisper' ? 0.97 : 1;
  const scale = interpolate(activeFrame, [0, 6], [0.92, popScale], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const opacity = interpolate(activeFrame, [0, 5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const background = bubble.tone === 'shout' ? 'rgba(255,108,108,0.16)' : bubble.tone === 'think' ? 'rgba(108,174,255,0.14)' : 'rgba(10,18,28,0.82)';
  const borderColor = bubble.emphasis ? '#FF8C8C' : accentColor;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        maxWidth: 224,
        padding: '14px 16px',
        borderRadius: 20,
        background,
        border: `1px solid ${borderColor}66`,
        color: '#F7FBFF',
        fontSize: 18,
        fontWeight: 800,
        fontStyle: bubble.tone === 'whisper' ? 'italic' : 'normal',
        lineHeight: 1.45,
        transform: `translateX(-50%) scale(${scale})`,
        opacity,
        boxShadow: bubble.emphasis ? '0 18px 38px rgba(255,108,108,0.16)' : '0 18px 30px rgba(0,0,0,0.22)',
        zIndex: 18,
      }}
    >
      {bubble.text}
      {bubble.tone === 'think' ? (
        <>
          <div style={{position: 'absolute', left: '50%', bottom: -12, width: 10, height: 10, borderRadius: '50%', background, border: `1px solid ${borderColor}55`, transform: 'translateX(-50%)'}} />
          <div style={{position: 'absolute', left: 'calc(50% - 18px)', bottom: -24, width: 7, height: 7, borderRadius: '50%', background, border: `1px solid ${borderColor}44`}} />
        </>
      ) : (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -7,
            width: 14,
            height: 14,
            background,
            borderRight: `1px solid ${borderColor}66`,
            borderBottom: `1px solid ${borderColor}66`,
            transform: 'translateX(-50%) rotate(45deg)',
          }}
        />
      )}
    </div>
  );
};

export const BeatEffectOverlay: React.FC<{
  beat?: StickBeatConfig;
  progress: number;
  actors: StickActorConfig[];
  accentColor: string;
  secondaryColor: string;
}> = ({beat, progress, actors, accentColor, secondaryColor}) => {
  if (!beat) {
    return null;
  }

  const targetActor = beat.actorId ? actors.find((actor) => actor.id === beat.actorId) : undefined;
  const targetX = targetActor ? getActorX(targetActor.position ?? 'center') : 320;
  const targetY = targetActor?.position === 'center' ? 126 : 112;
  const opacity = interpolate(progress, [0, 4, 20], [0, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scale = interpolate(progress, [0, 6], [0.6, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  if (beat.type === 'question' || beat.type === 'exclamation') {
    const symbol = beat.text || (beat.type === 'question' ? '?' : '!');
    return (
      <div
        style={{
          position: 'absolute',
          left: targetX,
          top: targetY,
          transform: `translateX(-50%) scale(${scale})`,
          opacity,
          color: beat.type === 'question' ? secondaryColor : '#FF9C9C',
          textShadow: `0 0 24px ${beat.type === 'question' ? secondaryColor : '#FF7C7C'}66`,
          fontSize: beat.type === 'question' ? 42 : 52,
          fontWeight: 900,
          zIndex: 25,
          pointerEvents: 'none',
        }}
      >
        {symbol}
      </div>
    );
  }

  if (beat.type === 'highlight') {
    const lineOpacity = interpolate(progress, [0, 3, 16], [0, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const lineScale = interpolate(progress, [0, 6], [0.7, 1.06], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const rays = [-26, -12, 0, 12, 26];
    return (
      <>
        {rays.map((offset, index) => (
          <div
            key={`${beat.id}-${offset}`}
            style={{
              position: 'absolute',
              left: targetX + offset,
              top: targetY - 8 - Math.abs(offset) * 0.25,
              width: 4,
              height: index === 2 ? 32 : 22,
              borderRadius: 999,
              background: index % 2 === 0 ? accentColor : secondaryColor,
              opacity: lineOpacity,
              transform: `translateX(-50%) rotate(${offset * 0.9}deg) scaleY(${lineScale})`,
              boxShadow: `0 0 16px ${index % 2 === 0 ? accentColor : secondaryColor}88`,
              zIndex: 24,
              pointerEvents: 'none',
            }}
          />
        ))}
      </>
    );
  }

  return null;
};

export const ActorOnStage: React.FC<{
  actor: StickActorConfig;
  accentColor: string;
  secondaryColor: string;
  index: number;
  total: number;
  beats?: StickBeatConfig[];
  activeIntensity?: number;
  muted?: boolean;
}> = ({actor, accentColor, secondaryColor, index, total, beats, activeIntensity = 0, muted = false}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const anchorX = total === 1 ? 320 : total === 2 ? (index === 0 ? getActorX(actor.position ?? 'left') : getActorX(actor.position ?? 'right')) : getActorX(actor.position ?? 'center');
  const appearStart = index * 8;
  const actorBeat = getActiveActorBeat(beats, actor.id, frame);
  const beatMotion = getActorBeatMotion({actor, beat: actorBeat, frame});
  const appear = interpolate(frame, [appearStart, appearStart + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const drift = beatMotion.freeze ? 0 : Math.sin((frame + index * 9) / 12) * (actor.pose === 'sit' ? 1.5 : 3.5);
  const shake = activeIntensity > 0 ? Math.sin(frame * 1.8 + index) * activeIntensity * 5 : 0;
  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0.88], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const baseOpacity = interpolate(frame, [appearStart, appearStart + 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) * interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const opacity = baseOpacity * beatMotion.opacity;
  const mirror = beatMotion.mirrorFlip ? actor.position !== 'right' : actor.position === 'right';

  return (
    <div
      style={{
        position: 'absolute',
        left: anchorX,
        bottom: 58,
        transform: `translateX(calc(-50% + ${beatMotion.translateX}px)) translateY(${(1 - appear) * 26 + drift + shake + beatMotion.translateY}px) rotate(${beatMotion.rotate}deg) scaleX(${beatMotion.scaleX}) scale(${0.92 + appear * 0.08}) scale(${exit * beatMotion.scale})`,
        opacity,
        zIndex: 10 + index,
      }}
    >
      <StickActor
        lineColor={actor.color || '#F3FAFF'}
        accentColor={actor.accentColor || accentColor || secondaryColor}
        emotion={actor.emotion ?? 'neutral'}
        pose={actor.pose ?? 'stand'}
        accessory={actor.accessory}
        label={actor.name}
        mirror={mirror}
        emphasis={activeIntensity}
        muted={muted}
      />
    </div>
  );
};

export const findActiveBubble = (bubbles: StickBubbleConfig[], actorId: string, frame: number) => {
  return bubbles.find((bubble) => bubble.actorId === actorId && frame >= bubble.startFrame && frame < bubble.startFrame + bubble.durationInFrames);
};

export const getBubbleProgress = (bubble: StickBubbleConfig | undefined, frame: number) => {
  if (!bubble) {
    return 0;
  }

  return Math.max(0, frame - bubble.startFrame);
};

export const getCaptionBeat = (beats: StickBeatConfig[] | undefined, frame: number) => {
  return beats?.find((beat) => beat.type === 'caption' && frame >= beat.startFrame && frame < beat.startFrame + (beat.durationInFrames ?? 24));
};
