import argparse
import json
import subprocess
import sys
from pathlib import Path

from align_voiceover import align_segments, build_output, load_whisper_model, transcribe_with_model


def ensure_utf8_stdio():
    for stream_name in ('stdout', 'stderr'):
        stream = getattr(sys, stream_name, None)
        if stream and hasattr(stream, 'reconfigure'):
            try:
                stream.reconfigure(encoding='utf-8', errors='replace')
            except Exception:
                pass


def log(message: str, details=None):
    print(f'[align_voiceover_batch] {message}', flush=True)
    if details is not None:
        print(json.dumps(details, ensure_ascii=False, indent=2), flush=True)


def summarize_segment(segment: dict):
    cue_points = segment.get('cue_points_sec') or []
    return {
        'id': segment.get('id'),
        'label': segment.get('label'),
        'duration_sec': segment.get('duration_sec'),
        'duration_frames': segment.get('duration_frames'),
        'cue_point_count': len(cue_points),
    }


def probe_audio(audio_path: Path):
    try:
        result = subprocess.run(
            [
                'ffprobe',
                '-v',
                'error',
                '-show_entries',
                'format=duration:stream=codec_name,sample_rate,channels',
                '-of',
                'json',
                str(audio_path),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout or '{}')
    except Exception as error:
        return {'probe_error': str(error), 'file_path': str(audio_path)}


def read_batch(batch_path: Path):
    payload = json.loads(batch_path.read_text(encoding='utf-8-sig'))
    meta = payload.get('meta', {})
    runtime = payload.get('runtime', {})
    fps = int(meta.get('fps', 30))
    items = []
    for index, item in enumerate(payload.get('items', [])):
        voiceover = item.get('voiceoverText') or item.get('voiceover_text') or ''
        items.append(
            {
                'index': index,
                'id': item.get('id', f'segment-{index + 1}'),
                'label': item.get('label') or item.get('name') or f'段落 {index + 1}',
                'voiceover': str(voiceover),
                'file_path': str(item.get('file_path') or item.get('filePath') or ''),
            }
        )

    return fps, runtime, items


def main():
    ensure_utf8_stdio()
    parser = argparse.ArgumentParser(description='批量用单个 GPU 模型进程对齐多个分段口播')
    parser.add_argument('--batch', required=True, help='批量任务 JSON 路径')
    parser.add_argument('--output', required=True, help='批量对齐结果 JSON 输出路径')
    parser.add_argument('--model', default='large-v3-turbo', help='faster-whisper 模型大小，默认 large-v3-turbo')
    parser.add_argument('--language', default='zh', help='语言提示，默认 zh')
    parser.add_argument('--device', default='cuda', help='运行设备，默认 cuda')
    parser.add_argument('--compute-type', default='float16', help='计算精度，默认 float16')
    args = parser.parse_args()

    batch_path = Path(args.batch)
    output_path = Path(args.output)

    fps, runtime, items = read_batch(batch_path)
    model_name = str(runtime.get('model') or args.model)
    language = str(runtime.get('language') or args.language)
    device = str(runtime.get('device') or args.device)
    compute_type = str(runtime.get('compute_type') or runtime.get('computeType') or args.compute_type)

    log('批量任务启动', {
        'batch_path': str(batch_path),
        'output_path': str(output_path),
        'item_count': len(items),
        'model': model_name,
        'language': language,
        'device': device,
        'compute_type': compute_type,
    })
    log('开始加载模型')
    model, resolved_device, resolved_compute_type = load_whisper_model(model_name, device, compute_type)
    log('模型加载完成', {
        'resolved_device': resolved_device,
        'resolved_compute_type': resolved_compute_type,
    })

    results = []
    detected_language = None
    total_audio_duration = 0.0

    for item in items:
        audio_path = Path(item['file_path'])
        log('准备处理文件', {
            'segment_id': item['id'],
            'label': item['label'],
            'file_path': str(audio_path),
            'exists': audio_path.exists(),
        })
        log('音频探测信息', probe_audio(audio_path))
        project_segments = [
            {
                'index': 0,
                'id': item['id'],
                'label': item['label'],
                'voiceover': item['voiceover'],
            }
        ]
        log('开始转写', {'segment_id': item['id'], 'file_path': str(audio_path)})
        asr_segments, detected_language, audio_duration = transcribe_with_model(model, audio_path, language)
        log('转写完成', {
            'segment_id': item['id'],
            'asr_segment_count': len(asr_segments),
            'audio_duration': audio_duration,
            'detected_language': detected_language,
        })
        boundaries = align_segments(project_segments, asr_segments) if project_segments else []
        output = build_output(project_segments, asr_segments, boundaries, fps, detected_language, audio_duration)
        if output['segments']:
            results.append(output['segments'][0])
            log('对齐完成', summarize_segment(output['segments'][0]))
        total_audio_duration += float(audio_duration or 0.0)

    final_output = {
        'segments': results,
        'detected_language': detected_language,
        'audio_duration_sec': round(total_audio_duration, 3),
        'runtime': {
            'model': model_name,
            'device': resolved_device,
            'compute_type': resolved_compute_type,
        },
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(final_output, ensure_ascii=False, indent=2), encoding='utf-8')
    log('批量任务完成', {
        'segment_count': len(results),
        'audio_duration_sec': final_output['audio_duration_sec'],
        'runtime': final_output['runtime'],
        'segments': [summarize_segment(segment) for segment in results],
    })


if __name__ == '__main__':
    main()
