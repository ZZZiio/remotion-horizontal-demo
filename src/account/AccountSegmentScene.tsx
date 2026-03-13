import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {ChromeFrame} from '../components/ChromeFrame';
import {SceneTitle} from '../components/SceneTitle';
import {cuePulse, fadeInUp} from '../lib/motion';
import type {AccountProjectConfig, SegmentConfig} from './config';
import {MediaPanel} from './MediaPanel';
import {SubtitleOverlay} from './SubtitleOverlay';
import {getAccountSkinProfile} from './skins';

export const AccountSegmentScene: React.FC<{
  config: AccountProjectConfig;
  segment: SegmentConfig;
  segmentIndex: number;
}> = ({config, segment, segmentIndex}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const skin = getAccountSkinProfile(config);
  const isCoverSegment = segmentIndex === 0 || segment.id === 'hook';
  const transitionPreset = config.meta.transitionPreset ?? 'soft';
  const cueFrames = (segment.cuePointsSec ?? [])
    .map((point) => Number(point))
    .filter((point) => Number.isFinite(point) && point >= 0)
    .map((point) => Math.max(0, Math.round(point * fps)));

  const subtitleMode = config.meta.subtitleMode ?? 'single';
  const contentBottomSafe = subtitleMode === 'bilingual-full' ? 252 : 236;
  const viewerPoints = segment.points.filter(Boolean).slice(0, 6);
  const displayedPoints = viewerPoints.slice(0, viewerPoints.length >= 5 ? 6 : 4);
  const titleDelay = isCoverSegment ? -12 : 2;
  const leadDelay = isCoverSegment ? -6 : 6;
  const pointPanelDelay = isCoverSegment ? 6 : 10;
  const rawPointDelays = displayedPoints.map((_, index) => {
    if (index === 0) {
      return pointPanelDelay + 4;
    }

    const cueFrame = cueFrames[index - 1];
    return typeof cueFrame === 'number'
      ? Math.max(pointPanelDelay + 8, Math.min(segment.durationInFrames - 12, cueFrame))
      : pointPanelDelay + 4 + index * 8;
  });
  const pointDelays = rawPointDelays.reduce<number[]>((accumulator, delay, index) => {
    if (index === 0) {
      accumulator.push(delay);
      return accumulator;
    }

    const previousDelay = accumulator[index - 1] ?? (pointPanelDelay + 4);
    accumulator.push(Math.max(delay, previousDelay + 4));
    return accumulator;
  }, []);

  const useDensePointLayout = displayedPoints.length >= 5 || subtitleMode === 'bilingual-full';
  const useCompactPointLayout = displayedPoints.length >= 3 || subtitleMode === 'bilingual-full';
  const useTwoColumnPointLayout = displayedPoints.length >= 4;
  const pointListGap = useDensePointLayout ? 8 : useCompactPointLayout ? 10 : 12;
  const pointCardMinHeight = useDensePointLayout ? 52 : useCompactPointLayout ? 58 : 66;
  const pointCardPadding = useDensePointLayout ? '10px 14px' : useCompactPointLayout ? '12px 16px' : '14px 18px';
  const pointCardFontSize = useDensePointLayout ? 16 : useCompactPointLayout ? 18 : 20;
  const pointIndexSize = useDensePointLayout ? 26 : useCompactPointLayout ? 30 : 34;
  const pointTitle = displayedPoints.length <= 1 ? '这一段记住这一点就够了' : `这一段记住 ${displayedPoints.length} 点就够了`;
  const pointPanelTitleSize = useDensePointLayout ? 22 : useCompactPointLayout ? 24 : 26;
  const pointPanelPadding = useDensePointLayout ? '18px 18px 16px' : '20px 20px 18px';
  const leadText = segment.humanConclusion || segment.subtitle || segment.bottomConclusion;
  const coverEyebrow = [config.tags?.left, segment.navLabel || segment.label].filter(Boolean).join(' · ');
  const coverWatermark = String(config.meta.projectName || segment.title || '')
    .trim()
    .slice(0, 18);
  const brandName = (config.meta.ipName ?? config.tags.left ?? '').trim();
  const brandSlogan = (config.meta.ipSlogan ?? config.meta.positioning ?? config.tags.right ?? '').trim();
  const brandHandle = (config.meta.ipHandle ?? '').trim();
  const brandLogoUrl = config.meta.ipLogoUrl;

  const panelBaseStyle: React.CSSProperties = {
    borderRadius: 24,
    background: skin.panelBackground,
    border: `1px solid ${skin.panelBorder}`,
    boxShadow: skin.panelShadow,
  };

  const baseTransitionFrames = transitionPreset === 'clean' ? 10 : transitionPreset === 'impact' ? 16 : 14;
  const transitionFrames = Math.max(8, Math.min(baseTransitionFrames, Math.floor(segment.durationInFrames * 0.4)));
  const enter = interpolate(frame, [0, transitionFrames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const exit = interpolate(
    frame,
    [Math.max(0, segment.durationInFrames - transitionFrames), segment.durationInFrames],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const enterOut = 1 - enter;
  const opacity = Math.max(0, Math.min(1, enter * (1 - exit)));

  const transitionStyle = useMemo<React.CSSProperties>(() => {
    if (transitionPreset === 'clean') {
      const translateY = enterOut * 18 + exit * -12;
      return {
        position: 'absolute',
        inset: 0,
        opacity,
        transform: `translate3d(0px, ${translateY.toFixed(3)}px, 0)`,
        willChange: 'transform, opacity',
      };
    }

    if (transitionPreset === 'impact') {
      const translateX = enterOut * 34 + exit * -26;
      const scale = Math.max(0.94, 1 - enterOut * 0.02 - exit * 0.02);
      const blur = Math.max(0, enterOut * 6 + exit * 8);
      return {
        position: 'absolute',
        inset: 0,
        opacity,
        transform: `translate3d(${translateX.toFixed(3)}px, 0px, 0) scale(${scale.toFixed(4)})`,
        filter: blur > 0.2 ? `blur(${blur.toFixed(3)}px)` : undefined,
        willChange: 'transform, filter, opacity',
      };
    }

    const translateY = enterOut * 22 + exit * -18;
    const scale = Math.max(0.96, 1 - enterOut * 0.012 - exit * 0.01);
    return {
      position: 'absolute',
      inset: 0,
      opacity,
      transform: `translate3d(0px, ${translateY.toFixed(3)}px, 0) scale(${scale.toFixed(4)})`,
      willChange: 'transform, opacity',
    };
  }, [enterOut, exit, opacity, transitionPreset]);

  return (
    <ChromeFrame
      skin={skin}
      bottomConclusion={segment.bottomConclusion}
      brand={{
        enabled: config.meta.ipEnabled !== false,
        name: brandName,
        slogan: brandSlogan,
        handle: brandHandle,
        logoUrl: brandLogoUrl,
      }}
    >
      <div style={transitionStyle}>
      <div
        style={{
          position: 'absolute',
          left: 72,
          top: 106,
          bottom: contentBottomSafe,
          width: 786,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          overflow: 'hidden',
        }}
      >
        {isCoverSegment && coverWatermark ? (
          <div
            style={{
              position: 'absolute',
              left: -18,
              top: -22,
              width: 820,
              pointerEvents: 'none',
              opacity: 0.6,
            }}
          >
            <div
              style={{
                fontSize: 112,
                lineHeight: 0.92,
                fontWeight: 1000,
                letterSpacing: -4,
                backgroundImage: `linear-gradient(90deg, ${skin.accentColor}2c, ${skin.secondaryColor}12, rgba(255,255,255,0))`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'blur(0.1px)',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maskImage: 'linear-gradient(90deg, rgba(0,0,0,0.9), rgba(0,0,0,0))',
              }}
            >
              {coverWatermark}
            </div>
            <div
              style={{
                marginTop: 10,
                height: 2,
                width: 420,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${skin.accentColor}66, rgba(108,174,255,0))`,
                boxShadow: `0 0 20px ${skin.accentColor}44`,
              }}
            />
          </div>
        ) : null}

        <div style={fadeInUp({frame, fps, delay: titleDelay, duration: 18, distance: 18})}>
          <SceneTitle
            title={segment.title}
            subtitle={segment.subtitle}
            eyebrow={coverEyebrow}
            skin={skin}
            maxWidth={744}
          />
        </div>

        {leadText ? (
          <div
            style={{
              ...panelBaseStyle,
              width: 744,
              padding: '16px 18px',
              background: skin.panelBackgroundStrong,
              ...fadeInUp({frame, fps, delay: leadDelay, duration: 18, distance: 16}),
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 900,
                color: skin.accentColor,
                letterSpacing: 0.8,
                marginBottom: 8,
              }}
            >
              {'一句话先看懂'}
            </div>
            <div
              style={{
                fontSize: 22,
                lineHeight: 1.5,
                fontWeight: 800,
                color: '#F2FAFF',
              }}
            >
              {leadText}
            </div>
          </div>
        ) : null}

        <div
          style={{
            ...panelBaseStyle,
            width: 744,
            flex: 1,
            minHeight: 0,
            padding: pointPanelPadding,
            position: 'relative',
            overflow: 'hidden',
            background: skin.panelBackgroundStrong,
            ...fadeInUp({frame, fps, delay: pointPanelDelay, duration: 18, distance: 18}),
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: -64,
              top: -88,
              width: 220,
              height: 220,
              borderRadius: 999,
              background: `radial-gradient(circle, ${skin.secondaryColor}18, rgba(108,174,255,0))`,
            }}
          />

          <div style={{marginBottom: 14}}>
            <div style={{fontSize: 14, fontWeight: 900, color: skin.accentColor, letterSpacing: 0.8}}>{'这段重点'}</div>
            <div style={{fontSize: pointPanelTitleSize, fontWeight: 900, color: '#F4FBFF', marginTop: 6}}>{pointTitle}</div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: pointListGap,
              gridTemplateColumns: useTwoColumnPointLayout ? 'repeat(2, minmax(0, 1fr))' : '1fr',
              gridAutoRows: useTwoColumnPointLayout ? '1fr' : 'auto',
              alignItems: 'stretch',
              alignContent: 'start',
            }}
          >
            {(displayedPoints.length ? displayedPoints : [segment.bottomConclusion]).map((point, index) => {
              const pointDelay = pointDelays[index] ?? (10 + index * 8);
              const pointPulse = cuePulse({frame, cueFrames: [pointDelay], spread: 10, intensity: 1});

              return (
                <div
                  key={`${point}-${index}`}
                  style={{
                    minHeight: pointCardMinHeight,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: pointCardPadding,
                    borderRadius: 18,
                    background: skin.pointBackground,
                    border: `1px solid ${skin.pointBorder}`,
                    color: '#EFF9FF',
                    fontSize: pointCardFontSize,
                    fontWeight: 800,
                    boxShadow: `0 0 ${Math.round(10 + pointPulse * 20)}px ${skin.accentColor}${Math.round((0.05 + pointPulse * 0.15) * 255).toString(16).padStart(2, '0')}`,
                    ...fadeInUp({frame, fps, delay: pointDelay, duration: 20, distance: 18}),
                  }}
                >
                  <div
                    style={{
                      width: pointIndexSize,
                      height: pointIndexSize,
                      borderRadius: 999,
                      background: `linear-gradient(135deg, ${skin.accentColor}30, ${skin.secondaryColor}20)`,
                      border: `1px solid ${skin.accentColor}55`,
                      color: skin.accentColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 900,
                      transform: `scale(${1 + pointPulse * 0.14})`,
                      boxShadow: `0 0 ${Math.round(10 + pointPulse * 12)}px ${skin.accentColor}55`,
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      lineHeight: 1.38,
                      display: '-webkit-box',
                      WebkitLineClamp: useDensePointLayout ? 2 : 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {point}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <SubtitleOverlay
        frame={frame}
        fps={fps}
        durationInFrames={segment.durationInFrames}
        voiceoverText={segment.voiceoverText}
        cueFrames={cueFrames}
        points={segment.points}
        skin={skin}
        left={58}
        bottom={116}
        width={1804}
        takeawayText={segment.humanConclusion || segment.bottomConclusion}
        subtitleMode={config.meta.subtitleMode}
        secondaryText={segment.subtitleSecondaryText}
      />

      <MediaPanel
        visualPreset={segment.visualPreset}
        motionPreset={segment.motionPreset}
        transitionPreset={transitionPreset}
        accentColor={skin.accentColor}
        secondaryColor={skin.secondaryColor}
        segment={segment}
        skin={skin}
      />
      </div>
    </ChromeFrame>
  );
};
