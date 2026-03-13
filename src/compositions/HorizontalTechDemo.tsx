import React from 'react';
import {Sequence} from 'remotion';
import type {DemoProps} from '../data/demo-props';
import {HeroScene} from './scenes/HeroScene';
import {ConceptScene} from './scenes/ConceptScene';
import {PhoneUiScene} from './scenes/PhoneUiScene';
import {SummaryScene} from './scenes/SummaryScene';

export const HorizontalTechDemo: React.FC<DemoProps> = (props) => {
  return (
    <>
      <Sequence from={0} durationInFrames={90}>
        <HeroScene {...props} />
      </Sequence>
      <Sequence from={90} durationInFrames={90}>
        <ConceptScene {...props} />
      </Sequence>
      <Sequence from={180} durationInFrames={105}>
        <PhoneUiScene {...props} />
      </Sequence>
      <Sequence from={285} durationInFrames={75}>
        <SummaryScene {...props} />
      </Sequence>
    </>
  );
};
