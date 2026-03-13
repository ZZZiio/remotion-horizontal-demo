import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {DemoProps} from '../../data/demo-props';
import {ChromeFrame} from '../../components/ChromeFrame';
import {PhoneMockup} from '../../components/PhoneMockup';
import {SceneTitle} from '../../components/SceneTitle';
import {TagPill} from '../../components/TagPill';
import {fadeInUp, revealWidth} from '../../lib/motion';

export const PhoneUiScene: React.FC<DemoProps> = ({
  phoneMessages,
  checklist,
  leftTag,
  rightTag,
  bottomConclusion,
  accentColor
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <ChromeFrame dark bottomConclusion={bottomConclusion}>
      <TagPill label={leftTag} accentColor={accentColor} />
      <TagPill label={rightTag} align="right" accentColor={accentColor} />
      <SceneTitle title="把复杂问题塞进一个界面" subtitle="信息不是一股脑丢给你，而是按顺序一层层展开" dark />

      <div
        style={{
          position: 'absolute',
          left: 98,
          top: 252,
          width: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 22
        }}
      >
        {checklist.map((item, index) => {
          const width = revealWidth({frame, start: 12 + index * 9, from: 0, to: 320});
          return (
            <div
              key={item}
              style={{
                position: 'relative',
                height: 48,
                display: 'flex',
                alignItems: 'center',
                ...fadeInUp({frame, fps, delay: index * 8, duration: 20, distance: 18})
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 8,
                  width,
                  height: 32,
                  background: `${accentColor}55`,
                  borderRadius: 10
                }}
              />
              <div style={{position: 'relative', fontSize: 28, fontWeight: 800, color: '#F3FBFF'}}>{item}</div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 126,
          top: interpolate(frame, [0, 16, 40], [760, 720, 690]),
          ...fadeInUp({frame, fps, delay: 4, duration: 28, distance: 24})
        }}
      >
        <PhoneMockup accentColor={accentColor} messages={phoneMessages} />
      </div>
    </ChromeFrame>
  );
};
