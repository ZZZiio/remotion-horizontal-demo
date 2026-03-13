import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {DemoProps} from '../../data/demo-props';
import {ChromeFrame} from '../../components/ChromeFrame';
import {FloatingHud} from '../../components/FloatingHud';
import {SceneTitle} from '../../components/SceneTitle';
import {TagPill} from '../../components/TagPill';
import {fadeInUp, softPulse} from '../../lib/motion';

export const HeroScene: React.FC<DemoProps> = ({
  title,
  subtitle,
  leftTag,
  rightTag,
  bottomConclusion,
  accentColor
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pulse = softPulse(frame);

  return (
    <ChromeFrame bottomConclusion={bottomConclusion}>
      <TagPill label={leftTag} accentColor={accentColor} />
      <TagPill label={rightTag} align="right" accentColor={accentColor} />
      <SceneTitle title={title} subtitle={subtitle} />
      <FloatingHud accentColor={accentColor} />

      <div
        style={{
          position: 'absolute',
          right: 108,
          top: 150,
          width: 430,
          height: 250,
          ...fadeInUp({frame, fps, delay: 6, duration: 28, distance: 40})
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: 'linear-gradient(90deg, #E8EFF3 0%, #CBD8E1 45%, #EDF4F7 100%)',
            border: '1px solid rgba(15,23,32,0.08)',
            transform: `scale(${pulse}) rotate(-7deg)`,
            boxShadow: '0 24px 48px rgba(15,23,32,0.12)'
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 260,
            top: 86,
            width: 140,
            height: 78,
            borderRadius: 50,
            background: 'linear-gradient(90deg, #A9BAC8 0%, #FDFEFF 100%)'
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: -4,
            top: 102,
            width: 48,
            height: 48,
            background: accentColor,
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            boxShadow: `0 0 22px ${accentColor}`
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 82,
            top: -18,
            width: 16,
            height: 16,
            borderRadius: 16,
            background: accentColor,
            boxShadow: `0 0 14px ${accentColor}`
          }}
        />
      </div>
    </ChromeFrame>
  );
};
