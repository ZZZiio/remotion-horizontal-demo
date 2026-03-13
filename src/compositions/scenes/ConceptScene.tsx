import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {DemoProps} from '../../data/demo-props';
import {ChromeFrame} from '../../components/ChromeFrame';
import {SceneTitle} from '../../components/SceneTitle';
import {TagPill} from '../../components/TagPill';
import {fadeInUp} from '../../lib/motion';

export const ConceptScene: React.FC<DemoProps> = ({
  projectName,
  conceptLines,
  leftTag,
  rightTag,
  bottomConclusion,
  accentColor
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const spotlight = interpolate(frame, [0, 40, 89], [-120, 80, 260]);

  return (
    <ChromeFrame dark bottomConclusion={bottomConclusion}>
      <TagPill label={leftTag} accentColor={accentColor} />
      <TagPill label={rightTag} align="right" accentColor={accentColor} />
      <SceneTitle title={`${projectName} 更像什么？`} subtitle="不是先回答问题，而是先搭一个会演化的环境" dark />

      <div
        style={{
          position: 'absolute',
          right: 170,
          top: 156,
          width: 420,
          height: 360
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: spotlight,
            top: 18,
            width: 180,
            height: 300,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0))',
            clipPath: 'polygon(45% 0%, 100% 100%, 0% 100%)',
            filter: 'blur(2px)'
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 160,
            top: 120,
            width: 90,
            height: 90,
            borderRadius: 999,
            background: accentColor,
            color: '#05251F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 46,
            fontWeight: 900,
            boxShadow: `0 0 32px ${accentColor}66`
          }}
        >
          人
        </div>
        {Array.from({length: 6}).map((_, index) => {
          const positions = [
            [24, 78],
            [68, 250],
            [160, 18],
            [286, 70],
            [312, 232],
            [212, 290]
          ] as const;
          const [left, top] = positions[index];
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                left,
                top,
                width: 62,
                height: 62,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.12)',
                border: `1px solid ${accentColor}44`,
                boxShadow: '0 8px 18px rgba(0,0,0,0.18)'
              }}
            />
          );
        })}
      </div>

      <div style={{position: 'absolute', left: 80, top: 300, display: 'flex', flexDirection: 'column', gap: 18}}>
        {conceptLines.map((line, index) => (
          <div
            key={line}
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#EDF8F9',
              ...fadeInUp({frame, fps, delay: 8 + index * 10, duration: 24, distance: 26})
            }}
          >
            {index + 1}. {line}
          </div>
        ))}
      </div>
    </ChromeFrame>
  );
};
