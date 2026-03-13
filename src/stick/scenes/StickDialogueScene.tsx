import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {StickSceneConfig} from '../../account/config';
import {ActorOnStage, BeatEffectOverlay, CaptionStrip, findActiveBubble, getBubbleProgress, getCaptionBeat, getBeatProgress, getSmartCameraState, SpeechBubble, StageCamera, StickBackdrop} from '../shared';

export const StickDialogueScene: React.FC<{
  scene: StickSceneConfig;
  accentColor: string;
  secondaryColor: string;
}> = ({scene, accentColor, secondaryColor}) => {
  const frame = useCurrentFrame();
  const actors = scene.actors.slice(0, 2);
  const captionBeat = getCaptionBeat(scene.beats, frame);
  const camera = getSmartCameraState({actors, bubbles: scene.bubbles, beats: scene.beats, frame, fallbackX: 320, fallbackY: 172});

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <StickBackdrop accentColor={accentColor} secondaryColor={secondaryColor} variant={scene.backgroundStyle} />
      <CaptionStrip text={scene.topCaption} position="top" accentColor={accentColor} />
      <CaptionStrip text={captionBeat?.text || scene.bottomCaption} position="bottom" accentColor={secondaryColor} />

      <StageCamera enabled={scene.autoCamera ?? true} focusX={camera.focusX} focusY={camera.focusY} zoom={camera.zoom}>
        {actors.map((actor, index) => {
          const activeBubble = findActiveBubble(scene.bubbles || [], actor.id, frame);
          return (
            <React.Fragment key={actor.id}>
              <ActorOnStage actor={actor} accentColor={accentColor} secondaryColor={secondaryColor} index={index} total={actors.length} beats={scene.beats} activeIntensity={activeBubble?.tone === 'shout' ? 0.45 : activeBubble ? 0.15 : 0} />
              <SpeechBubble
                bubble={activeBubble || {actorId: actor.id, text: '', startFrame: 0, durationInFrames: 0}}
                x={actor.position === 'right' ? 454 : actor.position === 'center' ? 320 : 186}
                y={actor.position === 'center' ? 110 : 96}
                accentColor={accentColor}
                visible={Boolean(activeBubble)}
                activeFrame={getBubbleProgress(activeBubble, frame)}
              />
            </React.Fragment>
          );
        })}

        <BeatEffectOverlay beat={camera.effectBeat} progress={getBeatProgress(camera.effectBeat, frame)} actors={actors} accentColor={accentColor} secondaryColor={secondaryColor} />

        {scene.relationship ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 142,
              transform: 'translateX(-50%)',
              padding: '8px 16px',
              borderRadius: 999,
              background: 'rgba(10,18,28,0.66)',
              border: `1px solid ${accentColor}44`,
              color: '#EAF6FF',
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 0.5,
            }}
          >
            {scene.relationship}
          </div>
        ) : null}
      </StageCamera>
    </div>
  );
};
