import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {StickSceneConfig} from '../../account/config';
import {ActorOnStage, BeatEffectOverlay, CaptionStrip, findActiveBubble, getBubbleProgress, getCaptionBeat, getBeatProgress, getSmartCameraState, SpeechBubble, StageCamera, StickBackdrop} from '../shared';

export const StickConflictScene: React.FC<{
  scene: StickSceneConfig;
  accentColor: string;
  secondaryColor: string;
}> = ({scene, accentColor, secondaryColor}) => {
  const frame = useCurrentFrame();
  const actors = scene.actors.slice(0, 2);
  const captionBeat = getCaptionBeat(scene.beats, frame);
  const camera = getSmartCameraState({actors, bubbles: scene.bubbles, beats: scene.beats, frame, fallbackX: 320, fallbackY: 176});

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <StickBackdrop accentColor={accentColor} secondaryColor={secondaryColor} variant={scene.backgroundStyle} dramatic />
      <CaptionStrip text={scene.topCaption} position="top" accentColor="#FF8C8C" tone="warning" />
      <CaptionStrip text={captionBeat?.text || scene.bottomCaption} position="bottom" accentColor={secondaryColor} />

      <StageCamera enabled={scene.autoCamera ?? true} focusX={camera.focusX} focusY={camera.focusY} zoom={Math.max(1.05, camera.zoom)}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 176, height: 2, background: 'linear-gradient(90deg, transparent, rgba(255,108,108,0.35), transparent)'}} />

        {actors.map((actor, index) => {
          const activeBubble = findActiveBubble(scene.bubbles || [], actor.id, frame);
          return (
            <React.Fragment key={actor.id}>
              <ActorOnStage
                actor={actor}
                accentColor={accentColor}
                secondaryColor={secondaryColor}
                index={index}
                total={actors.length}
                beats={scene.beats}
                activeIntensity={activeBubble?.tone === 'shout' ? 0.85 : activeBubble ? 0.22 : 0}
              />
              <SpeechBubble
                bubble={activeBubble || {actorId: actor.id, text: '', startFrame: 0, durationInFrames: 0}}
                x={actor.position === 'right' ? 460 : 180}
                y={actor.position === 'right' ? 124 : 88}
                accentColor={activeBubble?.tone === 'shout' ? '#FF8C8C' : accentColor}
                visible={Boolean(activeBubble)}
                activeFrame={getBubbleProgress(activeBubble, frame)}
              />
            </React.Fragment>
          );
        })}

        <BeatEffectOverlay beat={camera.effectBeat} progress={getBeatProgress(camera.effectBeat, frame)} actors={actors} accentColor={accentColor} secondaryColor={secondaryColor} />

        <div style={{position: 'absolute', left: 30, bottom: 154, color: '#FF9D9D', fontSize: 44, fontWeight: 900, opacity: 0.88}}>!</div>
        <div style={{position: 'absolute', right: 34, top: 170, color: '#FFC86C', fontSize: 36, fontWeight: 900, opacity: 0.74}}>...</div>
      </StageCamera>
    </div>
  );
};
