import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {getAccountSkinProfile, getSkinThemePreset} from '../account/skins';
import type {AccountSkinProfile} from '../account/skins';

export const ChromeFrame: React.FC<{
  children: React.ReactNode;
  skin?: AccountSkinProfile;
  dark?: boolean;
  bottomConclusion: string;
  brand?: {
    enabled?: boolean;
    name?: string;
    slogan?: string;
    handle?: string;
    logoUrl?: string;
  };
}> = ({children, skin, bottomConclusion, brand}) => {
  const frame = useCurrentFrame();
  const {fps, height, width} = useVideoConfig();
  const t = frame / Math.max(1, fps);
  const driftX = Math.sin(t * 0.18) * 70 + Math.sin(t * 0.06) * 34;
  const driftY = Math.cos(t * 0.14) * 60 + Math.sin(t * 0.09) * 28;
  const shimmer = 0.38 + (Math.sin(t * 0.5) * 0.05 + Math.sin(t * 0.12) * 0.03);
  const grainOpacity = 0.06 + Math.abs(Math.sin(t * 2.1)) * 0.02;
  const gridShiftX = driftX * 0.16;
  const gridShiftY = driftY * 0.16;
  const scanBandHeight = Math.min(260, Math.max(180, Math.round(height * 0.22)));
  const scanSpeed = Math.max(18, height * 0.06);
  const scanTop = ((t * scanSpeed) % (height + scanBandHeight)) - scanBandHeight;
  const sweepWidth = Math.max(420, Math.round(width * 0.36));
  const sweepLeft = ((t * 42) % (width + sweepWidth)) - sweepWidth;

  const activeSkin = skin ?? getAccountSkinProfile({
    meta: {visualSkin: 'blacktech'},
    theme: getSkinThemePreset('blacktech'),
  } as never);

  const brandEnabled = brand?.enabled !== false;
  const brandName = (brand?.name ?? '').trim();
  const brandSlogan = (brand?.slogan ?? '').trim();
  const brandHandle = (brand?.handle ?? '').trim();
  const brandLogoUrl = brand?.logoUrl;
  const shouldShowBrand = brandEnabled && Boolean(brandName || brandSlogan || brandHandle || brandLogoUrl);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: activeSkin.canvasBackground,
        fontFamily: 'Microsoft YaHei, Inter, Arial, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-22%',
          background:
            `radial-gradient(700px 520px at 18% 22%, ${activeSkin.accentColor}33, transparent 62%),` +
            `radial-gradient(760px 560px at 86% 30%, ${activeSkin.secondaryColor}2b, transparent 64%),` +
            `radial-gradient(920px 720px at 60% 86%, rgba(255,255,255,0.08), transparent 70%)`,
          filter: 'blur(46px) saturate(1.2)',
          opacity: Math.max(0, Math.min(0.58, shimmer)),
          transform: `translate3d(${driftX}px, ${driftY}px, 0)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: scanTop,
          left: 0,
          right: 0,
          height: scanBandHeight,
          background: `linear-gradient(180deg, transparent, rgba(255,255,255,0.055), transparent)`,
          opacity: 0.32,
          filter: 'blur(10px)',
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -220,
          bottom: -220,
          left: sweepLeft,
          width: sweepWidth,
          transform: 'skewX(-14deg)',
          background: `linear-gradient(90deg, transparent, ${activeSkin.accentColor}18, transparent)`,
          opacity: 0.36,
          filter: 'blur(22px)',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(90deg, rgba(255,255,255,0.035), rgba(255,255,255,0.0) 30%, rgba(255,255,255,0.03) 70%, rgba(255,255,255,0.0)),' +
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 4px)',
          opacity: grainOpacity,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '120px 120px',
          backgroundPosition: `${gridShiftX}px ${gridShiftY}px, ${gridShiftX}px ${gridShiftY}px`,
          opacity: activeSkin.gridOpacity,
          pointerEvents: 'none',
        }}
      />
      {activeSkin.warningStripeOpacity > 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(135deg, rgba(255,138,76,0.12) 0 18px, transparent 18px 44px)',
            opacity: activeSkin.warningStripeOpacity,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {shouldShowBrand ? (
        <div
          style={{
            position: 'absolute',
            right: 58,
            top: 58,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(6,15,25,0.88), rgba(9,22,34,0.74))',
            border: `1px solid ${activeSkin.overlayCardBorder}`,
            boxShadow: '0 18px 46px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(14px)',
            maxWidth: 720,
          }}
        >
          {brandLogoUrl ? (
            <img
              src={brandLogoUrl}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                objectFit: 'cover',
                boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 18px ${activeSkin.accentColor}26`,
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${activeSkin.accentColor}22, ${activeSkin.secondaryColor}16)`,
                border: `1px solid ${activeSkin.accentColor}33`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: activeSkin.accentColor,
                  boxShadow: `0 0 16px ${activeSkin.accentColor}88`,
                }}
              />
            </div>
          )}
          <div style={{minWidth: 0, textAlign: 'right'}}>
            <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 10, minWidth: 0}}>
              {brandName ? (
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 1000,
                    letterSpacing: 0.2,
                    color: '#F2FBFF',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 420,
                  }}
                >
                  {brandName}
                </div>
              ) : null}
              {brandHandle ? (
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: 'rgba(234,246,255,0.78)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 220,
                  }}
                >
                  {brandHandle.startsWith('@') ? brandHandle : `@${brandHandle}`}
                </div>
              ) : null}
            </div>
            {brandSlogan ? (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  lineHeight: 1.3,
                  fontWeight: 700,
                  color: 'rgba(234,246,255,0.74)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 620,
                }}
              >
                {brandSlogan}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: '26px 30px 26px 30px',
          borderRadius: 32,
          border: `1px solid ${activeSkin.frameBorder}`,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.015)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 34,
          top: 32,
          width: 180,
          height: 2,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${activeSkin.accentColor}, rgba(108,174,255,0))`,
          boxShadow: `0 0 16px ${activeSkin.accentColor}55`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 34,
          top: 32,
          width: 140,
          height: 2,
          borderRadius: 999,
          background: `linear-gradient(90deg, rgba(108,174,255,0), ${activeSkin.secondaryColor})`,
          boxShadow: `0 0 16px ${activeSkin.secondaryColor}55`,
        }}
      />

      {children}

      <div
        style={{
          position: 'absolute',
          left: 58,
          right: 58,
          bottom: 28,
          minHeight: 68,
          borderRadius: 22,
          background: activeSkin.bottomBackground,
          border: `1px solid ${activeSkin.bottomBorder}`,
          boxShadow: '0 16px 40px rgba(0,0,0,0.24)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 22px 14px 18px',
          color: '#EAF6FF',
        }}
      >
        <div
          style={{
            width: 4,
            alignSelf: 'stretch',
            borderRadius: 999,
            background: `linear-gradient(180deg, ${activeSkin.accentColor}, ${activeSkin.secondaryColor})`,
            boxShadow: `0 0 16px ${activeSkin.accentColor}55`,
            flexShrink: 0,
          }}
        />
        <div
          style={{
            flex: 1,
            fontWeight: 900,
            fontSize: 28,
            lineHeight: 1.25,
            letterSpacing: -0.3,
            color: '#F4FBFF',
          }}
        >
          {bottomConclusion}
        </div>
      </div>
    </div>
  );
};
