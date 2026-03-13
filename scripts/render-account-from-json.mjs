import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const parseCliArgs = (argv) => {
  const positional = [];
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;

    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const withoutPrefix = arg.slice(2);
    if (!withoutPrefix) continue;

    const equalsIndex = withoutPrefix.indexOf('=');
    if (equalsIndex !== -1) {
      const key = withoutPrefix.slice(0, equalsIndex);
      const value = withoutPrefix.slice(equalsIndex + 1);
      flags[key] = value;
      continue;
    }

    const key = withoutPrefix;
    const nextValue = argv[index + 1];
    if (nextValue && !nextValue.startsWith('--')) {
      flags[key] = nextValue;
      index += 1;
    } else {
      flags[key] = true;
    }
  }

  return {positional, flags};
};

const pickFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('无法获取可用端口')));
        return;
      }

      const port = address.port;
      server.close(() => resolve(port));
    });
  });

const normalizePositiveInteger = (value, fallback, min, max) => {
  const nextValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(nextValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(nextValue)));
};

const normalizeText = (value, fallback = '') => {
  if (value === null || typeof value === 'undefined') {
    return fallback;
  }

  return typeof value === 'string' ? value : String(value);
};

const normalizeFiniteNumber = (value) => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return undefined;
  }

  const nextValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : undefined;
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
};

const describeSpawnFailure = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    return `无法启动渲染命令：${message}。请检查 Node.js / npx / Remotion 是否可用。`;
  }

  return message;
};

const runCommand = ({command, args, cwd, label}) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    },
  });

  if (result.error) {
    throw new Error(`${label} failed: ${describeSpawnFailure(result.error)}`);
  }

  if (result.status !== 0) {
    throw new Error(`${label} exited with code ${result.status ?? 'unknown'}${result.signal ? ` (signal ${result.signal})` : ''}.`);
  }

  return result;
};

process.stdout.setDefaultEncoding?.('utf8');
process.stderr.setDefaultEncoding?.('utf8');
process.env.NO_COLOR ??= '1';
process.env.FORCE_COLOR ??= '0';
process.env.PYTHONUTF8 ??= '1';
process.env.PYTHONIOENCODING ??= 'utf-8';

const defaultProject = {
  meta: {
    projectName: 'AccountProject',
    accountName: 'Oxecho',
    positioning: 'AI开源项目翻译官 / 避坑拆解号',
    width: 1920,
    height: 1080,
    fps: 30,
    visualSkin: 'blacktech',
    transitionPreset: 'soft',
    ipEnabled: true,
    ipName: undefined,
    ipSlogan: undefined,
    ipHandle: undefined,
    ipLogoUrl: undefined,
    publishTitle: undefined,
    publishDescription: undefined,
    publishTopics: undefined,
    sfxEnabled: true,
    sfxVolume: 0.7
  },
  theme: {
    accentColor: '#42E8D4',
    secondaryColor: '#6CAEFF',
    pageLight: '#F4F8FB',
    pageDark: '#09131C'
  },
  tags: {
    left: 'AI开源拆解',
    right: '帮普通人看懂项目'
  }
};

const normalizeMediaItems = (value, fallbackLabel) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map((item, index) => {
      const raw = item ?? {};
      const url = typeof (raw.url ?? raw.media_url ?? raw.mediaUrl) === 'string' ? String(raw.url ?? raw.media_url ?? raw.mediaUrl).trim() : '';
      const prompt = typeof (raw.prompt ?? raw.media_prompt ?? raw.mediaPrompt) === 'string' ? String(raw.prompt ?? raw.media_prompt ?? raw.mediaPrompt).trim() : '';
      return {
        id: normalizeText(raw.id, `media-${index + 1}`),
        label: normalizeText(raw.label ?? raw.media_label, fallbackLabel ?? `素材 ${index + 1}`),
        url: url || undefined,
        prompt: prompt || undefined,
        source: raw.source ?? (url ? (url.startsWith('http') ? 'remote' : 'local') : prompt ? 'generated' : undefined)
      };
    })
    .filter((item) => item.url || item.prompt);

  return items.length ? items : undefined;
};

const normalizeProject = (payload, options = {}) => {
  const raw = payload ?? {};
  const meta = raw.meta ?? {};
  const theme = raw.theme ?? {};
  const cover = raw.cover ?? {};
  const navigation = raw.navigation ?? {};
  const sourceFps = normalizePositiveInteger(meta.fps, defaultProject.meta.fps, 1, 120);
  const fpsOverride = typeof options.fpsOverride === 'number' ? options.fpsOverride : undefined;
  const fps = normalizePositiveInteger(typeof fpsOverride === 'number' ? fpsOverride : meta.fps, defaultProject.meta.fps, 1, 120);
  const preferDurationSeconds =
    typeof options.preferDurationSeconds === 'boolean'
      ? options.preferDurationSeconds
      : typeof fpsOverride === 'number' && sourceFps !== fps;
  const navigationItems = Array.isArray(navigation.items) ? navigation.items.map((item) => String(item)) : [];
  const segments = Array.isArray(raw.segments) ? raw.segments : [];

  const normalizedSegments = segments.map((segment, index) => {
    const item = segment ?? {};
    const durationFramesRaw = normalizeFiniteNumber(item.durationInFrames ?? item.duration_frames ?? item.duration_in_frames);
    const durationSecondsRaw = normalizeFiniteNumber(item.duration_sec ?? item.durationSeconds);
    const durationInFrames = typeof durationSecondsRaw === 'number' && preferDurationSeconds
      ? Math.max(24, Math.round(durationSecondsRaw * fps))
      : typeof durationFramesRaw === 'number'
        ? Math.max(24, Math.round(durationFramesRaw))
        : typeof durationSecondsRaw === 'number'
          ? Math.max(24, Math.round(durationSecondsRaw * fps))
          : 60;
    const mediaItems = normalizeMediaItems(item.mediaItems ?? item.media_items, item.media_label ?? item.mediaLabel ?? '主视觉素材');
    const firstMedia = mediaItems?.[0];

    return {
      id: normalizeText(item.id, `segment-${index + 1}`),
      label: normalizeText(item.label ?? item.name, `段落 ${index + 1}`),
      navLabel: normalizeText(item.navLabel ?? item.nav_label ?? navigationItems[index] ?? item.name, `P${index + 1}`),
      durationInFrames,
      layout: String(item.layout ?? 'hero'),
      motionPreset: String(item.motionPreset ?? item.motion_preset ?? 'lift'),
      visualPreset: String(item.visualPreset ?? item.visual_preset ?? (mediaItems?.length ? 'image' : 'orb')),
      title: normalizeText(item.title, ''),
      subtitle: normalizeText(item.subtitle ?? item.sub_title, ''),
      bottomConclusion: normalizeText(item.bottomConclusion ?? item.bottom_conclusion, ''),
      voiceoverText: normalizeText(item.voiceoverText ?? item.voiceover_text, ''),
      humanConclusion: normalizeText(item.humanConclusion ?? item.human_conclusion, ''),
      points: Array.isArray(item.points) ? item.points.map((point) => normalizeText(point)).filter(Boolean) : [],
      mediaLabel: normalizeText(item.mediaLabel ?? item.media_label ?? firstMedia?.label, '主视觉素材'),
      mediaUrl: typeof (item.mediaUrl ?? item.media_url) === 'string' ? String(item.mediaUrl ?? item.media_url) : firstMedia?.url,
      mediaPrompt: normalizeText(item.mediaPrompt ?? item.media_prompt ?? firstMedia?.prompt, ''),
      mediaItems,
      stickScene: (item.stickScene ?? item.stick_scene) && typeof (item.stickScene ?? item.stick_scene) === 'object' ? (item.stickScene ?? item.stick_scene) : undefined,
      evidenceText: normalizeText(item.evidenceText ?? item.evidence_text, ''),
      needsGithubEvidence: normalizeBoolean(item.needsGithubEvidence ?? item.needs_github_evidence) ?? false,
      audioStartSec: normalizeFiniteNumber(item.audioStartSec ?? item.audio_start_sec),
      audioEndSec: normalizeFiniteNumber(item.audioEndSec ?? item.audio_end_sec),
      cuePointsSec: Array.isArray(item.cuePointsSec ?? item.cue_points_sec)
        ? (item.cuePointsSec ?? item.cue_points_sec).map((point) => Number(point)).filter((point) => Number.isFinite(point) && point >= 0)
        : undefined
    };
  });

  if (!segments.length) {
    throw new Error('项目 segments 为空，无法渲染');
  }

  if (normalizedSegments[0]) {
    normalizedSegments[0] = {
      ...normalizedSegments[0],
      title: normalizeText(cover.main_title ?? cover.mainTitle, normalizedSegments[0].title),
      subtitle: normalizeText(cover.sub_title ?? cover.subTitle, normalizedSegments[0].subtitle),
      bottomConclusion: normalizeText(cover.bottom_conclusion ?? cover.bottomConclusion, normalizedSegments[0].bottomConclusion)
    };
  }

  return {
    meta: {
      projectName: normalizeText(meta.projectName ?? meta.project_name, defaultProject.meta.projectName),
      accountName: normalizeText(meta.accountName ?? meta.account_name, defaultProject.meta.accountName),
      positioning: normalizeText(meta.positioning ?? meta.account_positioning, defaultProject.meta.positioning),
      width: normalizePositiveInteger(
        typeof options.widthOverride === 'number' ? options.widthOverride : meta.width,
        defaultProject.meta.width,
        320,
        7680
      ),
      height: normalizePositiveInteger(
        typeof options.heightOverride === 'number' ? options.heightOverride : meta.height,
        defaultProject.meta.height,
        320,
        4320
      ),
      fps: normalizePositiveInteger(fps, defaultProject.meta.fps, 1, 120),
      visualSkin: normalizeText(meta.visualSkin ?? meta.visual_skin, defaultProject.meta.visualSkin),
      transitionPreset: normalizeText(meta.transitionPreset ?? meta.transition_preset, defaultProject.meta.transitionPreset),
      ipEnabled: normalizeBoolean(meta.ipEnabled ?? meta.ip_enabled) ?? defaultProject.meta.ipEnabled,
      ipName: normalizeText(meta.ipName ?? meta.ip_name, '').trim() || undefined,
      ipSlogan: normalizeText(meta.ipSlogan ?? meta.ip_slogan, '').trim() || undefined,
      ipHandle: normalizeText(meta.ipHandle ?? meta.ip_handle, '').trim() || undefined,
      ipLogoUrl: normalizeText(meta.ipLogoUrl ?? meta.ip_logo_url, '').trim() || undefined,
      publishTitle: normalizeText(meta.publishTitle ?? meta.publish_title, '').trim() || undefined,
      publishDescription: normalizeText(meta.publishDescription ?? meta.publish_description, '').trim() || undefined,
      publishTopics: normalizeText(meta.publishTopics ?? meta.publish_topics, '').trim() || undefined,
      sfxEnabled: normalizeBoolean(meta.sfxEnabled ?? meta.sfx_enabled) ?? defaultProject.meta.sfxEnabled,
      sfxVolume: typeof normalizeFiniteNumber(meta.sfxVolume ?? meta.sfx_volume) === 'number' ? normalizeFiniteNumber(meta.sfxVolume ?? meta.sfx_volume) : defaultProject.meta.sfxVolume
    },
    theme: {
      accentColor: normalizeText(theme.accentColor ?? theme.accent_color, defaultProject.theme.accentColor),
      secondaryColor: normalizeText(theme.secondaryColor ?? theme.secondary_color, defaultProject.theme.secondaryColor),
      pageLight: normalizeText(theme.pageLight ?? theme.page_light, defaultProject.theme.pageLight),
      pageDark: normalizeText(theme.pageDark ?? theme.page_dark, defaultProject.theme.pageDark)
    },
    tags: {
      left: normalizeText(raw.tags?.left ?? raw.tags?.left_tag ?? cover.left_tag ?? cover.leftTag, defaultProject.tags.left),
      right: normalizeText(raw.tags?.right ?? raw.tags?.right_tag ?? cover.right_tag ?? cover.rightTag, defaultProject.tags.right)
    },
    segments: normalizedSegments
  };
};

const {positional: positionalArgs, flags: cliFlags} = parseCliArgs(process.argv.slice(2));
const inputPathArg = positionalArgs[0];
const outputPathArg = positionalArgs[1];
const encoderModeRaw =
  typeof cliFlags.encoder === 'string'
    ? cliFlags.encoder
    : cliFlags.nvenc
      ? 'nvenc'
      : 'x264';
const encoderMode = normalizeText(encoderModeRaw, 'x264').trim().toLowerCase();
const performanceMode = cliFlags.profile === 'performance' || cliFlags.performance === true;
const profileWidth = normalizePositiveInteger(cliFlags.width, 1280, 320, 7680);
const profileHeight = normalizePositiveInteger(cliFlags.height, 720, 320, 4320);
const profileFps = normalizePositiveInteger(cliFlags.fps, 24, 1, 120);
const renderValidateOnly = process.env.REMOTION_RENDER_VALIDATE_ONLY === '1';
const keepNvencTemp = process.env.KEEP_NVENC_TEMP === '1';
const projectRoot = process.cwd();
let normalizedPropsPath = null;
let tempPropsDir = null;
let tempNvencDir = null;
let exitCode = 0;

try {
  if (!inputPathArg) {
    throw new Error('用法：node scripts/render-account-from-json.mjs <项目JSON路径> [输出mp4路径] [--encoder=nvenc|nvenc-fast|x264] [--profile=performance] [--width=1280] [--height=720] [--fps=24]');
  }

  const inputPath = path.resolve(projectRoot, inputPathArg);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`找不到项目 JSON：${inputPath}`);
  }

  const outputPath = outputPathArg
    ? path.resolve(projectRoot, outputPathArg)
    : path.resolve(projectRoot, 'out', `${path.basename(inputPath, path.extname(inputPath))}.mp4`);

  try {
    fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  } catch (error) {
    throw new Error(`创建输出目录失败：${error instanceof Error ? error.message : String(error)}`);
  }

  const inputText = fs.readFileSync(inputPath, 'utf-8').replace(/^\uFEFF/, '');
  let inputPayload;
  try {
    inputPayload = JSON.parse(inputText);
  } catch (error) {
    throw new Error(`项目 JSON 解析失败：${error instanceof Error ? error.message : String(error)}`);
  }

  let normalizedPayload;
  try {
    normalizedPayload = normalizeProject(inputPayload, {
      widthOverride: performanceMode ? profileWidth : undefined,
      heightOverride: performanceMode ? profileHeight : undefined,
      fpsOverride: performanceMode ? profileFps : undefined,
    });
  } catch (error) {
    throw new Error(`项目配置归一化失败：${error instanceof Error ? error.message : String(error)}`);
  }

  tempPropsDir = path.resolve(projectRoot, '.tmp', 'render-normalized');
  normalizedPropsPath = path.join(tempPropsDir, `${path.basename(inputPath, path.extname(inputPath))}.normalized.json`);

  fs.mkdirSync(tempPropsDir, {recursive: true});
  fs.writeFileSync(normalizedPropsPath, JSON.stringify(normalizedPayload, null, 2), 'utf-8');

  if (renderValidateOnly) {
    console.log(JSON.stringify({ok: true, outputPath, normalizedPayload}, null, 2));
  } else {
    const rendererPort = await pickFreePort();
    const npxCommand = process.platform === 'win32' ? 'cmd.exe' : 'npx';

    const buildRemotionArgs = (renderOutput, extraArgs = []) => {
      const baseArgs = ['remotion', 'render', 'src/index.ts', 'AccountDeepTemplate', renderOutput, `--props=${normalizedPropsPath}`, `--port=${rendererPort}`];
      const mergedArgs = baseArgs.concat(extraArgs);
      return process.platform === 'win32' ? ['/d', '/s', '/c', 'npx', ...mergedArgs] : mergedArgs;
    };

    if (encoderMode === 'nvenc' || encoderMode === 'nvenc-fast') {
      const jobKey = path.basename(outputPath, path.extname(outputPath));
      tempNvencDir = path.resolve(os.tmpdir(), 'oxecho-nvenc', jobKey);
      const framesDir = path.join(tempNvencDir, 'frames');
      const audioPath = path.join(tempNvencDir, 'audio.m4a');

      fs.mkdirSync(framesDir, {recursive: true});

      const totalFrames = normalizedPayload.segments.reduce((sum, segment) => sum + (segment.durationInFrames ?? 0), 0);
      const padLength = Math.max(1, String(Math.max(0, totalFrames - 1)).length);
      const isNvencFast = encoderMode === 'nvenc-fast';
      const imageFormat = isNvencFast ? 'jpeg' : 'png';
      const jpegQuality = 88;
      const imagePattern = 'frame-[frame].[ext]';

      console.log(`开始渲染（NVENC，先出序列帧）：${outputPath}`);

      runCommand({
        command: npxCommand,
        args: buildRemotionArgs(
          framesDir,
          [
            '--sequence',
            `--image-format=${imageFormat}`,
            isNvencFast ? `--jpeg-quality=${jpegQuality}` : null,
            `--image-sequence-pattern=${imagePattern}`,
            `--separate-audio-to=${audioPath}`,
          ].filter(Boolean)
        ),
        cwd: projectRoot,
        label: 'Remotion render (image sequence)',
      });

      const firstFramePath = path.join(framesDir, `frame-${String(0).padStart(padLength, '0')}.${imageFormat}`);
      if (!fs.existsSync(firstFramePath)) {
        throw new Error(`Remotion 渲染已结束，但未在序列帧目录找到首帧：${framesDir}`);
      }

      const ffmpegInput = path.join(framesDir, `frame-%0${padLength}d.${imageFormat}`);
      const hasAudio = fs.existsSync(audioPath);

      const baseFfmpegArgs = ['-y', '-framerate', String(normalizedPayload.meta.fps), '-i', ffmpegInput];

      const nvencVideoArgs = [
        '-c:v',
        'h264_nvenc',
        '-preset',
        'p7',
        '-tune',
        'hq',
        '-rc',
        'vbr',
        '-multipass',
        'fullres',
        '-cq',
        '19',
        '-b:v',
        '0',
        '-rc-lookahead',
        '32',
        '-spatial_aq',
        '1',
        '-temporal_aq',
        '1',
        '-aq-strength',
        '8',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
      ];

      const runFfmpeg = (audioArgs) =>
        runCommand({
          command: 'ffmpeg',
          args: baseFfmpegArgs.concat(audioArgs ?? []).concat(nvencVideoArgs).concat(['-shortest', outputPath]),
          cwd: projectRoot,
          label: 'ffmpeg NVENC',
        });

      if (hasAudio) {
        try {
          runFfmpeg(['-i', audioPath, '-c:a', 'copy']);
        } catch (error) {
          console.warn('ffmpeg 音频 copy 失败，回退到 AAC 重编码。');
          runFfmpeg(['-i', audioPath, '-c:a', 'aac', '-b:a', '192k']);
        }
      } else {
        runFfmpeg([]);
      }

      if (!fs.existsSync(outputPath)) {
        throw new Error(`ffmpeg 已结束，但未找到输出文件：${outputPath}`);
      }

      console.log(`渲染完成（NVENC）：${outputPath}`);
    } else {
      console.log(`开始渲染：${outputPath}`);

      runCommand({
        command: npxCommand,
        args: buildRemotionArgs(outputPath),
        cwd: projectRoot,
        label: 'Remotion render (mp4)',
      });

      if (!fs.existsSync(outputPath)) {
        throw new Error(`渲染命令已结束，但未找到输出文件：${outputPath}`);
      }

      console.log(`渲染完成：${outputPath}`);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  exitCode = 1;
} finally {
  try {
    if (normalizedPropsPath) {
      fs.rmSync(normalizedPropsPath, {force: true});
    }
    if (tempPropsDir && fs.existsSync(tempPropsDir) && fs.readdirSync(tempPropsDir).length === 0) {
      fs.rmdirSync(tempPropsDir);
    }
  } catch {}

  try {
    if (tempNvencDir && !keepNvencTemp) {
      fs.rmSync(tempNvencDir, {recursive: true, force: true});
    }
  } catch {}
}

process.exitCode = exitCode;
