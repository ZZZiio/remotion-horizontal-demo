import React from 'react';
﻿import type {StickActorAccessory, StickEmotion, StickPose} from '../../account/config';

const mouthPathMap: Record<StickEmotion, string> = {
  neutral: 'M58 66 Q80 68 102 66',
  happy: 'M58 62 Q80 84 102 62',
  angry: 'M58 74 Q80 60 102 74',
  sad: 'M58 78 Q80 58 102 78',
  awkward: 'M60 68 L100 68',
  surprised: 'M80 72 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0',
  confident: 'M60 62 Q82 74 102 58',
  anxious: 'M60 70 Q68 62 76 70 T92 70 T100 70',
};

const eyebrowMap: Record<StickEmotion, [string, string]> = {
  neutral: ['M52 38 L68 34', 'M92 34 L108 38'],
  happy: ['M52 36 L68 38', 'M92 38 L108 36'],
  angry: ['M50 40 L68 32', 'M92 32 L110 40'],
  sad: ['M52 32 L68 40', 'M92 40 L108 32'],
  awkward: ['M52 34 L68 36', 'M92 38 L108 36'],
  surprised: ['M54 30 L68 32', 'M92 32 L106 30'],
  confident: ['M52 34 L70 32', 'M90 32 L108 34'],
  anxious: ['M52 36 L68 30', 'M92 30 L108 36'],
};

const buildArmPaths = (pose: StickPose) => {
  switch (pose) {
    case 'talk':
      return {left: 'M80 104 Q56 116 52 142', right: 'M80 104 Q118 92 122 122'};
    case 'point':
      return {left: 'M80 104 Q58 116 50 142', right: 'M80 104 L128 92'};
    case 'shrug':
      return {left: 'M80 104 Q54 88 46 112', right: 'M80 104 Q106 88 114 112'};
    case 'hands-up':
      return {left: 'M80 104 Q52 72 48 42', right: 'M80 104 Q108 72 112 42'};
    case 'facepalm':
      return {left: 'M80 104 Q58 118 52 142', right: 'M80 104 Q102 72 86 54'};
    case 'sit':
      return {left: 'M80 104 Q58 116 52 136', right: 'M80 104 Q102 116 108 136'};
    case 'stand':
    default:
      return {left: 'M80 104 Q58 116 50 140', right: 'M80 104 Q102 116 110 140'};
  }
};

const buildLegPaths = (pose: StickPose) => {
  if (pose === 'sit') {
    return {left: 'M80 162 Q66 178 60 188 L94 188', right: 'M80 162 Q98 176 108 188 L134 188'};
  }

  return {left: 'M80 162 Q66 184 58 220', right: 'M80 162 Q98 184 106 220'};
};

export const StickActor: React.FC<{
  lineColor: string;
  accentColor: string;
  emotion: StickEmotion;
  pose: StickPose;
  accessory?: StickActorAccessory;
  label?: string;
  mirror?: boolean;
  scale?: number;
  emphasis?: number;
  muted?: boolean;
}> = ({
  lineColor,
  accentColor,
  emotion,
  pose,
  accessory = 'none',
  label,
  mirror = false,
  scale = 1,
  emphasis = 0,
  muted = false,
}) => {
  const armPaths = buildArmPaths(pose);
  const legPaths = buildLegPaths(pose);
  const [leftEyebrow, rightEyebrow] = eyebrowMap[emotion];
  const opacity = muted ? 0.54 : 1;
  const strokeWidth = 6 + emphasis * 1.4;

  return (
    <div
      style={{
        position: 'relative',
        width: 170,
        height: 248,
        transform: `scaleX(${mirror ? -1 : 1}) scale(${scale})`,
        transformOrigin: '50% 100%',
        opacity,
      }}
    >
      <svg width="170" height="248" viewBox="0 0 160 240" style={{overflow: 'visible'}}>
        <ellipse cx="80" cy="44" rx="32" ry="30" fill="rgba(255,255,255,0.05)" stroke={lineColor} strokeWidth={strokeWidth} />
        <path d={leftEyebrow} stroke={lineColor} strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d={rightEyebrow} stroke={lineColor} strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="66" cy="52" r="4.5" fill={lineColor} />
        <circle cx="94" cy="52" r="4.5" fill={lineColor} />
        <path d={mouthPathMap[emotion]} stroke={lineColor} strokeWidth="5" strokeLinecap="round" fill="none" />

        <path d="M80 74 L80 162" stroke={lineColor} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <path d={armPaths.left} stroke={lineColor} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <path d={armPaths.right} stroke={lineColor} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <path d={legPaths.left} stroke={lineColor} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <path d={legPaths.right} stroke={lineColor} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />

        <path d="M62 104 L98 104" stroke={accentColor} strokeWidth="4" strokeLinecap="round" opacity="0.9" />

        {accessory === 'glasses' ? (
          <>
            <rect x="54" y="44" width="18" height="14" rx="5" stroke={accentColor} strokeWidth="3" fill="none" />
            <rect x="88" y="44" width="18" height="14" rx="5" stroke={accentColor} strokeWidth="3" fill="none" />
            <line x1="72" y1="50" x2="88" y2="50" stroke={accentColor} strokeWidth="3" />
          </>
        ) : null}

        {accessory === 'tie' ? <path d="M80 104 L72 126 L80 138 L88 126 Z" fill={accentColor} opacity="0.9" /> : null}
        {accessory === 'bag' ? <path d="M100 116 Q118 126 120 154 Q120 160 112 160 L98 160" stroke={accentColor} strokeWidth="4" fill="none" /> : null}
        {accessory === 'phone' ? <rect x="114" y="118" width="16" height="28" rx="4" fill={accentColor} opacity="0.9" /> : null}
      </svg>

      {label ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 232,
            transform: 'translateX(-50%)',
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(10,18,28,0.72)',
            border: `1px solid ${accentColor}66`,
            color: '#F4FBFF',
            fontSize: 14,
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};
