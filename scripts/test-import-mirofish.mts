import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractPromptJson, toEditorConfig} from '../editor/src/import-utils.ts';
import {getProjectDuration} from '../src/account/config.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const inputPath = path.join(rootDir, 'examples', 'mirofish-prompt-output.md');
const outputPath = path.join(rootDir, 'examples', 'mirofish-editor-config.generated.json');

const markdown = await readFile(inputPath, 'utf8');
const payload = extractPromptJson(markdown);
const config = toEditorConfig(payload);

await mkdir(path.dirname(outputPath), {recursive: true});
await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

const durationInFrames = getProjectDuration(config);

const compatibilityConfig = toEditorConfig({
  meta: {
    project_name: 'Stringy Import',
    account_name: 'Tester',
    account_positioning: null,
    width: '1280',
    height: '720',
    fps: '60',
    visual_skin: 'tool',
    subtitle_mode: 'bilingual-keywords',
  },
  theme: {
    accent_color: '#112233',
    secondary_color: '#445566',
    page_light: '#f5f7fb',
    page_dark: '#0f1720',
  },
  cover: {
    main_title: '字符串字段也要导入',
    sub_title: null,
    left_tag: '左标签',
    right_tag: '右标签',
    bottom_conclusion: '结论',
  },
  navigation: {
    items: ['第一段'],
  },
  segments: [
    {
      id: 'seg-1',
      name: '第一段',
      duration_sec: '3.5',
      layout: 'hero',
      motion_preset: 'lift',
      visual_preset: 'image',
      title: '标题',
      subtitle: null,
      bottom_conclusion: null,
      voiceover_text: '口播文本',
      human_conclusion: null,
      subtitle_secondary_text: null,
      points: ['点1', '点2'],
      media_label: '主视觉',
      media_url: 'https://example.com/demo.png',
      media_prompt: null,
      audio_start_sec: '0.2',
      audio_end_sec: '3.4',
      cue_points_sec: ['0.5', '1.2'],
      needs_github_evidence: 'true',
      evidence_text: null,
    },
  ],
});

if (compatibilityConfig.meta.width !== 1280 || compatibilityConfig.meta.height !== 720 || compatibilityConfig.meta.fps !== 60) {
  throw new Error('字符串宽高帧率未被正确归一化');
}

if (compatibilityConfig.segments[0]?.durationInFrames !== 210) {
  throw new Error(`字符串时长未被正确归一化：${compatibilityConfig.segments[0]?.durationInFrames}`);
}

if (compatibilityConfig.segments[0]?.audioStartSec !== 0.2 || compatibilityConfig.segments[0]?.audioEndSec !== 3.4) {
  throw new Error('字符串音频时间未被正确归一化');
}

if (compatibilityConfig.segments[0]?.needsGithubEvidence !== true) {
  throw new Error('布尔字符串未被正确归一化');
}

if (
  compatibilityConfig.segments[0]?.subtitle === 'null' ||
  compatibilityConfig.segments[0]?.humanConclusion === 'null' ||
  compatibilityConfig.segments[0]?.evidenceText === 'null'
) {
  throw new Error('null 文本字段未被安全归一化');
}

if (compatibilityConfig.theme.pageLight !== '#f5f7fb' || compatibilityConfig.theme.pageDark !== '#0f1720') {
  throw new Error('主题 page_light/page_dark 未被导入');
}

console.log(
  JSON.stringify(
    {
      input: inputPath,
      output: outputPath,
      projectName: config.meta.projectName,
      resolution: `${config.meta.width}x${config.meta.height}`,
      fps: config.meta.fps,
      segmentCount: config.segments.length,
      durationInFrames,
      durationSeconds: Number((durationInFrames / config.meta.fps).toFixed(1)),
      segmentTitles: config.segments.map((segment) => segment.title),
      compatibilityCheck: {
        projectName: compatibilityConfig.meta.projectName,
        resolution: `${compatibilityConfig.meta.width}x${compatibilityConfig.meta.height}`,
        fps: compatibilityConfig.meta.fps,
        firstSegmentFrames: compatibilityConfig.segments[0]?.durationInFrames,
        cuePoints: compatibilityConfig.segments[0]?.cuePointsSec,
        needsGithubEvidence: compatibilityConfig.segments[0]?.needsGithubEvidence,
      }
    },
    null,
    2
  )
);
