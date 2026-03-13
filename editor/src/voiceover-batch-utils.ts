import type {SegmentConfig} from '../../src/account/config';

type FileLike = {
  name: string;
  size?: number;
  lastModified?: number;
};

export type VoiceoverBatchMatch<TFile extends FileLike> = {
  file: TFile;
  segmentIndex: number;
  score: number;
  strategy: 'exact-token' | 'hook' | 'segment-id' | 'numbered' | 'contains';
  originalIndex: number;
};

export type VoiceoverBatchResolution<TFile extends FileLike> = {
  accepted: Array<VoiceoverBatchMatch<TFile>>;
  unmatched: TFile[];
  duplicateFiles: TFile[];
  duplicateMatches: Array<VoiceoverBatchMatch<TFile> & {kept: VoiceoverBatchMatch<TFile>}>;
};

export const normalizeSegmentToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9一-龥]/g, '');

export const getBatchVoiceoverFileKey = (file: FileLike) => {
  return `${file.name.toLowerCase()}::${file.size ?? -1}::${file.lastModified ?? -1}`;
};

export const getSegmentVoiceoverMatchTokens = (segment: SegmentConfig, index: number) => {
  const tokens = new Set<string>();
  const addToken = (value?: string) => {
    if (!value) {
      return;
    }

    const normalized = normalizeSegmentToken(value);
    if (normalized) {
      tokens.add(normalized);
    }
  };

  addToken(segment.id);
  addToken(segment.label);
  addToken(segment.navLabel);
  if (index > 0) {
    addToken(`p${index}`);
  }
  addToken(String(index));
  addToken(String(index + 1));
  if (index === 0) {
    addToken('hook');
    addToken('开场');
  }
  return Array.from(tokens);
};

const findBestVoiceoverSegmentMatch = (segments: SegmentConfig[], fileName: string) => {
  const rawBaseName = fileName.replace(/\.[^.]+$/, '').toLowerCase();
  const baseName = normalizeSegmentToken(rawBaseName);
  if (!baseName) {
    return null;
  }

  const exactCandidates: Array<{segmentIndex: number; score: number}> = [];
  for (let index = 0; index < segments.length; index += 1) {
    const tokens = getSegmentVoiceoverMatchTokens(segments[index], index);
    const matchedToken = tokens.find((token) => token === baseName);
    if (matchedToken) {
      exactCandidates.push({segmentIndex: index, score: 1000 + matchedToken.length});
    }
  }
  if (exactCandidates.length) {
    const bestCandidate = exactCandidates.sort((left, right) => right.score - left.score || left.segmentIndex - right.segmentIndex)[0]!;
    return {...bestCandidate, strategy: 'exact-token' as const};
  }

  const findIndexBySegmentId = (segmentId: string) => segments.findIndex((segment) => normalizeSegmentToken(segment.id) === normalizeSegmentToken(segmentId));

  const hookMatch = rawBaseName.match(/(?:^|[^a-z0-9])hook(?:[^a-z0-9]|$)/i);
  if (hookMatch) {
    const hookIndex = findIndexBySegmentId('hook');
    if (hookIndex >= 0) {
      return {segmentIndex: hookIndex, score: 900, strategy: 'hook' as const};
    }
  }

  const pMatch = rawBaseName.match(/(?:^|[^a-z0-9])p(\d+)(?:[^a-z0-9]|$)/i);
  if (pMatch) {
    const pIndex = findIndexBySegmentId(`p${pMatch[1]}`);
    if (pIndex >= 0) {
      return {segmentIndex: pIndex, score: 850, strategy: 'segment-id' as const};
    }
  }

  const numberedMatch = rawBaseName.match(/(?:^|[^a-z0-9])(\d+)(?:[^a-z0-9]|$)/i) || rawBaseName.match(/(\d+)$/);
  if (numberedMatch) {
    const oneBasedIndex = Number(numberedMatch[1]) - 1;
    if (oneBasedIndex >= 0 && oneBasedIndex < segments.length) {
      return {segmentIndex: oneBasedIndex, score: 800, strategy: 'numbered' as const};
    }
  }

  const containsCandidates: Array<{segmentIndex: number; score: number}> = [];
  for (let index = 0; index < segments.length; index += 1) {
    const tokens = getSegmentVoiceoverMatchTokens(segments[index], index).filter((token) => token && !/^\d+$/.test(token));
    const bestLength = tokens.reduce((maxLength, token) => (baseName.includes(token) ? Math.max(maxLength, token.length) : maxLength), 0);
    if (bestLength > 0) {
      containsCandidates.push({segmentIndex: index, score: 500 + bestLength});
    }
  }

  if (containsCandidates.length) {
    const bestCandidate = containsCandidates.sort((left, right) => right.score - left.score || left.segmentIndex - right.segmentIndex)[0]!;
    return {...bestCandidate, strategy: 'contains' as const};
  }

  return null;
};

export const resolveBatchVoiceoverMatches = <TFile extends FileLike>(segments: SegmentConfig[], files: TFile[]): VoiceoverBatchResolution<TFile> => {
  const duplicateFiles: TFile[] = [];
  const uniqueFiles: Array<{file: TFile; originalIndex: number}> = [];
  const seenFileKeys = new Set<string>();

  files.forEach((file, originalIndex) => {
    const fileKey = getBatchVoiceoverFileKey(file);
    if (seenFileKeys.has(fileKey)) {
      duplicateFiles.push(file);
      return;
    }
    seenFileKeys.add(fileKey);
    uniqueFiles.push({file, originalIndex});
  });

  const matched: Array<VoiceoverBatchMatch<TFile>> = [];
  const unmatched: TFile[] = [];

  uniqueFiles.forEach(({file, originalIndex}) => {
    const bestMatch = findBestVoiceoverSegmentMatch(segments, file.name);
    if (!bestMatch) {
      unmatched.push(file);
      return;
    }

    matched.push({
      file,
      originalIndex,
      ...bestMatch,
    });
  });

  const acceptedBySegment = new Map<number, VoiceoverBatchMatch<TFile>>();
  const duplicateMatches: Array<VoiceoverBatchMatch<TFile> & {kept: VoiceoverBatchMatch<TFile>}> = [];

  matched
    .sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex)
    .forEach((candidate) => {
      const existing = acceptedBySegment.get(candidate.segmentIndex);
      if (!existing) {
        acceptedBySegment.set(candidate.segmentIndex, candidate);
        return;
      }

      duplicateMatches.push({...candidate, kept: existing});
    });

  const accepted = [...acceptedBySegment.values()].sort((left, right) => left.originalIndex - right.originalIndex);
  return {
    accepted,
    unmatched,
    duplicateFiles,
    duplicateMatches,
  };
};
