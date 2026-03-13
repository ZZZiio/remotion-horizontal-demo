import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {StickSceneConfig} from '../../account/config';
import {BeatEffectOverlay, CaptionStrip, getActiveActorBeat, getActiveEffectBeat, getActorBeatMotion, getBeatProgress, StageCamera, StickBackdrop} from '../shared';
import {StickActor} from '../actors/StickActor';

export const StickCompareScene: React.FC<{
  scene: StickSceneConfig;
  accentColor: string;
  secondaryColor: string;
}> = ({scene, accentColor, secondaryColor}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const leftActor = scene.actors[0];
  const rightActor = scene.actors[1] || scene.actors[0];
  const comparePoints = scene.bubbles?.map((item) => item.text).filter(Boolean).slice(0, 2) || [];
  const leftScale = interpolate(frame, [0, 10], [0.94, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const rightScale = interpolate(frame, [8, 18], [0.94, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const progress = durationInFrames <= 1 ? 1 : frame / durationInFrames;
  const activeBeat = getActiveEffectBeat(scene.beats, frame);
  const leftActorBeat = leftActor ? getActiveActorBeat(scene.beats, leftActor.id, frame) : undefined;
  const rightActorBeat = rightActor ? getActiveActorBeat(scene.beats, rightActor.id, frame) : undefined;
  const leftMotion = leftActor ? getActorBeatMotion({actor: leftActor, beat: leftActorBeat, frame}) : undefined;
  const rightMotion = rightActor ? getActorBeatMotion({actor: rightActor, beat: rightActorBeat, frame}) : undefined;
  const focusX = activeBeat?.actorId === rightActor?.id
    ? 420
    : activeBeat?.actorId === leftActor?.id
      ? 220
      : interpolate(progress, [0, 0.45, 1], [220, 220, 420], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const rightGlow = interpolate(progress, [0.35, 1], [0.18, 0.34], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const leftGlow = interpolate(progress, [0, 0.7], [0.28, 0.12], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <StickBackdrop accentColor={accentColor} secondaryColor={secondaryColor} variant={scene.backgroundStyle} />
      <CaptionStrip text={scene.topCaption} position="top" accentColor={accentColor} />
      <CaptionStrip text={scene.bottomCaption} position="bottom" accentColor={secondaryColor} tone="success" />

      <StageCamera enabled={scene.autoCamera ?? true} focusX={focusX} focusY={190} zoom={1.04}>
        <div style={{position: 'absolute', inset: '86px 24px 94px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18}}>
          <div style={{position: 'relative', borderRadius: 28, background: `rgba(255,92,92,${leftGlow})`, border: '1px solid rgba(255,108,108,0.28)', overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)'}}>
            <div style={{position: 'absolute', left: 20, top: 16, color: '#FF9C9C', fontSize: 18, fontWeight: 900}}>常见做法</div>
            <div style={{position: 'absolute', left: '50%', bottom: 62, opacity: leftMotion?.opacity ?? 1, transform: `translateX(calc(-50% + ${leftMotion?.translateX ?? 0}px)) translateY(${leftMotion?.translateY ?? 0}px) rotate(${leftMotion?.rotate ?? 0}deg) scaleX(${leftMotion?.scaleX ?? 1}) scale(${leftScale * (leftMotion?.scale ?? 1)})`}}>
              <StickActor
                lineColor={leftActor?.color || '#FFD8D8'}
                accentColor={leftActor?.accentColor || '#FF6B6B'}
                emotion={leftActor?.emotion ?? 'awkward'}
                pose={leftActor?.pose ?? 'shrug'}
                accessory={leftActor?.accessory}
                label={leftActor?.name}
                mirror={Boolean(leftMotion?.mirrorFlip)}
              />
            </div>
            <div style={{position: 'absolute', left: 20, right: 20, bottom: 18, padding: '12px 14px', borderRadius: 18, background: 'rgba(15,16,22,0.72)', color: '#FFF2F2', fontSize: 18, fontWeight: 800, lineHeight: 1.4}}>
              {comparePoints[0] || '一上来就解释，信息越说越乱'}
            </div>
          </div>

          <div style={{position: 'relative', borderRadius: 28, background: `rgba(72,220,170,${rightGlow})`, border: '1px solid rgba(72,220,170,0.28)', overflow: 'hidden', boxShadow: `0 0 46px rgba(72,220,170,${rightGlow * 0.65})`}}>
            <div style={{position: 'absolute', left: 20, top: 16, color: '#7DE8C7', fontSize: 18, fontWeight: 900}}>更优做法</div>
            <div style={{position: 'absolute', left: '50%', bottom: 62, opacity: rightMotion?.opacity ?? 1, transform: `translateX(calc(-50% + ${rightMotion?.translateX ?? 0}px)) translateY(${rightMotion?.translateY ?? 0}px) rotate(${rightMotion?.rotate ?? 0}deg) scaleX(${rightMotion?.scaleX ?? 1}) scale(${rightScale * (rightMotion?.scale ?? 1)})`}}>
              <StickActor
                lineColor={rightActor?.color || '#E3FFF5'}
                accentColor={rightActor?.accentColor || secondaryColor}
                emotion={rightActor?.emotion ?? 'confident'}
                pose={rightActor?.pose ?? 'point'}
                accessory={rightActor?.accessory}
                label={rightActor?.name}
                mirror={!rightMotion?.mirrorFlip}
              />
            </div>
            <div style={{position: 'absolute', left: 20, right: 20, bottom: 18, padding: '12px 14px', borderRadius: 18, background: 'rgba(15,16,22,0.72)', color: '#F2FFFB', fontSize: 18, fontWeight: 800, lineHeight: 1.4}}>
              {comparePoints[1] || '先接情绪，再讲事实，最后给方案'}
            </div>
          </div>
        </div>
        <BeatEffectOverlay beat={activeBeat} progress={getBeatProgress(activeBeat, frame)} actors={scene.actors} accentColor={accentColor} secondaryColor={secondaryColor} />
      </StageCamera>
    </div>
  );
};
