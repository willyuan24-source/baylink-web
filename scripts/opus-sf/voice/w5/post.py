"""
Lane V (W5-V7): post-process wave 5's BAYBAY line takes (scripts/opus-sf/voice/w5/lines.ts), pick one per clip, publish.

  python scripts/opus-sf/voice/w5/post.py --work C:/Users/willy/opus-qa/w5/w5-v/voice --repo C:/Users/willy/wt/w5-v [--retakes]
      --retakes   only print the clips whose best take misses a gate or the recogniser (the next round's list)

Batches add up: the clips already in the committed report keep their pick and their files byte for byte; a batch only
adds clips (lines.ts --takes lists only the lines the table does not have). Same measured chain as wave 3 / 4
(scripts/opus-sf/voice/voice_post.py): trim at −40 dB (20 / 80 ms kept), 5 / 30 ms fades, two-pass loudnorm −18 LUFS /
TP −1.5, AAC 64k .m4a + Opus 48k .ogg mono, the Windows closed-grammar recogniser as an advisory check. These are bubble
sentences (0.5–6 s), so the gates are wave 4's sentence gates: no clipped samples, not cut at the end, the longest pause
≤ 0.9 s (1.2 s where the text has …, ——, ；or ：), median F0 170–460 Hz (Pixie ≈ 270 Hz), a speaking rate that proves
nothing was dropped or repeated (zh 2.4–7.5 characters / s, en 1.4–4.6 words / s; numbers counted as read).
Reads   <work>/takes.json (lines.ts --takes), <work>/jobs*.txt ("index job_id"; later files replace earlier ones),
        <work>/raw/<index>.wav
Writes  <repo>/public/opus-bay/w5/voice/<clip>.m4a | .ogg             the picks
        <repo>/docs/opus-bay/qa/w5/V/voice/w5-voice-report.json      measurements, gates, picks, files (every batch)
        <repo>/docs/opus-bay/qa/w5/V/voice/w5-voice-preview-b<n>-{zh,en}.m4a   the batch's picks in one file (the owner's ear)
        <repo>/docs/opus-bay/qa/w5/V/voice/listening.md              the listening sheet (every clip, by batch)
        <repo>/src/opus-bay/data/sf/voiceW5.ts                       the clip table (generated)
"""
import argparse, glob, hashlib, json, os, re, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from voice_post import SR, analyse, asr, encode, fade, ffmpeg, load, loudnorm, plain, save  # noqa: E402


def speakable(s):
    """the recogniser's phrase for a line: plain() minus quotes, brackets and the separators a command line cannot carry
    (a `"` inside the -choices argument broke the whole grammar: every zh take came back unrecognised)"""
    s = plain(s).replace('\u2019', "'").replace('\u2018', "'")
    s = re.sub(r"(?<![A-Za-z])'|'(?![A-Za-z])", ' ', s)  # an apostrophe inside a word stays (you're), a quote goes
    return re.sub(r'\s+', ' ', re.sub('[\u201c\u201d"\u300c\u300d\u300e\u300f\uff08\uff09()\u00b7\uff1a:\uff1b;\u3001\u2014\u2013]', ' ', s)).strip()


def spoken_numbers(text, lang):
    """units a number is read as: a year "1776" = 4 (一七七六) / 3 (seventeen seventy-six), else about its digits"""
    n = 0
    for d in re.findall(r'\d+(?:\.\d+)?', text):
        digits = len(d.replace('.', ''))
        n += (4 if digits == 4 else digits + 1) if lang == 'zh' else (3 if digits == 4 else max(1, (digits + 1) // 2 + 1))
    return n


def rate(text, lang, secs):
    if lang == 'zh':
        n = len(re.findall(r'[\u4e00-\u9fff]', text)) + 0.6 * len(re.findall(r'[A-Za-z]+', text)) + spoken_numbers(text, lang)
        return n / secs, (2.4, 7.5)
    n = len(re.findall(r"[A-Za-z'\u2019&]+", text)) + spoken_numbers(text, lang)
    return n / secs, (1.4, 4.6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--repo', required=True)
    ap.add_argument('--retakes', action='store_true')
    a = ap.parse_args()
    W, R = a.work, a.repo
    tk = json.load(open(f'{W}/takes.json', encoding='utf-8'))
    takes, lines, batch = tk['takes'], {l['id']: l for l in tk['lines']}, tk.get('batch', 1)
    jobs = {}
    for f in sorted(glob.glob(f'{W}/jobs*.txt')):
        jobs.update(dict(l.split()[:2] for l in open(f) if l.strip()))
    for d in ['norm', 'asr', 'listen']:
        os.makedirs(f'{W}/{d}', exist_ok=True)
    out_dir = f'{R}/public/opus-bay/w5/voice'
    qa_dir = f'{R}/docs/opus-bay/qa/w5/V/voice'
    os.makedirs(out_dir, exist_ok=True); os.makedirs(qa_dir, exist_ok=True)
    report_path = f'{qa_dir}/w5-voice-report.json'
    old = json.load(open(report_path, encoding='utf-8')) if os.path.exists(report_path) else {'clips': {}, 'lines': {}}

    cache_path = f'{W}/measure-cache.json'
    cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
    rows = []
    for t in takes:
        i = t['index']
        if t['clip'] in old['clips'] or not os.path.exists(f'{W}/raw/{i}.wav'):
            continue
        t = {**t, 'job_id': jobs.get(str(i))}
        x = load(f'{W}/raw/{i}.wav')
        m = analyse(x)
        tag = f"{t['clip']}-{i}"
        norm = f'{W}/norm/{tag}.wav'
        key = f"{tag}:{os.path.getsize(f'{W}/raw/{i}.wav')}"
        if key in cache and os.path.exists(norm):
            m2, final_s = cache[key]['m2'], cache[key]['final_s']
        else:
            trim = f'{W}/norm/{tag}-trim.wav'
            save(fade(x[m['start']:m['end']]), trim)
            _, m2 = loudnorm(trim, norm)
            z = load(norm)
            save(z, f'{W}/asr/{tag}.wav', sr=16000)
            ffmpeg('-y', '-i', norm, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', f'{W}/listen/{tag}.m4a')
            final_s = round(len(z) / SR, 3)
            cache[key] = {'m2': {'output_i': m2['output_i'], 'output_tp': m2['output_tp']}, 'final_s': final_s}
        r_, (lo, hi) = rate(t['text'], t['language'], max(final_s, 0.1))
        pause_ok = 1.2 if re.search('[；;:：—…]', t['text']) else 0.9
        gates = {'clip': m['clipped'] == 0, 'end': not m['cut_at_end'], 'pause': m['gap_s'] <= pause_ok,
                 'pitch': 170 <= m['f0'] <= 460, 'rate': lo <= r_ <= hi}
        rows.append({**t, **{k: v for k, v in m.items() if k not in ('start', 'end')}, 'final_s': final_s, 'rate': round(r_, 2),
                     'lufs': float(m2['output_i']), 'tp': float(m2['output_tp']), 'gates': gates, 'pass': all(gates.values()), 'tag': tag})
        print(f"{tag:34s} {final_s:5.2f}s rate {r_:4.1f} gap {m['gap_s']:.2f} f0 {m['f0']} {'PASS' if rows[-1]['pass'] else 'fail ' + ','.join(k for k, v in gates.items() if not v)}", flush=True)
    json.dump(cache, open(cache_path, 'w'))

    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'asr-choice.ps1')
    asr_path = f'{W}/asr-cache.json'
    asr_cache = json.load(open(asr_path, encoding='utf-8')) if os.path.exists(asr_path) else {}
    for lang, culture in [('zh', 'zh-CN'), ('en', 'en-US')]:
        rs = [r for r in rows if r['language'] == lang]
        # the closed grammar: every line of the language, the committed clips' too (a new clip must be told apart from them)
        choices = sorted({speakable(r['text']) for r in rs} | {speakable(e['text']) for e in old['clips'].values() if e['language'] == lang})
        todo = [r for r in rs if f"{r['tag']}.wav" not in asr_cache]
        if todo:
            asr_cache.update({k: list(v) for k, v in asr([f"{W}/asr/{r['tag']}.wav" for r in todo], culture, choices, script).items()})
            json.dump(asr_cache, open(asr_path, 'w', encoding='utf-8'), ensure_ascii=False)
        for r in rs:
            heard, conf = asr_cache.get(f"{r['tag']}.wav", ('?', 0.0))
            r['asr'], r['asr_conf'] = heard, conf
            r['asr_ok'] = heard.replace(' ', '') == speakable(r['text']).replace(' ', '')

    clips, order = {}, []
    for r in rows:
        if r['clip'] not in clips: order.append(r['clip'])
        clips.setdefault(r['clip'], []).append(r)
    best = {}
    for clip in order:
        rs = clips[clip]
        ok = sorted([r for r in rs if r['pass']], key=lambda r: (not r.get('asr_ok'), -r.get('asr_conf', 0)))
        best[clip] = ok[0] if ok else sorted(rs, key=lambda r: sum(not v for v in r['gates'].values()))[0]
    if a.retakes:
        for clip in order:
            p = best[clip]
            if not p['pass'] or not p.get('asr_ok'):
                print('RETAKE', clip, 'gates' if not p['pass'] else 'asr', ','.join(k for k, v in p['gates'].items() if not v), p.get('asr'))
        return 0

    report = {'settings': {'model': 'qwen_audio_tts', 'voice': 'Pixie 0178ef57-ada4-43d9-992b-8d9221045bb4', 'format': 'wav 48 kHz',
                           'loudness': 'two-pass loudnorm I=-18 TP=-1.5 LRA=11 (linear)', 'aac': '64k mono', 'opus': '48k mono',
                           'source': 'scripts/opus-sf/voice/w5/lines.ts (the lanes\' wave-5 BAYBAY lines)'},
              'lines': dict(old.get('lines', {})), 'clips': dict(old['clips'])}
    previews = {'zh': [], 'en': []}
    for clip in order:
        pick, rs = best[clip], clips[clip]
        base = f'{out_dir}/{clip}'
        encode(f"{W}/norm/{pick['tag']}.wav", base + '.m4a', base + '.ogg')
        line = lines[pick['line']]
        report['lines'][line['id']] = {**{k: line[k] for k in ('lane', 'zh', 'en', 'source', 'mood') if k in line}, **({'own': 1} if line.get('voiceId') else {})}
        report['clips'][clip] = {
            'text': pick['text'], 'line': pick['line'], 'lane': pick['lane'], 'language': pick['language'], 'batch': batch,
            'pick': {'index': pick['index'], 'job_id': pick['job_id'], 'speechRate': pick['speechRate'], 'duration': pick['final_s'],
                     'passed': pick['pass'], 'asr': pick.get('asr'), 'asr_conf': pick.get('asr_conf'), 'asr_ok': pick.get('asr_ok'),
                     'files': {ext: {'path': f'public/opus-bay/w5/voice/{clip}.{ext}', 'bytes': os.path.getsize(base + '.' + ext),
                                     'sha256': hashlib.sha256(open(base + '.' + ext, 'rb').read()).hexdigest()} for ext in ('m4a', 'ogg')}},
            'takes': [{k: r.get(k) for k in ('index', 'job_id', 'speechRate', 'raw_s', 'final_s', 'rate', 'lufs', 'tp', 'peak_dbfs', 'clipped',
                                             'cut_at_end', 'gap_s', 'f0', 'asr', 'asr_conf', 'asr_ok', 'gates', 'pass')} for r in rs],
        }
        previews[pick['language']].append(f"{W}/norm/{pick['tag']}.wav")

    gap = np.zeros(int(0.7 * SR), dtype=np.float32)
    for lang, files in previews.items():
        if not files: continue
        cat = np.concatenate([np.concatenate([load(f), gap]) for f in files])
        tmp = f'{W}/norm/preview-{lang}.wav'
        save(cat, tmp)
        ffmpeg('-y', '-i', tmp, '-ac', '1', '-c:a', 'aac', '-b:a', '48k', '-movflags', '+faststart', f'{qa_dir}/w5-voice-preview-b{batch}-{lang}.m4a')

    with open(report_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n "settings": ' + json.dumps(report['settings'], ensure_ascii=False) + ',\n "lines": {\n')
        f.write(',\n'.join(f'  {json.dumps(k)}: ' + json.dumps(v, ensure_ascii=False) for k, v in report['lines'].items()))
        f.write('\n },\n "clips": {\n')
        f.write(',\n'.join(f'  {json.dumps(k)}: ' + json.dumps(v, ensure_ascii=False) for k, v in report['clips'].items()))
        f.write('\n }\n}\n')

    LANE = {'a': 'A 玩法', 'c': 'C 内容', 'd': 'D 彩蛋', 'e': 'E 金币', 'n': 'N 导航', 'r': 'R 现实'}
    sheet = ['# Wave 5 · BAYBAY 新台词 · 试听单 (lane V, W5-V7)', '',
             '每一批的全部选用录音按下表顺序连在一个文件里（间隔 0.7 秒）：`w5-voice-preview-b<批次>-zh.m4a` / `-en.m4a`。',
             '不满意的在「你的判断」一栏写 ✗（这句改回只有文字气泡）或「重录」（换一条录音）。每条的备选录音在',
             '`C:/Users/willy/opus-qa/w5/w5-v/voice/listen/`。gates = 机器检查（没有爆音、没有截断、停顿和语速正常）；',
             '「识别」= Windows 语音识别在全部台词里听出的是哪一句（✓ = 听对），只作参考。', '',
             'Each batch\'s picks play in this order in `w5-voice-preview-b<n>-{zh,en}.m4a` (0.7 s apart). Mark a clip ✗ to mute it',
             '(the bubble stays text) or "retake". A clip marked "check" missed a gate and is muted until you approve it.', '']
    for lang in ('zh', 'en'):
        sheet += [f'## {lang}', '', '| # | 批次 | 线 | clip | text | s | gates | 识别 | 你的判断 |', '|---|---|---|---|---|---|---|---|---|']
        n = 0
        for clip, e in sorted(report['clips'].items(), key=lambda kv: kv[1].get('batch', 1)):
            if e['language'] != lang: continue
            n += 1
            p = e['pick']
            heard = '✓' if p['asr_ok'] else (p['asr'] or '—')
            sheet.append(f"| {n} | {e.get('batch', 1)} | {LANE.get(e['lane'], e['lane'])} | `{clip}` | {e['text']} | {p['duration']:.2f} | {'pass' if p['passed'] else 'check'} | {heard} ({p['asr_conf'] or 0:.2f}) | |")
        sheet.append('')
    open(f'{qa_dir}/listening.md', 'w', encoding='utf-8', newline='\n').write('\n'.join(sheet))

    # the generated table: one row per line (both languages), the check list, registered on import
    ts = ['/**',
          ' * GENERATED by scripts/opus-sf/voice/w5/post.py — do not edit by hand.',
          ' * BAYBAY\'s recorded wave-5 lines (lane V, W5-V7): the lanes\' fixed bubble lines (scripts/opus-sf/voice/w5/lines.ts),',
          ' * zh + en, qwen_audio_tts preset "Pixie", trimmed, two-pass loudnorm −18 LUFS / TP −1.5, AAC 64k .m4a + Opus 48k .ogg.',
          ' * Clip id `<lang>-<id>`; `own`: the lane emits `voice-line` with this id itself (game/voiceW5.ts leaves it alone).',
          ' * Measurements, picks and the owner\'s listening sheet: docs/opus-bay/qa/w5/V/voice/. Registered in ASSETS.voice on',
          ' * import (the city chunk imports it through game/voiceW5.ts); the W5_VOICE_CHECK clips stay unregistered (text only).',
          ' */',
          "import { type VoiceClip, registerVoiceClips } from '../assets';", '',
          'export interface W5VoiceLine { id: string; lane: string; zh: string; en: string; /** seconds: zh, en */ s: readonly [number, number]; own?: 1 }', '',
          'export const W5_VOICE_LINES: readonly W5VoiceLine[] = [']
    for lid, ln in report['lines'].items():
        dz = report['clips'].get(f'zh-{lid}', {}).get('pick', {}).get('duration', 0)
        de = report['clips'].get(f'en-{lid}', {}).get('pick', {}).get('duration', 0)
        own = ', own: 1' if ln.get('own') else ''
        ts.append(f"  {{ id: {json.dumps(lid)}, lane: {json.dumps(ln['lane'])}, zh: {json.dumps(ln['zh'], ensure_ascii=False)}, en: {json.dumps(ln['en'], ensure_ascii=False)}, s: [{dz}, {de}]{own} }},")
    check = [c for c, e in report['clips'].items() if not e['pick']['passed']]
    ts += ['];', '',
           '/** clips whose pick missed a gate (the listening sheet says "check"): muted until the owner approves them */',
           'export const W5_VOICE_CHECK: readonly string[] = [' + ', '.join(json.dumps(c) for c in check) + '];', '',
           "const DIR = '/opus-bay/w5/voice';",
           'export const W5_VOICE_CLIPS: Record<string, VoiceClip> = Object.fromEntries(W5_VOICE_LINES.flatMap(l => ([\'zh\', \'en\'] as const).map((lang, k): [string, VoiceClip] => [',
           '  `${lang}-${l.id}`, { m4a: `${DIR}/${lang}-${l.id}.m4a`, ogg: `${DIR}/${lang}-${l.id}.ogg`, lang, text: l[lang], duration: l.s[k] },',
           '])));', '',
           'registerVoiceClips(W5_VOICE_CLIPS, W5_VOICE_CHECK);', '']
    open(f'{R}/src/opus-bay/data/sf/voiceW5.ts', 'w', encoding='utf-8', newline='\n').write('\n'.join(ts))
    npass = sum(1 for e in report['clips'].values() if e['pick']['passed'])
    nasr = sum(1 for e in report['clips'].values() if e['pick']['asr_ok'])
    print(f'clips {len(report["clips"])}  passed {npass}  recogniser right {nasr}  (this batch: {len(order)})')


if __name__ == '__main__':
    sys.exit(main())
