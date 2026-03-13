import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import type {StickSceneConfig} from '../../account/config';
import {BeatEffectOverlay, CaptionStrip, getActiveActorBeat, getActiveEffectBeat, getActorBeatMotion, getBeatProgress, StageCamera, StickBackdrop} from '../shared';
import {StickActor} from '../actors/StickActor';

export const StickNarrationScene: React.FC<{
  scene: StickSceneConfig;
  accentColor: string;
  secondaryColor: string;
}> = ({scene, accentColor, secondaryColor}) => {
  const frame = useCurrentFrame();
  const actor = scene.actors[0];
  const chips = scene.bubbles?.map((bubble) => bubble.text).filter(Boolean).slice(0, 3) || [];
  const bob = Math.sin(frame / 14) * 5;
  const activeBeat = getActiveEffectBeat(scene.beats, frame);
  const actorBeat = actor ? getActiveActorBeat(scene.beats, actor.id, frame) : undefined;
  const actorMotion = actor ? getActorBeatMotion({actor, beat: actorBeat, frame}) : undefined;

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <StickBackdrop accentColor={accentColor} secondaryColor={secondaryColor} variant={scene.backgroundStyle} />
      <CaptionStrip text={scene.topCaption} position="top" accentColor={accentColor} />
      <CaptionStrip text={scene.bottomCaption} position="bottom" accentColor={secondaryColor} />

      <StageCamera enabled={scene.autoCamera ?? true} focusX={320} focusY={170} zoom={1.05}>
        <div style={{position: 'absolute', left: '50%', bottom: 56, opacity: actorMotion?.opacity ?? 1, transform: `translateX(calc(-50% + ${actorMotion?.translateX ?? 0}px)) translateY(${bob + (actorMotion?.translateY ?? 0)}px) rotate(${actorMotion?.rotate ?? 0}deg) scaleX(${actorMotion?.scaleX ?? 1}) scale(${1.04 * (actorMotion?.scale ?? 1)})`}}>
          <StickActor
            lineColor={actor?.color || '#F4FBFF'}
            accentColor={actor?.accentColor || accentColor}
            emotion={actor?.emotion ?? 'confident'}
            pose={actor?.pose ?? 'talk'}
            accessory={actor?.accessory}
            label={actor?.name}
            scale={1}
            mirror={Boolean(actorMotion?.mirrorFlip)}
          />
        </div>

        {chips.map((chip, index) => {
          const xPositions = [116, 492, 320];
          const yPositions = [188, 210, 128];
          const enter = interpolate(frame, [10 + index * 8, 18 + index * 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <div
              key={`${chip}-${index}`}
              style={{
                position: 'absolute',
                left: xPositions[index] ?? 320,
                top: yPositions[index] ?? 180,
                transform: `translateX(-50%) translateY(${(1 - enter) * 18}px) scale(${0.9 + enter * 0.1})`,
                opacity: enter,
                padding: '12px 16px',
                borderRadius: 18,
                background: 'rgba(10,18,28,0.76)',
                border: `1px solid ${(index % 2 === 0 ? accentColor : secondaryColor)}55`,
                boxShadow: `0 14px 28px ${(index % 2 === 0 ? accentColor : secondaryColor)}18`,
                color: '#F5FBFF',
                fontSize: 18,
                fontWeight: 800,
                maxWidth: 180,
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              {chip}
            </div>
          );
        })}
        <BeatEffectOverlay beat={activeBeat} progress={getBeatProgress(activeBeat, frame)} actors={scene.actors} accentColor={accentColor} secondaryColor={secondaryColor} />
      </StageCamera>
    </div>
  );
};
