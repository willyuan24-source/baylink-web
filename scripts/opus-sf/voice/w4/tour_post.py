"""
Lane V (W4-V6): post-process the tour narration takes (lane C's frozen TOUR_LINES) and pick one per clip.

  python scripts/opus-sf/voice/w4/tour_post.py --work C:/Users/willy/opus-qa/w4/w4-v/voice --repo C:/Users/willy/wt/w4-v

Reuses wave 3's measured chain (scripts/opus-sf/voice/voice_post.py: trim at −40 dB with 20 / 80 ms kept, 5 / 30 ms fades,
two-pass loudnorm to −18 LUFS / TP −1.5, AAC 64k + Opus 48k mono, the Windows closed-grammar recogniser as an advisory
check). The narration lines are sentences, not ≤ 2 s barks, so the gates differ: no clipped samples, not cut at the end,
the longest pause ≤ 0.9 s (1.2 s where the text has ；/;/:/—), median F0 170–460 Hz (Pixie ≈ 270 Hz), and a speaking rate
that proves nothing was dropped or repeated (zh 2.4–7.5 characters / s, en 1.4–4.6 words / s). No tempo change.
Reads   <work>/takes.json (scripts/opus-sf/voice/w4/takes.ts), <work>/jobs.txt + jobs_retry.txt + jobs_r2.txt (index job_id;
        a retry replaces a failed job; r2 = the rate-1.08 retakes of the clips that missed a gate or the recogniser),
        <work>/raw/<index>.wav
Writes  <repo>/public/opus-bay/voice/sf/tour/<clip>.m4a | .ogg              the picks
        <repo>/docs/opus-bay/qa/w4/V/voice/tour-voice-report.json           measurements, gates, picks, files
        <repo>/docs/opus-bay/qa/w4/V/voice/tour-voice-preview-{zh,en}.m4a   every pick in one file (the owner's ear)
        <repo>/docs/opus-bay/qa/w4/V/voice/listening.md                     the listening sheet
        <repo>/src/opus-bay/data/sf/voiceTour.ts                            the clip table (generated)
"""
import argparse, hashlib, json, os, re, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from voice_post import SR, analyse, asr, encode, fade, ffmpeg, load, loudnorm, plain, save  # noqa: E402


def spoken_numbers(text, lang):
    """units a number is read as: a year "1776" = 4 (一七七六) / 3 (seventeen seventy-six), else about its digits"""
    n = 0
    for d in re.findall(r'\d+(?:\.\d+)?', text):
        digits = len(d.replace('.', ''))
        n += (4 if digits == 4 else digits + 1) if lang == 'zh' else (3 if digits == 4 else max(1, (digits + 1) // 2 + 1))
    return n


def rate(text, lang, secs):
    """speaking rate: zh CJK characters (+ Latin words x 0.6, numbers as read) per s; en words (numbers as read) per s"""
    if lang == 'zh':
        n = len(re.findall(r'[\u4e00-\u9fff]', text)) + 0.6 * len(re.findall(r'[A-Za-z]+', text)) + spoken_numbers(text, lang)
        return n / secs, (2.4, 7.5)
    n = len(re.findall(r"[A-Za-z'\u2019&]+", text)) + spoken_numbers(text, lang)
    return n / secs, (1.4, 4.6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--repo', required=True)
    a = ap.parse_args()
    W, R = a.work, a.repo
    takes = json.load(open(f'{W}/takes.json', encoding='utf-8'))['takes']
    jobs = dict(l.split()[:2] for l in open(f'{W}/jobs.txt') if l.strip())
    for extra in ('jobs_retry.txt', 'jobs_r2.txt'):  # resubmissions of failed jobs, then the rate-1.08 retakes
        if os.path.exists(f'{W}/{extra}'):
            jobs.update(dict(l.split()[:2] for l in open(f'{W}/{extra}') if l.strip()))
    for d in ['norm', 'asr', 'listen']:
        os.makedirs(f'{W}/{d}', exist_ok=True)
    out_dir = f'{R}/public/opus-bay/voice/sf/tour'
    qa_dir = f'{R}/docs/opus-bay/qa/w4/V/voice'
    os.makedirs(out_dir, exist_ok=True); os.makedirs(qa_dir, exist_ok=True)

    cache_path = f'{W}/measure-cache.json'
    cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
    rows = []
    for t in takes:
        i = t['index']
        if not os.path.exists(f'{W}/raw/{i}.wav'):
            continue
        t = {**t, 'job_id': jobs.get(str(i))}
        x = load(f'{W}/raw/{i}.wav')
        m = analyse(x)
        y = fade(x[m['start']:m['end']])
        tag = f"{t['clip']}-{i}"
        norm = f'{W}/norm/{tag}.wav'
        key = f"{tag}:{os.path.getsize(f'{W}/raw/{i}.wav')}"
        if key in cache and os.path.exists(norm):  # measured before from the same raw file: reuse the loudness numbers
            m2, final_s = cache[key]['m2'], cache[key]['final_s']
        else:
            trim = f'{W}/norm/{tag}-trim.wav'
            save(y, trim)
            _, m2 = loudnorm(trim, norm)
            z = load(norm)
            save(z, f'{W}/asr/{tag}.wav', sr=16000)
            ffmpeg('-y', '-i', norm, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', f'{W}/listen/{tag}.m4a')
            final_s = round(len(z) / SR, 3)
            cache[key] = {'m2': {'output_i': m2['output_i'], 'output_tp': m2['output_tp']}, 'final_s': final_s}
        r_, (lo, hi) = rate(t['text'], t['language'], max(final_s, 0.1))
        pause_ok = 1.2 if re.search('[；;:：—]', t['text']) else 0.9
        gates = {'clip': m['clipped'] == 0, 'end': not m['cut_at_end'], 'pause': m['gap_s'] <= pause_ok,
                 'pitch': 170 <= m['f0'] <= 460, 'rate': lo <= r_ <= hi}
        rows.append({**t, **{k: v for k, v in m.items() if k not in ('start', 'end')}, 'final_s': final_s, 'rate': round(r_, 2),
                     'lufs': float(m2['output_i']), 'tp': float(m2['output_tp']), 'gates': gates, 'pass': all(gates.values()), 'tag': tag})
        print(f"{tag:44s} {final_s:5.2f}s rate {r_:4.1f} gap {m['gap_s']:.2f} f0 {m['f0']} {'PASS' if rows[-1]['pass'] else 'fail ' + ','.join(k for k, v in gates.items() if not v)}", flush=True)

    json.dump(cache, open(cache_path, 'w'))
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'asr-choice.ps1')
    asr_path = f'{W}/asr-cache.json'  # the recogniser's answers per take (it is the slow step)
    asr_cache = json.load(open(asr_path, encoding='utf-8')) if os.path.exists(asr_path) else {}
    for lang, culture in [('zh', 'zh-CN'), ('en', 'en-US')]:
        rs = [r for r in rows if r['language'] == lang]
        choices = sorted({plain(r['text']) for r in rs})
        todo = [r for r in rs if f"{r['tag']}.wav" not in asr_cache]
        if todo:
            asr_cache.update({k: list(v) for k, v in asr([f"{W}/asr/{r['tag']}.wav" for r in todo], culture, choices, script).items()})
            json.dump(asr_cache, open(asr_path, 'w', encoding='utf-8'), ensure_ascii=False)
        for r in rs:
            heard, conf = asr_cache.get(f"{r['tag']}.wav", ('?', 0.0))
            r['asr'], r['asr_conf'] = heard, conf
            r['asr_ok'] = heard.replace(' ', '') == plain(r['text']).replace(' ', '')

    clips, order = {}, []
    for r in rows:
        if r['clip'] not in clips: order.append(r['clip'])
        clips.setdefault(r['clip'], []).append(r)
    report = {'settings': {'model': 'qwen_audio_tts', 'voice': 'Pixie 0178ef57-ada4-43d9-992b-8d9221045bb4', 'format': 'wav 48 kHz',
                           'loudness': 'two-pass loudnorm I=-18 TP=-1.5 LRA=11 (linear)', 'aac': '64k mono', 'opus': '48k mono',
                           'source': 'src/opus-bay/data/sf/tourLines.ts TOUR_LINES (frozen 2026-09-27)'}, 'clips': {}}
    previews = {'zh': [], 'en': []}
    for clip in order:
        rs = clips[clip]
        ok = sorted([r for r in rs if r['pass']], key=lambda r: (not r.get('asr_ok'), -r.get('asr_conf', 0)))
        pick = ok[0] if ok else sorted(rs, key=lambda r: sum(not v for v in r['gates'].values()))[0]
        base = f'{out_dir}/{clip}'
        encode(f"{W}/norm/{pick['tag']}.wav", base + '.m4a', base + '.ogg')
        report['clips'][clip] = {
            'text': pick['text'], 'line': pick['line'], 'language': pick['language'],
            'pick': {'index': pick['index'], 'job_id': pick['job_id'], 'speechRate': pick['speechRate'], 'duration': pick['final_s'],
                     'passed': pick['pass'], 'asr': pick.get('asr'), 'asr_conf': pick.get('asr_conf'), 'asr_ok': pick.get('asr_ok'),
                     'files': {ext: {'path': f'public/opus-bay/voice/sf/tour/{clip}.{ext}', 'bytes': os.path.getsize(base + '.' + ext),
                                     'sha256': hashlib.sha256(open(base + '.' + ext, 'rb').read()).hexdigest()} for ext in ('m4a', 'ogg')}},
            'takes': [{k: r.get(k) for k in ('index', 'job_id', 'speechRate', 'raw_s', 'final_s', 'rate', 'lufs', 'tp', 'peak_dbfs', 'clipped',
                                             'cut_at_end', 'gap_s', 'f0', 'asr', 'asr_conf', 'asr_ok', 'gates', 'pass')} for r in rs],
        }
        previews[pick['language']].append(f"{W}/norm/{pick['tag']}.wav")

    gap = np.zeros(int(0.7 * SR), dtype=np.float32)
    for lang, files in previews.items():
        cat = np.concatenate([np.concatenate([load(f), gap]) for f in files])
        tmp = f'{W}/norm/preview-{lang}.wav'
        save(cat, tmp)
        ffmpeg('-y', '-i', tmp, '-ac', '1', '-c:a', 'aac', '-b:a', '48k', '-movflags', '+faststart', f'{qa_dir}/tour-voice-preview-{lang}.m4a')

    with open(f'{qa_dir}/tour-voice-report.json', 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n "settings": ' + json.dumps(report['settings'], ensure_ascii=False) + ',\n "clips": {\n')
        items = list(report['clips'].items())
        f.write(',\n'.join(f'  {json.dumps(k)}: ' + json.dumps(v, ensure_ascii=False) for k, v in items))
        f.write('\n }\n}\n')

    # the listening sheet: preview order, text, seconds, what the recogniser heard, an empty verdict column
    lines = ['# Tour narration · listening sheet (lane V, W4-V6)', '',
             'Play `tour-voice-preview-zh.m4a` / `tour-voice-preview-en.m4a` (every pick in this order, 0.7 s apart). Mark a clip',
             '"✗" to mute it (it falls back to the text bubble + chirp) or "retake" for another take. Alternates of every clip: the',
             'scratch folder `C:/Users/willy/opus-qa/w4/w4-v/voice/listen/`.', '']
    for lang in ('zh', 'en'):
        lines += [f'## {lang}', '', '| # | clip | text | s | gates | recogniser | 你的判断 |', '|---|---|---|---|---|---|---|']
        n = 0
        for clip, e in report['clips'].items():
            if e['language'] != lang: continue
            n += 1
            p = e['pick']
            heard = '✓' if p['asr_ok'] else (p['asr'] or '—')
            lines.append(f"| {n} | `{clip}` | {e['text']} | {p['duration']:.2f} | {'pass' if p['passed'] else 'check'} | {heard} ({p['asr_conf'] or 0:.2f}) | |")
        lines.append('')
    open(f'{qa_dir}/listening.md', 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))

    # the generated clip table (integration: spread TOUR_VOICE_CLIPS into SF_VOICE_CLIPS)
    ts = ['/**',
          ' * GENERATED by scripts/opus-sf/voice/w4/tour_post.py — do not edit by hand.',
          ' * BAYBAY\'s recorded tour narration (lane V, W4-V6): every line of lane C\'s frozen TOUR_LINES (data/sf/tourLines.ts),',
          ' * zh + en, qwen_audio_tts preset "Pixie", trimmed, two-pass loudnorm −18 LUFS / TP −1.5, AAC 64k .m4a + Opus 48k .ogg.',
          ' * Clip id `<lang>-<line id>` like the wave-3 city lines. Measurements and picks: docs/opus-bay/qa/w4/V/voice/.',
          ' * Not registered yet (early phase): at integration spread TOUR_VOICE_CLIPS into data/voiceLinesSf.ts SF_VOICE_CLIPS.',
          ' */',
          "import type { VoiceClip } from '../assets';", '',
          "const DIR = '/opus-bay/voice/sf/tour';",
          "const clip = (id: string, text: string, duration: number): VoiceClip => ({ m4a: `${DIR}/${id}.m4a`, ogg: `${DIR}/${id}.ogg`, lang: id.startsWith('en-') ? 'en' : 'zh', text, duration });", '',
          'export const TOUR_VOICE_CLIPS: Record<string, VoiceClip> = {']
    for clip, e in report['clips'].items():
        ts.append(f"  {json.dumps(clip)}: clip({json.dumps(clip)}, {json.dumps(e['text'], ensure_ascii=False)}, {e['pick']['duration']}),")
    ts += ['};', '',
           '/** clips whose take did not pass every gate (the listening sheet marks them "check"): muted until the owner approves */',
           'export const TOUR_VOICE_CHECK: readonly string[] = [' + ', '.join(json.dumps(c) for c, e in report['clips'].items() if not e['pick']['passed']) + '];', '']
    open(f'{R}/src/opus-bay/data/sf/voiceTour.ts', 'w', encoding='utf-8', newline='\n').write('\n'.join(ts))
    npass = sum(1 for e in report['clips'].values() if e['pick']['passed'])
    nasr = sum(1 for e in report['clips'].values() if e['pick']['asr_ok'])
    print(f'clips {len(report["clips"])}  passed {npass}  recogniser right {nasr}')


if __name__ == '__main__':
    sys.exit(main())
