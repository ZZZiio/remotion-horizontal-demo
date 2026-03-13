import {Composition} from 'remotion';
import {HorizontalTechDemo} from './compositions/HorizontalTechDemo';
import {AccountDeepTemplate} from './account/AccountDeepTemplate';
import {defaultAccountProject, getProjectDuration} from './account/config';
import type {AccountProjectConfig} from './account/config';
import {defaultDemoProps} from './data/demo-props';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="HorizontalTechDemo"
        component={HorizontalTechDemo}
        durationInFrames={360}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultDemoProps}
      />
      <Composition
        id="AccountDeepTemplate"
        component={AccountDeepTemplate}
        durationInFrames={getProjectDuration(defaultAccountProject)}
        fps={defaultAccountProject.meta.fps}
        width={defaultAccountProject.meta.width}
        height={defaultAccountProject.meta.height}
        defaultProps={defaultAccountProject}
        calculateMetadata={({props}) => {
          const project = props as AccountProjectConfig & {
            meta?: {fps?: number; width?: number; height?: number};
            segments?: Array<{durationInFrames?: number; duration_sec?: number}>;
          };
          const fps = typeof project.meta?.fps === 'number' ? project.meta.fps : defaultAccountProject.meta.fps;
          const durationInFrames = Array.isArray(project.segments)
            ? (project.segments as Array<{durationInFrames?: number; duration_sec?: number}>).reduce((sum, segment) => {
                const frames = typeof segment.durationInFrames === 'number'
                  ? Math.max(24, Math.round(segment.durationInFrames))
                  : typeof segment.duration_sec === 'number'
                    ? Math.max(24, Math.round(segment.duration_sec * fps))
                    : 0;
                return sum + frames;
              }, 0)
            : getProjectDuration(defaultAccountProject);

          return {
            durationInFrames,
            fps,
            width: typeof project.meta?.width === 'number' ? project.meta.width : defaultAccountProject.meta.width,
            height: typeof project.meta?.height === 'number' ? project.meta.height : defaultAccountProject.meta.height
          };
        }}
      />
    </>
  );
};
