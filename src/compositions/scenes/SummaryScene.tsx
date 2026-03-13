import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {DemoProps} from '../../data/demo-props';
import {ChromeFrame} from '../../components/ChromeFrame';
import {SceneTitle} from '../../components/SceneTitle';
import {TagPill} from '../../components/TagPill';
import {fadeInUp} from '../../lib/motion';

export const SummaryScene: React.FC<DemoProps> = ({
  projectName,
  title,
  leftTag,
  rightTag,
  bottomConclusion,
  accentColor
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <ChromeFrame bottomConclusion={bottomConclusion}>
      <TagPill label={leftTag} accentColor={accentColor} />
      <TagPill label={rightTag} align="right" accentColor={accentColor} />
      <SceneTitle title={title} subtitle="横屏模板的关键不是炫动效，而是信息层级和节奏感" />

      <div
        style={{
          position: 'absolute',
          right: 84,
          top: 190,
          width: 470,
          padding: 30,
          borderRadius: 28,
          background: 'rgba(255,255,255,0.85)',
          border: `1px solid ${accentColor}44`,
          boxShadow: '0 24px 60px rgba(15,23,32,0.10)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          ...fadeInUp({frame, fps, delay: 4, duration: 26, distance: 24})
        }}
      >
        <div style={{fontSize: 24, color: '#4B5563', fontWeight: 700}}>推荐骨架</div>
        <div style={{fontSize: 34, color: '#0F1720', fontWeight: 900}}>{projectName} 信息动画模板</div>
        <div style={{fontSize: 24, lineHeight: 1.5, color: '#334155'}}>
          主标题、左右角标、主视觉、底部结论四件套固定，场景层只替换内容和主图。
        </div>
      </div>
    </ChromeFrame>
  );
};
