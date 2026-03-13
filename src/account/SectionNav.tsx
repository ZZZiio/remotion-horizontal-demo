import React from 'react';
import type {AccountSkinProfile} from './skins';

const compactNavLabel = (label: string) => {
  const normalized = String(label ?? '').trim().replace(/\s+/g, '');
  if (!normalized) {
    return '';
  }

  const withoutHook = normalized.replace(/hook/gi, '\u5f00\u573a');
  const withoutSuffix = withoutHook.replace(/p\d+$/i, '');
  return withoutSuffix.length <= 4 ? withoutSuffix : withoutSuffix.slice(0, 4);
};

export const SectionNav: React.FC<{
  items: string[];
  activeIndex: number;
  skin: AccountSkinProfile;
}> = ({items, activeIndex, skin}) => {
  const width = Math.min(560, Math.max(392, items.length * 72));

  return (
    <div
      style={{
        position: 'absolute',
        top: 94,
        right: 58,
        width,
        padding: '10px 12px',
        borderRadius: 24,
        background: skin.navShellBackground,
        border: `1px solid ${skin.navBorder}`,
        boxShadow: '0 16px 36px rgba(0,0,0,0.18)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))`,
          gap: 8,
          alignItems: 'center',
        }}
      >
        {items.map((item, index) => {
          const active = index === activeIndex;
          const compactLabel = compactNavLabel(item);
          return (
            <div
              key={`${item}-${index}`}
              style={{
                position: 'relative',
                minWidth: 0,
                padding: active ? '10px 8px 12px' : '9px 8px 11px',
                borderRadius: 16,
                textAlign: 'center',
                fontSize: active ? 14 : 13,
                fontWeight: 900,
                letterSpacing: 0.2,
                color: active ? skin.navActiveText : skin.navInactiveText,
                background: active ? skin.navActiveGradient : skin.navInactiveBackground,
                border: active ? 'none' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: active ? `0 0 18px ${skin.accentColor}44` : 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={item}
            >
              {compactLabel || `${index + 1}`}
              {active ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 10,
                    right: 10,
                    bottom: -5,
                    height: 2,
                    borderRadius: 999,
                    background: 'rgba(226,251,248,0.92)',
                    boxShadow: '0 0 10px rgba(226,251,248,0.7)',
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
