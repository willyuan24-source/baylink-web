"""
Lane H2b (H2b-8): post-process BAYBAY's city voice takes and pick one per clip by measurable checks.

  <venv>/python scripts/opus-sf/voice/voice_post.py --work C:/Users/willy/opus-qa/w3/h2b/voice --repo C:/Users/willy/wt/h2b

Needs numpy and ffmpeg (with libopus) on PATH; the advisory ASR runs asr-choice.ps1 (Windows System.Speech).
Reads   <work>/takes.json   the take list (scripts/opus-sf/voice/takes.ts)
        <work>/jobs.txt     "index job_id" of the completed jobs; <work>/raw/<index>.wav their results
        <work>/seeds.json   {index: seed} where a retry used another seed (optional)
Writes  <repo>/public/opus-bay/voice/sf/<clip>.m4a | .ogg     the picks (AAC 64k + Opus 48k, mono)
        <repo>/docs/opus-bay/h2b/voice-takes.json             every take with its job id (provenance)
        <repo>/docs/opus-bay/h2b/voice-report.json            measurements, gates, picks, output files
        <repo>/docs/opus-bay/h2b/voice-preview-{zh,en}.m4a    every pick in one file, for the owner's ear
        <work>/listen/<clip>-<index>.m4a                      every take, normalised (the alternates)

Per take: trim at −40 dB of the peak (10 ms RMS; 20 ms kept before, 80 ms after), 5 ms fade in / 30 ms out, two-pass
loudnorm to −18 LUFS / TP −1.5 on a padded copy (the pass-1 numbers feed a linear pass 2, then trimmed back), and at
most a 1.12× atempo when the trimmed take is a little over 2 s. Gates: final ≤ 2.0 s, no clipped samples in the raw,
speech not cut at the end of the raw, the longest pause inside ≤ 0.45 s (0.65 s where the text has "…" or "——"), median
F0 in 180–450 Hz (the Pixie voice sits near 270 Hz). Pick among the takes that pass: the recognizer found the right
phrase first, then the duration nearest the median of those takes (in 150 ms steps: no rushed or dragged reading),
then the higher recognizer confidence. `--keep-picks`: clips already picked in voice-report.json keep their take and
their files (a later round only adds clips).
"""
import argparse, hashlib, json, os, re, subprocess, sys
import numpy as np

SR = 48000
WIN = 0.01


def ffmpeg(*args, input=None):
    return subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', *args], input=input, capture_output=True, check=True)


def load(path):
    out = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(out, dtype=np.float32).copy()


def save(x, path, sr=SR):
    ffmpeg('-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-ar', str(sr), '-c:a', 'pcm_s16le', path, input=x.astype(np.float32).tobytes())


def env(x):
    n = int(WIN * SR)
    m = len(x) // n
    return np.sqrt(np.mean(x[:m * n].reshape(m, n) ** 2, axis=1)), n


def f0_median(x):
    """Median F0 of the voiced 40 ms frames (normalised autocorrelation, 120–700 Hz), or 0."""
    n, hop = int(0.04 * SR), int(0.01 * SR)
    e, _ = env(x)
    loud = e.max() * 10 ** (-25 / 20)
    lo, hi = int(SR / 700), int(SR / 120)
    f0s = []
    for s in range(0, len(x) - n, hop):
        fr = x[s:s + n]
        if np.sqrt(np.mean(fr ** 2)) < loud:
            continue
        fr = fr - fr.mean()
        ac = np.correlate(fr, fr, 'full')[n - 1:]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.5:
            f0s.append(SR / lag)
    return float(np.median(f0s)) if f0s else 0.0


def analyse(x):
    e, n = env(x)
    peak_env = float(e.max())
    thr = peak_env * 10 ** (-40 / 20)
    idx = np.where(e > thr)[0]
    first, last = int(idx[0]), int(idx[-1])
    quiet = e[first:last + 1] < peak_env * 10 ** (-35 / 20)
    gap = run = 0
    for q in quiet:
        run = run + 1 if q else 0
        gap = max(gap, run)
    return {
        'raw_s': round(len(x) / SR, 3),
        'peak_dbfs': round(20 * np.log10(max(float(np.abs(x).max()), 1e-9)), 2),
        'clipped': int(np.sum(np.abs(x) >= 0.999)),
        'start': max(0, first * n - int(0.02 * SR)),
        'end': min(len(x), (last + 1) * n + int(0.08 * SR)),
        'cut_at_end': bool(last >= len(e) - 2),
        'gap_s': round(gap * WIN, 2),
        'f0': round(f0_median(x)),
    }


def fade(x, fin=0.005, fout=0.03):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    x[:a] *= np.linspace(0, 1, a)
    x[-b:] *= np.linspace(1, 0, b) ** 1.5
    return x


def loudnorm(inp, outp):
    dur = len(load(inp)) / SR
    af1 = 'apad=pad_dur=2,loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json'
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', inp, '-af', af1, '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='ignore').stderr
    m = json.loads(r[r.rindex('{'):r.rindex('}') + 1])
    af2 = ('apad=pad_dur=2,loudnorm=I=-18:TP=-1.5:LRA=11:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:'
           'measured_thresh={input_thresh}:offset={target_offset}:linear=true:print_format=json,aresample={sr},atrim=0:{d}').format(sr=SR, d=f'{dur:.4f}', **m)
    r2 = subprocess.run(['ffmpeg', '-hide_banner', '-y', '-i', inp, '-af', af2, '-ac', '1', '-c:a', 'pcm_s16le', outp], capture_output=True, text=True, encoding='utf-8', errors='ignore').stderr
    m2 = json.loads(r2[r2.rindex('{'):r2.rindex('}') + 1])
    return m, m2


def encode(wav, m4a, ogg):
    ffmpeg('-y', '-i', wav, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', m4a)
    ffmpeg('-y', '-i', wav, '-ac', '1', '-c:a', 'libopus', '-b:a', '48k', ogg)


def plain(s):
    return re.sub(r'[！!，,…～~—。.?？]', ' ', s).replace('  ', ' ').strip()


def asr(files, culture, choices, script):
    lst = os.path.join(os.path.dirname(files[0]), f'asr-{culture}.txt')
    with open(lst, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(p.replace('/', '\\') for p in files))
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-culture', culture, '-choices', '|'.join(choices), '-list', lst],
                       capture_output=True, text=True, encoding='utf-8', errors='ignore')
    out = {}
    for line in r.stdout.splitlines():
        parts = line.split('\t')
        if len(parts) == 3:
            out[parts[0]] = (parts[1], float(parts[2] or 0))
    return out


def dump_report(report, path):
    """The report with one line per take (readable diffs, a third of the indented size)."""
    lines = ['{', ' "settings": ' + json.dumps(report['settings'], ensure_ascii=False) + ',', ' "clips": {']
    items = list(report['clips'].items())
    for n, (clip, e) in enumerate(items):
        lines.append(f'  {json.dumps(clip)}: {{')
        lines.append(f'   "text": {json.dumps(e["text"], ensure_ascii=False)},')
        if 'pick' in e:
            lines.append(f'   "pick": {json.dumps(e["pick"], ensure_ascii=False)},')
        lines.append('   "takes": [')
        lines += [f'    {json.dumps(t, ensure_ascii=False)}' + (',' if k < len(e['takes']) - 1 else '') for k, t in enumerate(e['takes'])]
        lines.append('   ]')
        lines.append('  }' + (',' if n < len(items) - 1 else ''))
    lines += [' }', '}', '']
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--repo', required=True)
    ap.add_argument('--keep-picks', action='store_true', help='clips already in voice-report.json keep their pick and files (a later round adds clips only)')
    a = ap.parse_args()
    W, R = a.work, a.repo
    prior = {}
    if a.keep_picks and os.path.exists(f'{R}/docs/opus-bay/h2b/voice-report.json'):
        prior = {k: e['pick'] for k, e in json.load(open(f'{R}/docs/opus-bay/h2b/voice-report.json', encoding='utf-8'))['clips'].items() if 'pick' in e}
    takes = json.load(open(f'{W}/takes.json', encoding='utf-8'))
    jobs = dict(l.split()[:2] for l in open(f'{W}/jobs.txt') if l.strip())
    seeds = json.load(open(f'{W}/seeds.json')) if os.path.exists(f'{W}/seeds.json') else {}
    for d in ['norm', 'asr', 'listen']:
        os.makedirs(f'{W}/{d}', exist_ok=True)
    out_dir = f'{R}/public/opus-bay/voice/sf'
    os.makedirs(out_dir, exist_ok=True)

    rows = []
    for t in takes:
        i = t['index']
        t = {**t, 'seed': int(seeds.get(str(i), t['seed'])), 'job_id': jobs[str(i)]}
        x = load(f'{W}/raw/{i}.wav')
        m = analyse(x)
        y = fade(x[m['start']:m['end']])
        tag = f"{t['clip']}-{i}"
        trim = f'{W}/norm/{tag}-trim.wav'
        save(y, trim)
        tempo = 1.0
        if len(y) / SR > 2.0:
            tempo = min(1.12, (len(y) / SR) / 1.98)
            ffmpeg('-y', '-i', trim, '-af', f'atempo={tempo:.3f}', '-ar', str(SR), '-c:a', 'pcm_s16le', f'{W}/norm/{tag}-t.wav')
            os.replace(f'{W}/norm/{tag}-t.wav', trim)
        norm = f'{W}/norm/{tag}.wav'
        _, m2 = loudnorm(trim, norm)
        z = load(norm)
        save(z, f'{W}/asr/{tag}.wav', sr=16000)
        ffmpeg('-y', '-i', norm, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', f'{W}/listen/{tag}.m4a')
        pause_ok = 0.65 if re.search('…|——', t['text']) else 0.45
        final_s = round(len(z) / SR, 3)
        gates = {
            'dur': final_s <= 2.0,
            'clip': m['clipped'] == 0,
            'end': not m['cut_at_end'],
            'pause': m['gap_s'] <= pause_ok,
            'pitch': 180 <= m['f0'] <= 450,
        }
        rows.append({**t, **{k: v for k, v in m.items() if k not in ('start', 'end')}, 'trim_s': round((m['end'] - m['start']) / SR, 3),
                     'tempo': round(tempo, 3), 'final_s': final_s, 'lufs': float(m2['output_i']), 'tp': float(m2['output_tp']),
                     'gates': gates, 'pass': all(gates.values()), 'tag': tag})
        print(f"{tag:42s} raw {m['raw_s']:.2f} final {final_s:.2f} gap {m['gap_s']:.2f} f0 {m['f0']} clip {m['clipped']} {'PASS' if rows[-1]['pass'] else 'fail ' + ','.join(k for k, v in gates.items() if not v)}", flush=True)

    # advisory ASR: a closed grammar per language (every line of the language + the known mis-hearings)
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'asr-choice.ps1')
    for lang, culture, extra in [('zh', 'zh-CN', ['讨厌', '到了', '好呀', '让我看看']), ('en', 'en-US', ['Hello there', "We're here"])]:
        rs = [r for r in rows if r['language'] == lang]
        choices = sorted({plain(r['text']) for r in rs} | set(extra))
        res = asr([f"{W}/asr/{r['tag']}.wav" for r in rs], culture, choices, script)
        for r in rs:
            heard, conf = res.get(f"{r['tag']}.wav", ('?', 0.0))
            r['asr'] = heard
            r['asr_conf'] = conf
            r['asr_ok'] = heard.replace(' ', '') == plain(r['text']).replace(' ', '')

    clips, order = {}, []
    for r in rows:
        if r['clip'] not in clips:
            order.append(r['clip'])
        clips.setdefault(r['clip'], []).append(r)
    report = {'clips': {}, 'settings': {'model': 'qwen_audio_tts', 'voice': 'Pixie 0178ef57-ada4-43d9-992b-8d9221045bb4', 'format': 'wav 48 kHz',
                                        'loudness': 'two-pass loudnorm I=-18 TP=-1.5 LRA=11 (linear)', 'aac': '64k mono', 'opus': '48k mono'}}
    previews = {'zh': [], 'en': []}
    for clip in order:
        rs = clips[clip]
        ok = [r for r in rs if r['pass']]
        med = float(np.median([r['final_s'] for r in ok])) if ok else 0
        ok.sort(key=lambda r: (not r.get('asr_ok'), round(abs(r['final_s'] - med) / 0.15), -r.get('asr_conf', 0)))
        pick = ok[0] if ok else None
        kept = prior.get(clip)
        if kept:
            pick = next((r for r in rs if r['index'] == kept['index']), pick)
        entry = {'text': rs[0]['text'], 'takes': [{k: r.get(k) for k in ('index', 'seed', 'speechRate', 'job_id', 'text', 'raw_s', 'trim_s', 'tempo', 'final_s', 'lufs', 'tp', 'peak_dbfs', 'clipped',
                                                                   'cut_at_end', 'gap_s', 'f0', 'asr', 'asr_conf', 'asr_ok', 'gates', 'pass')} for r in rs]}
        if pick:
            base = f'{out_dir}/{clip}'
            same = kept and kept['index'] == pick['index'] and all(os.path.exists(f'{base}.{ext}') and hashlib.sha256(open(f'{base}.{ext}', 'rb').read()).hexdigest() == kept['files'][ext]['sha256'] for ext in ('m4a', 'ogg'))
            if not same:
                encode(f"{W}/norm/{pick['tag']}.wav", base + '.m4a', base + '.ogg')
            entry['pick'] = {'index': pick['index'], 'text': pick['text'], 'seed': pick['seed'], 'speechRate': pick.get('speechRate'), 'job_id': pick['job_id'], 'duration': pick['final_s'],
                             'files': {ext: {'path': f'public/opus-bay/voice/sf/{clip}.{ext}', 'bytes': os.path.getsize(base + '.' + ext),
                                             'sha256': hashlib.sha256(open(base + '.' + ext, 'rb').read()).hexdigest()} for ext in ('m4a', 'ogg')},
                             'alternates': [f"{W}/listen/{r['tag']}.m4a" for r in rs if r is not pick]}
            previews[pick['language']].append(f"{W}/norm/{pick['tag']}.wav")
        report['clips'][clip] = entry
        print(f"{clip:40s} pick #{entry.get('pick', {}).get('index')} of {len(rs)} ({len(ok)} pass) {pick and pick['final_s']} s asr {pick and pick.get('asr')} {pick and pick.get('asr_conf')}")

    # one preview file per language: every pick, 0.6 s apart
    gap = np.zeros(int(0.6 * SR), dtype=np.float32)
    for lang, files in previews.items():
        if not files:
            continue
        cat = np.concatenate([np.concatenate([load(f), gap]) for f in files])
        tmp = f'{W}/norm/preview-{lang}.wav'
        save(cat, tmp)
        ffmpeg('-y', '-i', tmp, '-ac', '1', '-c:a', 'aac', '-b:a', '48k', '-movflags', '+faststart', f'{R}/docs/opus-bay/h2b/voice-preview-{lang}.m4a')

    dump_report(report, f'{R}/docs/opus-bay/h2b/voice-report.json')
    keys = ('index', 'clip', 'text', 'language', 'instruction', 'seed', 'speechRate', 'job_id')
    with open(f'{R}/docs/opus-bay/h2b/voice-takes.json', 'w', encoding='utf-8', newline='\n') as f:
        f.write('[\n' + ',\n'.join(json.dumps({k: r.get(k) for k in keys}, ensure_ascii=False) for r in rows) + '\n]\n')


if __name__ == '__main__':
    sys.exit(main())
