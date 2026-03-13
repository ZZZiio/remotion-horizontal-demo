import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path

import ctranslate2
from faster_whisper import WhisperModel


def ensure_utf8_stdio():
    for stream_name in ('stdout', 'stderr'):
        stream = getattr(sys, stream_name, None)
        if stream and hasattr(stream, 'reconfigure'):
            try:
                stream.reconfigure(encoding='utf-8', errors='replace')
            except Exception:
                pass


def normalize_text(text: str) -> str:
    text = text.lower()
    return re.sub(r'[^0-9a-z\u4e00-\u9fff]+', '', text)


def infer_punctuation_cues(text: str, duration_sec: float):
    clauses = [item.strip() for item in re.split(r'[，,。！？；、?!.]+', text) if item.strip()]
    if len(clauses) <= 1:
        return []

    normalized_lengths = [max(len(normalize_text(clause)), 1) for clause in clauses]
    total_length = max(sum(normalized_lengths), 1)
    elapsed = 0
    cue_points = []
    for length in normalized_lengths[:-1]:
        elapsed += length
        rel = round(duration_sec * (elapsed / total_length), 3)
        if rel > 0.12:
            cue_points.append(rel)
    return cue_points


def seconds_to_frames(seconds: float, fps: int) -> int:
    return max(24, int(round(seconds * fps)))


@dataclass
class AsrSegment:
    start: float
    end: float
    text: str
    words: list[dict]


def read_project(project_path: Path):
    payload = json.loads(project_path.read_text(encoding='utf-8-sig'))
    meta = payload.get('meta', {})
    fps = int(meta.get('fps', 30))
    segments = payload.get('segments', [])
    items = []
    for index, segment in enumerate(segments):
      voiceover = segment.get('voiceoverText') or segment.get('voiceover_text') or ''
      items.append(
          {
              'index': index,
              'id': segment.get('id', f'segment-{index + 1}'),
              'label': segment.get('label') or segment.get('name') or f'段落 {index + 1}',
              'voiceover': str(voiceover),
          }
      )
    return fps, items


def probe_audio_duration(audio_path: Path) -> float:
    try:
        result = subprocess.run(
            [
                'ffprobe',
                '-v',
                'error',
                '-show_entries',
                'format=duration',
                '-of',
                'default=noprint_wrappers=1:nokey=1',
                str(audio_path),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return float((result.stdout or '0').strip() or 0)
    except Exception:
        return 0.0


def resolve_runtime(device: str, compute_type: str):
    resolved_device = device
    resolved_compute_type = compute_type

    if resolved_device == 'auto':
        try:
            import torch

            if torch.cuda.is_available():
                resolved_device = 'cuda'
            else:
                resolved_device = 'cpu'
        except Exception:
            resolved_device = 'cpu'

    if resolved_compute_type == 'auto':
        try:
            supported = ctranslate2.get_supported_compute_types(resolved_device)
        except Exception:
            supported = set()

        preferred = {
            'cuda': ['float16', 'int8_float16', 'int8', 'float32'],
            'cpu': ['int8', 'int8_float32', 'float32'],
        }.get(resolved_device, ['float32'])

        for candidate in preferred:
            if candidate in supported:
                resolved_compute_type = candidate
                break

        if resolved_compute_type == 'auto':
            resolved_compute_type = 'float32'

    return resolved_device, resolved_compute_type


def load_whisper_model(model_name: str, device: str, compute_type: str):
    resolved_device, resolved_compute_type = resolve_runtime(device, compute_type)
    model = WhisperModel(model_name, device=resolved_device, compute_type=resolved_compute_type)
    return model, resolved_device, resolved_compute_type


def transcribe_with_model(model: WhisperModel, audio_path: Path, language: str | None):
    segments, info = model.transcribe(
        str(audio_path),
        language=language or None,
        vad_filter=True,
        word_timestamps=True,
        condition_on_previous_text=False,
    )

    asr_segments: list[AsrSegment] = []
    for segment in segments:
        text = (segment.text or '').strip()
        if not text:
            continue
        words = []
        for word in (segment.words or []):
            start = getattr(word, 'start', None)
            end = getattr(word, 'end', None)
            word_text = (getattr(word, 'word', '') or '').strip()
            if start is None or end is None or not word_text:
                continue
            words.append(
                {
                    'start': float(start),
                    'end': float(end),
                    'word': word_text,
                }
            )
        asr_segments.append(AsrSegment(start=float(segment.start), end=float(segment.end), text=text, words=words))

    detected_language = getattr(info, 'language', None)
    duration = asr_segments[-1].end if asr_segments else probe_audio_duration(audio_path)
    return asr_segments, detected_language, duration


def transcribe_audio(audio_path: Path, model_name: str, language: str | None, device: str, compute_type: str):
    model, resolved_device, resolved_compute_type = load_whisper_model(model_name, device, compute_type)
    asr_segments, detected_language, duration = transcribe_with_model(model, audio_path, language)
    return asr_segments, detected_language, duration, resolved_device, resolved_compute_type


def align_segments(project_segments, asr_segments: list[AsrSegment]):
    n = len(project_segments)
    m = len(asr_segments)
    normalized_targets = [normalize_text(item['voiceover']) for item in project_segments]
    normalized_asr = [normalize_text(item.text) for item in asr_segments]

    @lru_cache(maxsize=None)
    def group_text(start: int, end: int):
        return ''.join(normalized_asr[start:end])

    @lru_cache(maxsize=None)
    def score_group(start: int, end: int, target_index: int):
        target = normalized_targets[target_index]
        if start == end:
            return 0.0 if not target else -0.8

        chunk = group_text(start, end)
        if not chunk:
            return -0.8

        ratio = SequenceMatcher(None, chunk, target).ratio()
        length_penalty = abs(len(chunk) - len(target)) / max(len(target), 1)
        return ratio - length_penalty * 0.18

    dp = [[-10**9 for _ in range(m + 1)] for _ in range(n + 1)]
    prev = [[0 for _ in range(m + 1)] for _ in range(n + 1)]
    dp[0][0] = 0.0

    for i in range(1, n + 1):
        for j in range(0, m + 1):
            best_score = -10**9
            best_prev = 0
            for k in range(0, j + 1):
                candidate = dp[i - 1][k] + score_group(k, j, i - 1)
                if candidate > best_score:
                    best_score = candidate
                    best_prev = k
            dp[i][j] = best_score
            prev[i][j] = best_prev

    boundaries: list[tuple[int, int]] = []
    cursor = m
    for i in range(n, 0, -1):
        start = prev[i][cursor]
        boundaries.append((start, cursor))
        cursor = start
    boundaries.reverse()
    return boundaries


def build_output(project_segments, asr_segments: list[AsrSegment], boundaries, fps: int, detected_language: str | None, audio_duration: float):
    results = []

    if not asr_segments:
        total_chars = sum(max(len(normalize_text(item['voiceover'])), 1) for item in project_segments)
        cursor = 0.0
        for item in project_segments:
            ratio = max(len(normalize_text(item['voiceover'])), 1) / max(total_chars, 1)
            duration_sec = audio_duration * ratio if audio_duration > 0 else 1.0
            start_sec = cursor
            end_sec = cursor + duration_sec
            cursor = end_sec
            results.append(
                {
                    'id': item['id'],
                    'label': item['label'],
                    'start_sec': round(start_sec, 3),
                    'end_sec': round(end_sec, 3),
                    'duration_sec': round(duration_sec, 3),
                    'duration_frames': seconds_to_frames(duration_sec, fps),
                    'cue_points_sec': [],
                    'recognized_text': '',
                }
            )
        return {
            'segments': results,
            'detected_language': detected_language,
            'audio_duration_sec': round(audio_duration, 3),
        }

    for item, (start_index, end_index) in zip(project_segments, boundaries):
        grouped = asr_segments[start_index:end_index]
        if grouped:
            start_sec = grouped[0].start
            end_sec = grouped[-1].end
            duration_sec = max(0.1, end_sec - start_sec)
            cue_points = []

            grouped_words = []
            for grouped_segment in grouped:
                grouped_words.extend(grouped_segment.words)

            if grouped_words:
                for prev_word, next_word in zip(grouped_words, grouped_words[1:]):
                    gap = float(next_word['start']) - float(prev_word['end'])
                    rel = round(float(next_word['start']) - start_sec, 3)
                    if gap >= 0.28 and rel > 0.12:
                        cue_points.append(rel)

            if not cue_points:
                for cue in grouped[1:]:
                    rel = round(cue.start - start_sec, 3)
                    if rel > 0.12:
                        cue_points.append(rel)

            recognized_text = ' '.join(segment.text.strip() for segment in grouped).strip()
            if not cue_points:
                cue_points = infer_punctuation_cues(recognized_text, duration_sec)

            deduped_cues = []
            for cue in cue_points:
                if not deduped_cues or cue - deduped_cues[-1] >= 0.35:
                    deduped_cues.append(cue)
        else:
            start_sec = 0.0
            end_sec = 0.0
            duration_sec = 0.1
            deduped_cues = []
            recognized_text = ''

        results.append(
            {
                'id': item['id'],
                'label': item['label'],
                'start_sec': round(start_sec, 3),
                'end_sec': round(end_sec, 3),
                'duration_sec': round(duration_sec, 3),
                'duration_frames': seconds_to_frames(duration_sec, fps),
                'cue_points_sec': deduped_cues,
                'recognized_text': recognized_text,
            }
        )

    return {
        'segments': results,
        'detected_language': detected_language,
        'audio_duration_sec': round(audio_duration, 3),
    }


def main():
    ensure_utf8_stdio()
    parser = argparse.ArgumentParser(description='用本地 faster-whisper 对齐口播音频与项目段落时长')
    parser.add_argument('--audio', required=True, help='音频或视频文件路径')
    parser.add_argument('--project', required=True, help='项目 JSON 路径')
    parser.add_argument('--output', required=True, help='对齐结果 JSON 输出路径')
    parser.add_argument('--model', default='large-v3-turbo', help='faster-whisper 模型大小，默认 large-v3-turbo')
    parser.add_argument('--language', default='zh', help='语言提示，默认 zh')
    parser.add_argument('--device', default='auto', help='运行设备，默认 auto')
    parser.add_argument('--compute-type', default='auto', help='计算精度，默认 auto')
    args = parser.parse_args()

    audio_path = Path(args.audio)
    project_path = Path(args.project)
    output_path = Path(args.output)

    fps, project_segments = read_project(project_path)
    asr_segments, detected_language, audio_duration, resolved_device, resolved_compute_type = transcribe_audio(
        audio_path=audio_path,
        model_name=args.model,
        language=args.language,
        device=args.device,
        compute_type=args.compute_type,
    )
    boundaries = align_segments(project_segments, asr_segments) if project_segments else []
    result = build_output(project_segments, asr_segments, boundaries, fps, detected_language, audio_duration)
    result['runtime'] = {
        'model': args.model,
        'device': resolved_device,
        'compute_type': resolved_compute_type,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(
        json.dumps(
            {
                'segments': [
                    {
                        'id': segment.get('id'),
                        'duration_sec': segment.get('duration_sec'),
                        'duration_frames': segment.get('duration_frames'),
                        'cue_point_count': len(segment.get('cue_points_sec') or []),
                    }
                    for segment in result.get('segments', [])
                ],
                'audio_duration_sec': result.get('audio_duration_sec'),
                'runtime': result.get('runtime'),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == '__main__':
    main()
