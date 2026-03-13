import React from 'react';
import {getAccountSkinProfile, getSkinThemePreset} from '../account/skins';
import type {AccountSkinProfile} from '../account/skins';

export const SceneTitle: React.FC<{
  title: string;
  subtitle?: string;
  eyebrow?: string;
  maxWidth?: number;
  skin?: AccountSkinProfile;
  dark?: boolean;
}> = ({title, subtitle, eyebrow, maxWidth = 620, skin}) => {
  const activeSkin = skin ?? getAccountSkinProfile({
    meta: {visualSkin: 'blacktech'},
    theme: getSkinThemePreset('blacktech')
  } as never);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: maxWidth
      }}
    >
      {eyebrow ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            width: 'fit-content',
            maxWidth: maxWidth,
            padding: '7px 12px',
            borderRadius: 999,
            background: activeSkin.eyebrowBackground,
            border: `1px solid ${activeSkin.eyebrowBorder}`,
            boxShadow: '0 0 0 1px rgba(255,255,255,0.02) inset'
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: activeSkin.accentColor,
              boxShadow: `0 0 12px ${activeSkin.accentColor}`,
              flexShrink: 0
            }}
          />
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.2,
              fontWeight: 900,
              letterSpacing: 0.8,
              color: 'rgba(226,241,255,0.74)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {eyebrow}
          </div>
        </div>
      ) : null}
      <div
        style={{
          fontSize: 64,
          lineHeight: 1.12,
          fontWeight: 1000,
          letterSpacing: -2,
          paddingTop: 4,
          paddingBottom: 6,
          backgroundImage: activeSkin.titleGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: `0 0 26px ${activeSkin.secondaryColor}22`
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            maxWidth: Math.min(maxWidth, 660),
            fontSize: 23,
            lineHeight: 1.5,
            color: activeSkin.subtitleColor,
            fontWeight: 600
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};
