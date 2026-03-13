import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {toEditorConfig, toTemplateConfig} from '../editor/src/import-utils.ts';
import {normalizeStickScene} from '../src/stick/normalizers.ts';

const examplePath = resolve(process.cwd(), 'examples', 'stick-animation-demo.json');
const raw = JSON.parse(readFileSync(examplePath, 'utf-8').replace(/^\uFEFF/, ''));

const config = toEditorConfig(raw);

assert.equal(raw.segments.length, 6, 'stick demo source should contain six segments');
assert.equal(config.segments.length, raw.segments.length, 'editor import should preserve provided segment count');

const presets = config.segments.slice(0, raw.segments.length).map((segment) => segment.visualPreset);
assert.deepEqual(
  presets,
  ['stick-narration', 'stick-dialogue', 'stick-conflict', 'stick-compare', 'stick-dialogue', 'stick-narration'],
  'example should cover all stick preset variants',
);

const firstDialogue = config.segments[1];
const normalizedDialogue = normalizeStickScene(firstDialogue);

assert.equal(normalizedDialogue.template, 'dialogue', 'dialogue preset should normalize to dialogue template');
assert.equal(normalizedDialogue.actors.length, 2, 'dialogue example should retain two actors');
assert.ok((normalizedDialogue.bubbles?.length ?? 0) >= 2, 'dialogue example should retain bubbles');
assert.equal(normalizedDialogue.autoCamera, true, 'autoCamera should survive normalization');

const compareSegment = config.segments[3];
const normalizedCompare = normalizeStickScene(compareSegment);
assert.equal(normalizedCompare.template, 'compare', 'compare preset should normalize to compare template');
assert.equal(normalizedCompare.actors.length, 2, 'compare template should keep two actors');

const roundTrip = toTemplateConfig(config);
assert.equal(roundTrip.segments[1].visual_preset, 'stick-dialogue', 'template export should preserve stick preset');
assert.equal(roundTrip.segments[1].stick_scene?.template, 'dialogue', 'template export should preserve stick scene');
assert.equal(roundTrip.segments[3].stick_scene?.template, 'compare', 'compare scene should survive round trip');

console.log(
  JSON.stringify(
    {
      ok: true,
      sourceSegmentCount: raw.segments.length,
      importedSegmentCount: config.segments.length,
      presets,
      dialogueActors: normalizedDialogue.actors.map((actor) => actor.id),
      compareActors: normalizedCompare.actors.map((actor) => actor.id),
    },
    null,
    2,
  ),
);
