import assert from 'node:assert/strict';
import {resolveBatchVoiceoverMatches} from '../editor/src/voiceover-batch-utils.ts';

const segments = [
  {id: 'hook', label: '开场 Hook', navLabel: '开场'},
  {id: 'p1', label: '引言 P1', navLabel: '引言'},
  {id: 'p2', label: '能力 P2', navLabel: '能力'},
] as const;

const files = [
  {name: 'hook.wav', size: 100, lastModified: 1},
  {name: 'hook.wav', size: 100, lastModified: 1},
  {name: 'P1-final.wav', size: 110, lastModified: 2},
  {name: '第1段备用.wav', size: 120, lastModified: 3},
  {name: 'random-note.wav', size: 130, lastModified: 4},
];

const result = resolveBatchVoiceoverMatches(segments as never, files);

assert.equal(result.accepted.length, 2, 'should keep only one file per matched segment');
assert.deepEqual(
  result.accepted.map((item) => ({name: item.file.name, segmentIndex: item.segmentIndex})),
  [
    {name: 'hook.wav', segmentIndex: 0},
    {name: 'P1-final.wav', segmentIndex: 1},
  ],
);
assert.equal(result.duplicateFiles.length, 1, 'should drop exact duplicate file selections');
assert.equal(result.duplicateMatches.length, 1, 'should drop lower-priority duplicate segment matches');
assert.equal(result.unmatched.length, 1, 'should keep unmatched files out of the batch');

console.log(
  JSON.stringify(
    {
      ok: true,
      accepted: result.accepted.map((item) => ({name: item.file.name, segmentIndex: item.segmentIndex, strategy: item.strategy})),
      duplicateFiles: result.duplicateFiles.map((file) => file.name),
      duplicateMatches: result.duplicateMatches.map((item) => ({name: item.file.name, kept: item.kept.file.name, segmentIndex: item.segmentIndex})),
      unmatched: result.unmatched.map((file) => file.name),
    },
    null,
    2,
  ),
);
