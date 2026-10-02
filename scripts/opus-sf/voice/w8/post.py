"""
Lane X (W8-X1): post-process wave 8's BAYBAY line takes (W5-V7's chain, unchanged; wave 7's script with wave 8's paths and
the retakes of wave 7's muted clips) (scripts/opus-sf/voice/w8/lines.ts), pick one per clip, publish.

  python scripts/opus-sf/voice/w8/post.py --work C:/Users/willy/opus-qa/w8/x/voice --repo C:/Users/willy/wt/w8-x [--retakes]

Retakes (takes.json `retake: 1`, one language of a wave-7 line whose clip is muted in W7_VOICE_CHECK): the best new take is
kept only if it passes every gate AND the recogniser hears it right; it is then published as
public/opus-bay/w8/voice/<clip> and listed in voiceW8.ts W8_RETAKE_CLIPS (registered before wave 7's table, and the binder
no longer mutes it). Otherwise the wave-7 clip stays muted.
      --retakes   only print the clips whose best take misses a gate or the recogniser (the next round's list)
      --prune     (batch 3) drop the recorded lines the game no longer says verbatim (a lane reworded a line after it was
                  recorded): their table rows and files go, the listening sheet says so

Batches add up: the clips already in the committed report keep their pick and their files byte for byte; a batch only
adds clips (lines.ts --takes lists only the lines the table does not have). Same measured chain as wave 3 / 4
(scripts/opus-sf/voice/voice_post.py): trim at −40 dB (20 / 80 ms kept), 5 / 30 ms fades, two-pass loudnorm −18 LUFS /
TP −1.5, AAC 64k .m4a + Opus 48k .ogg mono, the Windows closed-grammar recogniser as an advisory check. These are bubble
sentences (0.5–6 s), so the gates are wave 4's sentence gates: no clipped samples, not cut at the end, the longest pause
≤ 0.9 s (1.2 s where the text has …, ——, ；or ：), median F0 170–460 Hz (Pixie ≈ 270 Hz), a speaking rate that proves
nothing was dropped or repeated (zh 2.4–7.5 characters / s, en 1.4–4.6 words / s; numbers counted as read).
Reads   <work>/takes.json (lines.ts --takes), <work>/jobs*.txt ("index job_id"; later files replace earlier ones),
        <work>/raw/<index>.wav
Writes  <repo>/public/opus-bay/w8/voice/<clip>.m4a | .ogg             the picks
        <repo>/docs/opus-bay/qa/w8/X/voice/w8-voice-report.json      measurements, gates, picks, files (every batch)
        <repo>/docs/opus-bay/qa/w8/X/voice/w8-voice-preview-b<n>-{zh,en}.m4a   the batch's picks in one file (the owner's ear)
        <repo>/docs/opus-bay/qa/w8/X/voice/listening.md              the listening sheet (every clip, by batch)
        <repo>/src/opus-bay/data/sf/voiceW8.ts                       the clip table (generated)
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


def retake_better(pick, w7):
    """a retake of a muted wave-7 clip (it missed a gate): kept when it passes every gate and is heard right"""
    ok = bool((pick.get('passed', pick.get('pass'))) and pick.get('asr_ok'))
    if not ok: return False
    if w7 and w7.get('passed') and w7.get('asr_ok'): return (pick.get('asr_conf') or 0) > (w7.get('asr_conf') or 0) + 0.05
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--repo', required=True)
    ap.add_argument('--retakes', action='store_true')
    ap.add_argument('--prune', action='store_true')
    a = ap.parse_args()
    W, R = a.work, a.repo
    tk = json.load(open(f'{W}/takes.json', encoding='utf-8'))
    takes, lines, batch = tk['takes'], {l['id']: l for l in tk['lines']}, tk.get('batch', 1)
    jobs = {}
    for f in sorted(glob.glob(f'{W}/jobs*.txt')):
        jobs.update(dict(l.split()[:2] for l in open(f) if l.strip()))
    for d in ['norm', 'asr', 'listen']:
        os.makedirs(f'{W}/{d}', exist_ok=True)
    out_dir = f'{R}/public/opus-bay/w8/voice'
    qa_dir = f'{R}/docs/opus-bay/qa/w8/X/voice'
    os.makedirs(out_dir, exist_ok=True); os.makedirs(qa_dir, exist_ok=True)
    report_path = f'{qa_dir}/w8-voice-report.json'
    old = json.load(open(report_path, encoding='utf-8')) if os.path.exists(report_path) else {'clips': {}, 'lines': {}, 'retakes': {}}
    old.setdefault('retakes', {})
    w6_report = json.load(open(f'{R}/docs/opus-bay/qa/w6/X/voice/w6-voice-report.json', encoding='utf-8'))
    w7_report = json.load(open(f'{R}/docs/opus-bay/qa/w7/X/voice/w7-voice-report.json', encoding='utf-8'))

    cache_path = f'{W}/measure-cache.json'
    cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
    rows = []
    for t in takes:
        i = t['index']
        redo = set(tk.get('redo') or [])  # clips re-taken in this batch (their earlier pick missed a gate)
        if ((t['clip'] in old['retakes'] if t.get('retake') else t['clip'] in old['clips']) and t['clip'] not in redo) or not os.path.exists(f'{W}/raw/{i}.wav'):
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
        # a one- or two-word call (跑！ / Go!) has no speaking rate to speak of: it must just be short
        units = len(re.findall(r'[一-鿿]', t['text'])) if t['language'] == 'zh' else len(re.findall(r"[A-Za-z']+", t['text']))
        rate_ok = final_s <= 1.5 if units <= 2 else lo <= r_ <= hi
        gates = {'clip': m['clipped'] == 0, 'end': not m['cut_at_end'], 'pause': m['gap_s'] <= pause_ok,
                 'pitch': 170 <= m['f0'] <= 460, 'rate': rate_ok}
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
        choices = sorted({speakable(r['text']) for r in rs} | {speakable(e['text']) for e in old['clips'].values() if e['language'] == lang}
                         | {speakable(e['text']) for e in w6_report['clips'].values() if e['language'] == lang}
                         | {speakable(e['text']) for e in w7_report['clips'].values() if e['language'] == lang})
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
    is_retake = {clip: bool(clips[clip][0].get('retake')) for clip in order}
    if a.retakes:
        for clip in order:
            p = best[clip]
            if not p['pass'] or not p.get('asr_ok'):
                print('RETAKE', clip, 'gates' if not p['pass'] else 'asr', ','.join(k for k, v in p['gates'].items() if not v), p.get('asr'))
        return 0

    report = {'settings': {'model': 'qwen_audio_tts', 'voice': 'Pixie 0178ef57-ada4-43d9-992b-8d9221045bb4', 'format': 'wav 48 kHz',
                           'loudness': 'two-pass loudnorm I=-18 TP=-1.5 LRA=11 (linear)', 'aac': '64k mono', 'opus': '48k mono',
                           'source': 'scripts/opus-sf/voice/w8/lines.ts (the unrecorded BAYBAY lines of waves 5-8, retakes of wave-7 muted clips)'},
              'lines': dict(old.get('lines', {})), 'clips': dict(old['clips']), 'retakes': dict(old.get('retakes', {}))}
    previews = {'zh': [], 'en': []}
    # a retake must pass every gate and be heard right (the wave-7 take missed a gate); re-applied to earlier batches'
    # retakes (their files go if not kept)
    for clip, e in report['retakes'].items():
        keep = retake_better(e['pick'], e.get('w7', {}))
        if e.get('kept') and not keep:
            for ext in ('m4a', 'ogg'):
                if os.path.exists(f'{out_dir}/{clip}.{ext}'): os.remove(f'{out_dir}/{clip}.{ext}')
            e['pick'].pop('files', None)
            print(f'retake {clip}: not better than wave 7, wave 7 stays muted')
        e['kept'] = keep

    pruned = []
    if a.prune:
        # every source file of the game but the generated voice tables: a recorded line must be said there verbatim
        src = []
        for root, _, files in os.walk(f'{R}/src/opus-bay'):
            for fn in files:
                if fn.endswith(('.ts', '.tsx')) and not re.match(r'voiceW\d\.ts$', fn):
                    src.append(open(os.path.join(root, fn), encoding='utf-8').read())
        src = '\n'.join(src)
        said = lambda t: t in src or json.dumps(t, ensure_ascii=False)[1:-1] in src or t.replace("'", "\\'") in src
        for lid, ln in list(report['lines'].items()):
            if said(ln['zh']) and said(ln['en']): continue
            for lang in ('zh', 'en'):
                report['clips'].pop(f'{lang}-{lid}', None)
                for ext in ('m4a', 'ogg'):
                    if os.path.exists(f'{out_dir}/{lang}-{lid}.{ext}'): os.remove(f'{out_dir}/{lang}-{lid}.{ext}')
            report['lines'].pop(lid)
            pruned.append(f"{lid} {ln['zh']}")
            print('pruned (no longer said):', lid, ln['zh'])

    def fileinfo(clip, base):
        return {ext: {'path': f'public/opus-bay/w8/voice/{clip}.{ext}', 'bytes': os.path.getsize(base + '.' + ext),
                      'sha256': hashlib.sha256(open(base + '.' + ext, 'rb').read()).hexdigest()} for ext in ('m4a', 'ogg')}

    def takes_of(rs):
        return [{k: r.get(k) for k in ('index', 'job_id', 'speechRate', 'raw_s', 'final_s', 'rate', 'lufs', 'tp', 'peak_dbfs', 'clipped',
                                       'cut_at_end', 'gap_s', 'f0', 'asr', 'asr_conf', 'asr_ok', 'gates', 'pass')} for r in rs]

    for clip in order:
        pick, rs = best[clip], clips[clip]
        base = f'{out_dir}/{clip}'
        line = lines[pick['line']]
        entry = {'text': pick['text'], 'line': pick['line'], 'lane': pick['lane'], 'language': pick['language'], 'batch': batch,
                 'pick': {'index': pick['index'], 'job_id': pick['job_id'], 'speechRate': pick['speechRate'], 'duration': pick['final_s'],
                          'passed': pick['pass'], 'asr': pick.get('asr'), 'asr_conf': pick.get('asr_conf'), 'asr_ok': pick.get('asr_ok')},
                 'takes': takes_of(rs)}
        if is_retake[clip]:
            # a retake replaces the muted wave-7 clip only when it passes every gate and the recogniser hears it right
            old7 = w7_report['clips'].get(clip, {}).get('pick', {})
            entry['w7'] = {k: old7.get(k) for k in ('asr', 'asr_conf', 'asr_ok', 'duration', 'passed')}
            entry['kept'] = retake_better(pick, entry['w7'])
            if entry['kept']:
                encode(f"{W}/norm/{pick['tag']}.wav", base + '.m4a', base + '.ogg')
                entry['pick']['files'] = fileinfo(clip, base)
                previews[pick['language']].append(f"{W}/norm/{pick['tag']}.wav")
            report['retakes'][clip] = entry
            print(f"retake {clip}: {'KEPT' if entry['kept'] else 'wave 7 stays muted'} (heard {pick.get('asr')} {pick.get('asr_conf')}, {pick.get('final_s')} s)")
            continue
        encode(f"{W}/norm/{pick['tag']}.wav", base + '.m4a', base + '.ogg')
        entry['pick']['files'] = fileinfo(clip, base)
        report['lines'][line['id']] = {k: line[k] for k in ('lane', 'zh', 'en', 'source', 'mood', 'own') if k in line}
        report['clips'][clip] = entry
        previews[pick['language']].append(f"{W}/norm/{pick['tag']}.wav")

    gap = np.zeros(int(0.7 * SR), dtype=np.float32)
    for lang, files in previews.items():
        if not files: continue
        cat = np.concatenate([np.concatenate([load(f), gap]) for f in files])
        tmp = f'{W}/norm/preview-{lang}.wav'
        save(cat, tmp)
        ffmpeg('-y', '-i', tmp, '-ac', '1', '-c:a', 'aac', '-b:a', '48k', '-movflags', '+faststart', f'{qa_dir}/w8-voice-preview-b{batch}-{lang}.m4a')

    with open(report_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n "settings": ' + json.dumps(report['settings'], ensure_ascii=False) + ',\n')
        for key in ('lines', 'clips', 'retakes'):
            f.write(f' "{key}": {{\n')
            f.write(',\n'.join(f'  {json.dumps(k)}: ' + json.dumps(v, ensure_ascii=False) for k, v in report[key].items()))
            f.write('\n }' + (',' if key != 'retakes' else '') + '\n')
        f.write('}\n')

    LANE = {'g': 'G 讨糖', 'h': 'H 万圣', 'a': 'M/A 小游戏', 'd': 'D 彩蛋', 'e': 'E 小铺', 'c': 'C 引导', 'n': 'N 去哪', 'r': 'R 真实',
            'k': 'K 出行/跟车', 's': 'S 真实日子', 'al': 'A 恶魔岛', 'w1': 'W1 唐人街/码头', 'w2': 'W2 西区', 'm': 'M 小游戏'}
    sheet = ['# Wave 8 · BAYBAY 新台词与重录 · 试听单 (lane X, W8-X1)', '',
             '每一批的全部选用录音按下表顺序连在一个文件里（间隔 0.7 秒）：`w8-voice-preview-b<批次>-zh.m4a` / `-en.m4a`。',
             '不满意的在「你的判断」一栏写 ✗（这句改回只有文字气泡）或「重录」。备选录音在 `C:/Users/willy/opus-qa/w8/x/voice/listen/`。',
             'gates = 机器检查（没有爆音、没有截断、停顿和语速正常）；「识别」= Windows 语音识别在全部台词里听出的是哪一句（✓ = 听对），只作参考。',
             '「重录」一节：第七波因为语速检查没过而静音的 8 条（短句读得太慢），各用 1.15 / 1.3 倍语速录了两条；新录音通过全部检查且被听对才替换并取消静音（✓ 替换），否则仍静音。', '',
             "Each batch's picks play in this order in `w8-voice-preview-b<n>-{zh,en}.m4a` (0.7 s apart). Mark a clip ✗ to mute it",
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
    sheet += ['## 重录 · retakes of wave-7 muted clips', '', '| clip | text | 第七波 s | 新录音 s | 新录音识别 | 结果 |', '|---|---|---|---|---|---|']
    for clip, e in report['retakes'].items():
        w7 = e.get('w7', {})
        p = e['pick']
        sheet.append(f"| `{clip}` | {e['text']} | {w7.get('duration') or 0:.2f} | {p.get('duration') or 0:.2f} | {'✓' if p.get('asr_ok') else (p.get('asr') or '—')} ({p.get('asr_conf') or 0:.2f}) | {'✓ 替换' if e['kept'] else '仍静音'} |")
    sheet.append('')
    open(f'{qa_dir}/listening.md', 'w', encoding='utf-8', newline='\n').write('\n'.join(sheet))

    ts = ['/**',
          ' * GENERATED by scripts/opus-sf/voice/w8/post.py — do not edit by hand.',
          " * BAYBAY's recorded wave-8 lines (lane X, W8-X1): the fixed bubble lines no earlier table had (lane M's wave-7 games,",
          " * lane K's plain bubbles, wave 8's new lines — scripts/opus-sf/voice/w8/lines.ts), zh + en, qwen_audio_tts preset",
          ' * "Pixie" (the wave-4…7 voice), trimmed, two-pass loudnorm −18 LUFS / TP −1.5, AAC 64k .m4a + Opus 48k .ogg.',
          " * game/voiceW5.ts matches BAYBAY's bubbles against this table too (zh + en exactly; an earlier recording of the same",
          ' * words wins). W8_RETAKE_CLIPS: faster takes of wave-7 clips that were muted (W7_VOICE_CHECK, the rate gate), under the',
          ' * wave-7 clip ids — this module registers them before data/sf/voiceW7.ts (the binder imports it first) and the binder',
          " * no longer mutes them. Measurements, picks and the owner's listening sheet: docs/opus-bay/qa/w8/X/voice/.",
          ' */',
          "import { type VoiceClip, registerVoiceClips } from '../assets';", '',
          'export interface W8VoiceLine { id: string; lane: string; zh: string; en: string; /** seconds: zh, en */ s: readonly [number, number]; /** the lane plays it (a voice-line event with this id): never matched by text */ own?: 1 }', '',
          'export const W8_VOICE_LINES: readonly W8VoiceLine[] = [']
    for lid, ln in report['lines'].items():
        # a line is in the table only once both languages are recorded (a take the service failed waits for the next batch)
        if f'zh-{lid}' not in report['clips'] or f'en-{lid}' not in report['clips']: continue
        dz = report['clips'].get(f'zh-{lid}', {}).get('pick', {}).get('duration', 0)
        de = report['clips'].get(f'en-{lid}', {}).get('pick', {}).get('duration', 0)
        own = ', own: 1' if ln.get('own') else ''
        ts.append(f"  {{ id: {json.dumps(lid)}, lane: {json.dumps(ln['lane'])}, zh: {json.dumps(ln['zh'], ensure_ascii=False)}, en: {json.dumps(ln['en'], ensure_ascii=False)}, s: [{dz}, {de}]{own} }},")
    both = {lid for lid in report['lines'] if f'zh-{lid}' in report['clips'] and f'en-{lid}' in report['clips']}
    check = [c for c, e in report['clips'].items() if not e['pick']['passed'] and e['line'] in both]
    kept = [(c, e) for c, e in report['retakes'].items() if e['kept']]
    ts += ['];', '',
           '/** clips whose pick missed a gate (the listening sheet says "check"): muted until the owner approves them */',
           'export const W8_VOICE_CHECK: readonly string[] = [' + ', '.join(json.dumps(c) for c in check) + '];', '',
           "const DIR = '/opus-bay/w8/voice';",
           "export const W8_VOICE_CLIPS: Record<string, VoiceClip> = Object.fromEntries(W8_VOICE_LINES.flatMap(l => (['zh', 'en'] as const).map((lang, k): [string, VoiceClip] => [",
           '  `${lang}-${l.id}`, { m4a: `${DIR}/${lang}-${l.id}.m4a`, ogg: `${DIR}/${lang}-${l.id}.ogg`, lang, text: l[lang], duration: l.s[k] },',
           '])));', '',
           "/** retakes of wave-7 muted clips (their wave-7 clip ids; the new files are wave 8's): they play, unmuted */",
           'export const W8_RETAKE_CLIPS: Record<string, VoiceClip> = {']
    for c, e in kept:
        ts.append(f"  {json.dumps(c)}: {{ m4a: `${{DIR}}/{c}.m4a`, ogg: `${{DIR}}/{c}.ogg`, lang: {json.dumps(e['language'])}, text: {json.dumps(e['text'], ensure_ascii=False)}, duration: {e['pick']['duration']} }},")
    ts += ['};', '',
           'registerVoiceClips(W8_RETAKE_CLIPS);',
           'registerVoiceClips(W8_VOICE_CLIPS, W8_VOICE_CHECK);', '']
    open(f'{R}/src/opus-bay/data/sf/voiceW8.ts', 'w', encoding='utf-8', newline='\n').write('\n'.join(ts))
    npass = sum(1 for e in report['clips'].values() if e['pick']['passed'])
    nasr = sum(1 for e in report['clips'].values() if e['pick']['asr_ok'])
    print(f'clips {len(report["clips"])}  passed {npass}  recogniser right {nasr}  retakes kept {len(kept)} / {len(report["retakes"])}  (this batch: {len(order)})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
