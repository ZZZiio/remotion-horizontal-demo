import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const tempDir = path.join(rootDir, '.tmp', 'test-render-normalization');
const scriptPath = path.join(rootDir, 'scripts', 'render-account-from-json.mjs');
const validInputPath = path.join(tempDir, 'valid-render-input.json');
const invalidInputPath = path.join(tempDir, 'invalid-render-input.json');
const outputPath = path.join(tempDir, 'out', 'result.mp4');

await mkdir(path.dirname(outputPath), {recursive: true});

await writeFile(
  validInputPath,
  `${JSON.stringify(
    {
      meta: {
        project_name: 'Render Validate',
        account_name: 'Tester',
        account_positioning: null,
        width: '1280',
        height: '720',
        fps: '60',
        visual_skin: 'tool',
      },
      theme: {
        accent_color: '#102030',
        secondary_color: '#405060',
        page_light: '#eef2f7',
        page_dark: '#09131c',
      },
      cover: {
        main_title: 'Render Validate Cover',
        sub_title: null,
        left_tag: '左侧标签',
        right_tag: '右侧标签',
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
          title: '段落标题',
          subtitle: null,
          bottom_conclusion: null,
          voiceover_text: '口播文案',
          human_conclusion: null,
          points: ['点 1'],
          media_label: '示意图',
          media_url: 'https://example.com/demo.png',
          media_prompt: null,
          evidence_text: null,
          needs_github_evidence: 'false',
          audio_start_sec: '0.25',
          audio_end_sec: '3.25',
          cue_points_sec: ['0.5', '1.5'],
        },
      ],
    },
    null,
    2,
  )}
`,
  'utf8',
);

await writeFile(invalidInputPath, '{"broken": ', 'utf8');

const validRun = spawnSync(process.execPath, [scriptPath, validInputPath, outputPath], {
  cwd: rootDir,
  encoding: 'utf8',
  env: {
    ...process.env,
    REMOTION_RENDER_VALIDATE_ONLY: '1',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  },
});

if (validRun.status !== 0) {
  throw new Error(`validate-only 渲染脚本执行失败: ${validRun.stderr || validRun.stdout}`);
}

const validPayload = JSON.parse(validRun.stdout.trim()) as {
  ok: boolean;
  outputPath: string;
  normalizedPayload: {
    meta: {width: number; height: number; fps: number; projectName: string};
    theme: {pageLight: string; pageDark: string};
    segments: Array<{
      durationInFrames: number;
      subtitle: string;
      humanConclusion: string;
      evidenceText: string;
      needsGithubEvidence: boolean;
      audioStartSec?: number;
      audioEndSec?: number;
      cuePointsSec?: number[];
    }>;
  };
};

if (!validPayload.ok) {
  throw new Error('validate-only 输出未返回 ok=true');
}

if (validPayload.normalizedPayload.meta.width !== 1280 || validPayload.normalizedPayload.meta.height !== 720 || validPayload.normalizedPayload.meta.fps !== 60) {
  throw new Error('渲染脚本未正确归一化字符串宽高帧率');
}

if (validPayload.normalizedPayload.segments[0]?.durationInFrames !== 210) {
  throw new Error(`渲染脚本未正确归一化字符串时长：${validPayload.normalizedPayload.segments[0]?.durationInFrames}`);
}

if (validPayload.normalizedPayload.segments[0]?.needsGithubEvidence !== false) {
  throw new Error('渲染脚本未正确归一化布尔字符串 false');
}

if (
  validPayload.normalizedPayload.segments[0]?.subtitle === 'null' ||
  validPayload.normalizedPayload.segments[0]?.humanConclusion === 'null' ||
  validPayload.normalizedPayload.segments[0]?.evidenceText === 'null'
) {
  throw new Error('渲染脚本把 null 文本错误归一化成了字符串 null');
}

if (validPayload.normalizedPayload.segments[0]?.audioStartSec !== 0.25 || validPayload.normalizedPayload.segments[0]?.audioEndSec !== 3.25) {
  throw new Error('渲染脚本未正确归一化音频时间');
}

if (JSON.stringify(validPayload.normalizedPayload.segments[0]?.cuePointsSec) !== JSON.stringify([0.5, 1.5])) {
  throw new Error('渲染脚本未正确归一化 cue points');
}

const invalidRun = spawnSync(process.execPath, [scriptPath, invalidInputPath, outputPath], {
  cwd: rootDir,
  encoding: 'utf8',
  env: {
    ...process.env,
    REMOTION_RENDER_VALIDATE_ONLY: '1',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  },
});

if (invalidRun.status === 0) {
  throw new Error('非法 JSON 本应失败，但脚本返回成功');
}

if (!invalidRun.stderr.includes('项目 JSON 解析失败')) {
  throw new Error(`非法 JSON 的错误文案不够明确：${invalidRun.stderr || invalidRun.stdout}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      outputPath: validPayload.outputPath,
      normalizedMeta: validPayload.normalizedPayload.meta,
      firstSegmentFrames: validPayload.normalizedPayload.segments[0]?.durationInFrames,
      cuePoints: validPayload.normalizedPayload.segments[0]?.cuePointsSec,
      invalidJsonError: invalidRun.stderr.trim(),
    },
    null,
    2,
  ),
);
