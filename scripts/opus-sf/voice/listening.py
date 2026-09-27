"""
Lane H2b (H2b-8): the owner's listening sheet, from docs/opus-bay/h2b/voice-report.json.

  python scripts/opus-sf/voice/listening.py --repo C:/Users/willy/wt/h2b --work C:/Users/willy/opus-qa/w3/h2b/voice

Writes docs/opus-bay/h2b/listening.md: every shipped clip in the order of the two preview files, with its text,
duration, file, the measured checks and the alternates (scratch copies, normalised the same way).
"""
import argparse, json

HEAD = """# BAYBAY 城市语音 · 试听单（H2b-8）

主人好！这里是 BAYBAY 在城市模式里的 43 段新语音（20 句 × 中英文 + 3 句重录）。机器只能量时长、削波、停顿和音高，
**好不好听、像不像 BAYBAY、听不听得清，要靠你的耳朵**。

**怎么听**

1. 最快：按顺序听两个合集（每句之间停 0.6 秒）：`docs/opus-bay/h2b/voice-preview-zh.m4a` = 下表 1–20 和 41–43，`voice-preview-en.m4a` = 下表 21–40。
2. 单句：`public/opus-bay/voice/sf/<clip>.m4a`（游戏里放的就是这个文件）。
3. 备选：`{work}/listen/<clip>-<编号>.m4a`（同样处理过的其他版本）。

**怎么回复**：在“你的判断”一栏写 ✓（留用）、✗（不要，改回小叫声）或“换 #编号”。三句重录（最后一节）默认静音，
你说 ✓ 以后才把它们加进 `data/voiceLinesSf.ts` 的 `SF_VOICE_UNMUTE`，游戏里才会播放。

检查项（每句都过了）：时长 ≤ 2.0 秒 · 原始音频无削波 · 结尾没被截断 · 句中停顿 ≤ 0.45 秒（带“…”的 ≤ 0.65） · 音高中位数 180–450 Hz ·
响度 −18 LUFS / 峰值 ≤ −1.5 dBTP。“识别”一栏是 Windows 离线识别器在全部台词里挑中的那一句（只作参考，“-”表示它没认出来）。
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', required=True)
    ap.add_argument('--work', required=True)
    a = ap.parse_args()
    rep = json.load(open(f'{a.repo}/docs/opus-bay/h2b/voice-report.json', encoding='utf-8'))['clips']
    out = [HEAD.replace('{work}', a.work)]
    sections = [('中文 · 第一次骑车 / 开车 / 坐车 / 滑翔 / 爬坡', lambda k: k.startswith('zh-first')),
                ('中文 · 第一次到一个街区', lambda k: k.startswith('zh-zone')),
                ('English · first rides', lambda k: k.startswith('en-first')),
                ('English · first arrivals', lambda k: k.startswith('en-zone')),
                ('重录的三句（默认静音，等你批准）', lambda k: k in ('zh-yay', 'zh-think', 'zh-arrived'))]
    n = 0
    for title, keep in sections:
        out.append(f'\n## {title}\n\n| # | clip | 文字 | 秒 | 识别 | 文件 | 备选（编号） | 你的判断 |\n|---|---|---|---|---|---|---|---|')
        for clip, e in rep.items():
            if not keep(clip) or 'pick' not in e:
                continue
            n += 1
            p = e['pick']
            took = next(t for t in e['takes'] if t['index'] == p['index'])
            alts = [f"#{t['index']}" + ('' if t['pass'] else '✗') for t in e['takes'] if t['index'] != p['index']]
            heard = took.get('asr') or '-'
            out.append(f"| {n} | `{clip}` | {p['text']} | {p['duration']:.2f} | {heard} | `voice/sf/{clip}.m4a` | {' '.join(alts)} |  |")
    out.append('\n备选编号后面的 ✗ 表示那一版没过检查（多半是超过 2 秒）。每一版的详细数字：`docs/opus-bay/h2b/voice-report.json`。\n')
    out.append('\n**重录说明**：`zh-yay` 选的是“好耶好耶！”——单说“好耶！”的 8 个版本，识别器每次都听成“讨厌”（和旧版被误听成的词一样）；'
               '说两遍就稳定听成“好耶好耶”。如果你觉得单说“好耶！”也清楚，回复“zh-yay 换 #120”之类即可。`zh-arrived` 选的 #132 被识别成“到啦”，'
               '其余几版多被识别成“到了”。`zh-think` 的 #184 是唯一能被识别出“嗯让我想想”的版本。\n')
    open(f'{a.repo}/docs/opus-bay/h2b/listening.md', 'w', encoding='utf-8', newline='\n').write('\n'.join(out))
    print(n, 'clips')


if __name__ == '__main__':
    main()
