import React from 'react';
import {Audio, Sequence} from 'remotion';
import type {AccountProjectConfig} from './config';
import {AccountSegmentScene} from './AccountSegmentScene';
import {AutoSfxTrack} from './AutoSfxTrack';

export const AccountDeepTemplate: React.FC<AccountProjectConfig> = (config) => {
  let cursor = 0;
  const hasSegmentPreviewAudio = config.segments.some((segment) => Boolean(segment.voiceoverPreviewUrl));
  const shouldUseGlobalPreviewAudio = Boolean(config.meta.previewAudioEnabled && config.meta.previewAudioUrl && !hasSegmentPreviewAudio);
  const previewVolume = config.meta.previewAudioMuted ? 0 : 1;

  return (
    <>
      <AutoSfxTrack config={config} />
      {shouldUseGlobalPreviewAudio ? <Audio src={config.meta.previewAudioUrl!} volume={previewVolume} /> : null}
      {config.segments.map((segment, index) => {
        const from = cursor;
        cursor += segment.durationInFrames;
        return (
          <Sequence key={segment.id} from={from} durationInFrames={segment.durationInFrames}>
            {config.meta.previewAudioEnabled && segment.voiceoverPreviewUrl ? <Audio src={segment.voiceoverPreviewUrl} volume={previewVolume} /> : null}
            <AccountSegmentScene config={config} segment={segment} segmentIndex={index} />
          </Sequence>
        );
      })}
    </>
  );
};
