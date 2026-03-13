import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {PhoneMockup} from '../components/PhoneMockup';
import {cuePulse} from '../lib/motion';
import {normalizeStickScene} from '../stick/normalizers';
import {StickCompareScene} from '../stick/scenes/StickCompareScene';
import {StickConflictScene} from '../stick/scenes/StickConflictScene';
import {StickDialogueScene} from '../stick/scenes/StickDialogueScene';
import {StickNarrationScene} from '../stick/scenes/StickNarrationScene';
import {getSegmentMediaItems} from './config';
import type {MotionPreset, SegmentConfig, TransitionPreset, VisualPreset} from './config';
import type {AccountSkinProfile} from './skins';

const drift = (frame: number, motionPreset: MotionPreset) => {
  if (motionPreset === 'calm') {
    return 0;
  }

  return interpolate(frame % 120, [0, 60, 120], [-8, 6, -8], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
};

const PlaceholderImage: React.FC<{label: string; accentColor: string}> = ({label, accentColor}) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 30,
        border: `1px dashed ${accentColor}88`,
        background: 'linear-gradient(135deg, rgba(7,18,29,0.96), rgba(10,28,44,0.80))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#EAF6FF',
        fontWeight: 800,
        fontSize: 28,
        textAlign: 'center',
        padding: 24
      }}
    >
      {label}
    </div>
  );
};

const OrbGraphic: React.FC<{accentColor: string; secondaryColor: string}> = ({accentColor, secondaryColor}) => {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: '12% 6% 14% 12%',
          borderRadius: 999,
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), rgba(255,255,255,0.03) 58%), linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.28)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '18% 18% 20% 18%',
          borderRadius: 999,
          border: `1px solid ${secondaryColor}55`,
          boxShadow: `0 0 28px ${secondaryColor}30 inset`
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 24,
          top: '42%',
          width: 76,
          height: 76,
          transform: 'rotate(45deg)',
          background: accentColor,
          boxShadow: `0 0 34px ${accentColor}`
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 92,
          top: 28,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: secondaryColor,
          boxShadow: `0 0 20px ${secondaryColor}`
        }}
      />
    </>
  );
};

const NodeGraphic: React.FC<{accentColor: string}> = ({accentColor}) => {
  const nodes = [
    [78, 88],
    [184, 40],
    [374, 110],
    [396, 302],
    [266, 388],
    [92, 330],
    [228, 194]
  ];

  return (
    <>
      {nodes.map(([left, top], index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left,
            top,
            width: index === nodes.length - 1 ? 108 : 58,
            height: index === nodes.length - 1 ? 108 : 58,
            borderRadius: 999,
            background: index === nodes.length - 1 ? accentColor : 'rgba(255,255,255,0.10)',
            border: `1px solid ${accentColor}44`,
            boxShadow: index === nodes.length - 1 ? `0 0 40px ${accentColor}66` : 'none'
          }}
        />
      ))}
      {[
        [106, 116, 252, 206],
        [214, 70, 276, 202],
        [396, 136, 284, 226],
        [118, 354, 264, 254],
        [406, 330, 308, 280]
      ].map(([x1, y1, x2, y2], index) => (
        <svg key={index} width="640" height="548" style={{position: 'absolute', inset: 0}}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={accentColor} strokeOpacity="0.5" strokeWidth="2" />
        </svg>
      ))}
    </>
  );
};

const DashboardGraphic: React.FC<{accentColor: string; segment: SegmentConfig}> = ({accentColor, segment}) => {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: 34 + index * 160,
            top: 54 + (index % 2) * 16,
            width: 140,
            height: 94,
            borderRadius: 22,
            background: 'rgba(255,255,255,0.08)',
            border: `1px solid ${accentColor}33`
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          top: 176,
          height: 214,
          borderRadius: 28,
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${accentColor}2F`,
          padding: 24
        }}
      >
        <div style={{fontSize: 24, fontWeight: 900, color: '#E9F7FF'}}>{segment.mediaLabel}</div>
        <div style={{display: 'flex', gap: 14, marginTop: 20}}>
          {segment.points.slice(0, 3).map((point) => (
            <div
              key={point}
              style={{
                flex: 1,
                minHeight: 102,
                borderRadius: 18,
                background: `${accentColor}18`,
                border: `1px solid ${accentColor}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: '#F5FCFF',
                fontWeight: 700,
                padding: '0 14px',
                lineHeight: 1.45,
                fontSize: 18
              }}
            >
              {point}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

const CornerMark: React.FC<{
  position: 'tl' | 'tr' | 'bl' | 'br';
  accentColor: string;
}> = ({position, accentColor}) => {
  const isLeft = position.includes('l');
  const isTop = position.includes('t');

  return (
    <div
      style={{
        position: 'absolute',
        [isLeft ? 'left' : 'right']: 16,
        [isTop ? 'top' : 'bottom']: 16,
        width: 28,
        height: 28,
        opacity: 0.9
      }}
    >
      <div
        style={{
          position: 'absolute',
          [isLeft ? 'left' : 'right']: 0,
          [isTop ? 'top' : 'bottom']: 0,
          width: 28,
          height: 3,
          borderRadius: 999,
          background: accentColor,
          boxShadow: `0 0 12px ${accentColor}`
        }}
      />
      <div
        style={{
          position: 'absolute',
          [isLeft ? 'left' : 'right']: 0,
          [isTop ? 'top' : 'bottom']: 0,
          width: 3,
          height: 28,
          borderRadius: 999,
          background: accentColor,
          boxShadow: `0 0 12px ${accentColor}`
        }}
      />
    </div>
  );
};

const visualLabels: Record<VisualPreset, string> = {
  orb: '科幻主视觉',
  nodes: '关系网络图',
  dashboard: '中控信息面板',
  phone: '手机界面',
  image: '图像素材',
  'stick-dialogue': '简笔对话',
  'stick-conflict': '简笔冲突',
  'stick-compare': '简笔对比',
  'stick-narration': '简笔讲述'
};


export const MediaPanel: React.FC<{
  visualPreset: VisualPreset;
  motionPreset: MotionPreset;
  transitionPreset?: TransitionPreset;
  accentColor: string;
  secondaryColor: string;
  segment: SegmentConfig;
  skin: AccountSkinProfile;
}> = ({visualPreset, motionPreset, transitionPreset = 'soft', accentColor, secondaryColor, segment, skin}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const floatY = drift(frame, motionPreset);
  const mediaItems = getSegmentMediaItems(segment);
  const cueFrames = (segment.cuePointsSec ?? [])
    .map((point) => Number(point))
    .filter((point) => Number.isFinite(point) && point >= 0)
    .map((point) => Math.max(0, Math.round(point * fps)));
  const framesPerItem = mediaItems.length > 0 ? Math.max(1, Math.floor(segment.durationInFrames / mediaItems.length)) : segment.durationInFrames;
  const mediaSwitchFrames = Array.from({length: Math.max(0, mediaItems.length - 1)}, (_, index) => {
    const cueFrame = cueFrames[index];
    if (typeof cueFrame === 'number') {
      return Math.min(segment.durationInFrames - 1, cueFrame);
    }

    return Math.min(segment.durationInFrames - 1, framesPerItem * (index + 1));
  });
  const currentMediaIndex = mediaItems.length > 1
    ? mediaSwitchFrames.length
      ? Math.min(mediaItems.length - 1, mediaSwitchFrames.filter((cueFrame) => frame >= cueFrame).length)
      : Math.min(mediaItems.length - 1, Math.floor(frame / framesPerItem))
    : 0;
  const currentMedia = mediaItems[currentMediaIndex];
  const stickScene = normalizeStickScene(segment);
  const pulse = cuePulse({frame, cueFrames: cueFrames.length ? cueFrames : mediaSwitchFrames, spread: 10, intensity: 1});
  const scanLineOffset = interpolate(frame % 150, [0, 150], [-120, 620], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const mediaCaption = currentMedia?.label || segment.mediaLabel || segment.title;
  const shouldShowMediaCaption = !currentMedia?.url;

  const baseTransitionFrames = transitionPreset === 'clean' ? 10 : transitionPreset === 'impact' ? 16 : 14;
  const transitionFrames = Math.max(8, Math.min(baseTransitionFrames, Math.floor(segment.durationInFrames * 0.4)));
  const enter = interpolate(frame, [0, transitionFrames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const exit = interpolate(
    frame,
    [Math.max(0, segment.durationInFrames - transitionFrames), segment.durationInFrames],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const enterOut = 1 - enter;
  const panelOpacity = Math.max(0, Math.min(1, enter * (1 - exit)));
  const baseFloatScale = 1 + pulse * 0.02;
  const panelTranslateY = floatY + (transitionPreset === 'clean' ? enterOut * 10 : transitionPreset === 'impact' ? enterOut * 6 : enterOut * 8) + exit * -10;
  const panelTranslateX = transitionPreset === 'impact' ? enterOut * 40 + exit * -26 : transitionPreset === 'clean' ? enterOut * 10 : enterOut * 16;
  const panelScale =
    transitionPreset === 'impact'
      ? baseFloatScale * (1 - enterOut * 0.018 - exit * 0.02)
      : transitionPreset === 'clean'
        ? baseFloatScale * (1 - enterOut * 0.01 - exit * 0.01)
        : baseFloatScale * (1 - enterOut * 0.014 - exit * 0.012);
  const panelBlur = transitionPreset === 'impact' ? enterOut * 5 + exit * 7 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        right: 58,
        top: 158,
        width: 642,
        height: 548,
        opacity: panelOpacity,
        transform: `translate3d(${panelTranslateX.toFixed(3)}px, ${panelTranslateY.toFixed(3)}px, 0) scale(${panelScale.toFixed(4)})`,
        filter: panelBlur > 0.2 ? `blur(${panelBlur.toFixed(3)}px)` : undefined,
        willChange: 'transform, opacity, filter',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 28,
          borderRadius: 40,
          background: skin.mediaBackplate,
          border: `1px solid ${skin.mediaShellBorder}`,
          transform: 'translate(26px, 18px)',
          boxShadow: '0 28px 60px rgba(0,0,0,0.28)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 42,
          background: skin.mediaShellBackground,
          border: `1px solid ${skin.mediaShellBorder}`,
          overflow: 'hidden',
          boxShadow: skin.mediaShellShadow,
        }}
      >
        {visualPreset === 'stick-dialogue' ? (
          <StickDialogueScene scene={stickScene} accentColor={accentColor} secondaryColor={secondaryColor} />
        ) : visualPreset === 'stick-conflict' ? (
          <StickConflictScene scene={stickScene} accentColor={accentColor} secondaryColor={secondaryColor} />
        ) : visualPreset === 'stick-compare' ? (
          <StickCompareScene scene={stickScene} accentColor={accentColor} secondaryColor={secondaryColor} />
        ) : visualPreset === 'stick-narration' ? (
          <StickNarrationScene scene={stickScene} accentColor={accentColor} secondaryColor={secondaryColor} />
        ) : currentMedia?.url ? (
          <img src={currentMedia.url} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.04 + pulse * 0.01})`}} />
        ) : visualPreset === 'orb' ? (
          <OrbGraphic accentColor={accentColor} secondaryColor={secondaryColor} />
        ) : visualPreset === 'nodes' ? (
          <NodeGraphic accentColor={accentColor} />
        ) : visualPreset === 'dashboard' ? (
          <DashboardGraphic accentColor={accentColor} segment={segment} />
        ) : visualPreset === 'phone' ? (
          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%'}}>
            <PhoneMockup accentColor={accentColor} messages={segment.points.slice(0, 3)} />
          </div>
        ) : (
          <PlaceholderImage label={currentMedia?.label || segment.mediaLabel || '主视觉素材'} accentColor={accentColor} />
        )}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: skin.mediaMask,
          }}
        />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '90px 90px',
            opacity: 0.14,
            mixBlendMode: 'screen',
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: scanLineOffset,
            height: 78,
            background: skin.scanLine,
            opacity: 0.55,
            filter: 'blur(6px)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 170,
            background: 'linear-gradient(180deg, rgba(4,10,18,0), rgba(4,10,18,0.72) 58%, rgba(4,10,18,0.92))',
          }}
        />

        {shouldShowMediaCaption ? (
          <div
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              bottom: 20,
              padding: '14px 16px',
              borderRadius: 22,
              background: skin.overlayCardBackground,
              border: `1px solid ${skin.overlayCardBorder}`,
              boxShadow: '0 14px 30px rgba(0,0,0,0.22)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: '#EAF7FF',
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {mediaCaption}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
