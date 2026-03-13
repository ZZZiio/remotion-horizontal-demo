import {Easing, interpolate, spring} from 'remotion';

export const fadeInUp = ({
  frame,
  fps,
  delay = 0,
  duration = 18,
  distance = 36
}: {
  frame: number;
  fps: number;
  delay?: number;
  duration?: number;
  distance?: number;
}) => {
  const progress = spring({
    fps,
    frame: frame - delay,
    config: {
      damping: 14,
      stiffness: 120,
      mass: 0.9
    },
    durationInFrames: duration
  });

  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`
  };
};

export const softPulse = (frame: number) => {
  return interpolate(frame % 90, [0, 45, 90], [0.92, 1, 0.92], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease)
  });
};

export const revealWidth = ({
  frame,
  start,
  from = 0,
  to = 100
}: {
  frame: number;
  start: number;
  from?: number;
  to?: number;
}) => {
  return interpolate(frame, [start, start + 18], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic)
  });
};

export const cuePulse = ({
  frame,
  cueFrames,
  spread = 12,
  intensity = 1
}: {
  frame: number;
  cueFrames: number[];
  spread?: number;
  intensity?: number;
}) => {
  if (!cueFrames.length) {
    return 0;
  }

  return cueFrames.reduce((maxValue, cueFrame) => {
    const distance = Math.abs(frame - cueFrame);
    if (distance > spread) {
      return maxValue;
    }

    const value = (1 - distance / spread) * intensity;
    return Math.max(maxValue, value);
  }, 0);
};
