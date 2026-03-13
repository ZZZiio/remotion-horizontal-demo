import React from 'react';

export const FloatingHud: React.FC<{accentColor: string}> = ({accentColor}) => {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          right: 112,
          top: 128,
          width: 180,
          height: 180,
          borderRadius: 24,
          border: `1px solid ${accentColor}44`,
          transform: 'rotate(12deg)',
          opacity: 0.75
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 880,
          top: 540,
          width: 16,
          height: 16,
          background: accentColor,
          transform: 'rotate(45deg)',
          boxShadow: `0 0 18px ${accentColor}`
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 260,
          bottom: 168,
          width: 210,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          opacity: 0.7
        }}
      />
    </>
  );
};
