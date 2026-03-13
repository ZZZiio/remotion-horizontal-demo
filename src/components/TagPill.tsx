import React from 'react';
import {getAccountSkinProfile, getSkinThemePreset} from '../account/skins';
import type {AccountSkinProfile} from '../account/skins';

export const TagPill: React.FC<{
  label: string;
  align?: 'left' | 'right';
  skin?: AccountSkinProfile;
  accentColor?: string;
}> = ({label, align = 'left', skin, accentColor}) => {
  const activeSkin = skin ?? getAccountSkinProfile({
    meta: {visualSkin: 'blacktech'},
    theme: {
      ...getSkinThemePreset('blacktech'),
      accentColor: accentColor || getSkinThemePreset('blacktech').accentColor
    }
  } as never);

  return (
    <div
      style={{
        position: 'absolute',
        top: 34,
        [align]: 38,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 300,
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 16,
        fontWeight: 800,
        color: '#E9F7FF',
        background: activeSkin.tagBackground,
        border: `1px solid ${activeSkin.tagBorder}`,
        boxShadow: `0 0 0 1px ${activeSkin.tagBorder}22 inset, 0 10px 24px rgba(0,0,0,0.16), 0 0 18px ${activeSkin.accentColor}14`,
        backdropFilter: 'blur(12px)'
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: activeSkin.accentColor,
          boxShadow: `0 0 12px ${activeSkin.accentColor}`,
          flexShrink: 0
        }}
      />
      <span
        style={{
          display: 'block',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis'
        }}
      >
        {label}
      </span>
    </div>
  );
};
