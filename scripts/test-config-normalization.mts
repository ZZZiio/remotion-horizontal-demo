import assert from 'node:assert/strict';
import {toEditorConfig} from '../editor/src/import-utils.ts';

const editorShape = toEditorConfig({
  meta: {
    projectName: 'Square Demo',
    accountName: 'Oxecho',
    positioning: 'Test',
    width: '1080',
    height: '-20',
    fps: '240',
  },
  theme: {
    accentColor: '#42E8D4',
    secondaryColor: '#6CAEFF',
    pageLight: '#F4F8FB',
    pageDark: '#09131C',
  },
  tags: {
    left: 'Left',
    right: 'Right',
  },
  segments: [],
});

assert.equal(editorShape.meta.width, 1080, 'numeric width strings should be accepted');
assert.equal(editorShape.meta.height, 320, 'height should be clamped to the minimum');
assert.equal(editorShape.meta.fps, 120, 'fps should be clamped to the maximum');

const promptShape = toEditorConfig({
  meta: {
    project_name: 'Prompt Demo',
    account_name: 'Oxecho',
    account_positioning: 'Test',
    width: 'abc',
    height: '720.4',
    fps: '0',
  },
  cover: {
    left_tag: 'Left',
    right_tag: 'Right',
  },
  segments: [],
});

assert.equal(promptShape.meta.width, 1920, 'invalid widths should fall back to the default');
assert.equal(promptShape.meta.height, 720, 'fractional heights should round to integers');
assert.equal(promptShape.meta.fps, 1, 'fps should be clamped to the minimum');

console.log(
  JSON.stringify(
    {
      ok: true,
      editorShape: {
        width: editorShape.meta.width,
        height: editorShape.meta.height,
        fps: editorShape.meta.fps,
      },
      promptShape: {
        width: promptShape.meta.width,
        height: promptShape.meta.height,
        fps: promptShape.meta.fps,
      },
    },
    null,
    2,
  ),
);
