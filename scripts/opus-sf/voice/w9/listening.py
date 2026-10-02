"""
Lane X (W9-X4): the owner's listening sheet for wave 9 — docs/opus-bay/qa/w9/X/voice/listening.md.

  npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/voice/w9/coverage.ts --json C:/Users/willy/opus-qa/w9/x/coverage.json
  python scripts/opus-sf/voice/w9/listening.py --repo C:/Users/willy/wt/w9-x --coverage C:/Users/willy/opus-qa/w9/x/coverage.json

Reads the wave-9 report (docs/opus-bay/qa/w9/X/voice/w9-voice-report.json: every clip's pick, gates, what the recogniser
heard) and the coverage (scripts/opus-sf/voice/w9/coverage.ts: the muted and unvoiced lines of every wave). Writes the
sheet: how to listen, the wave-9 clips by batch, the older clips still muted for the owner's ear, the sound defaults to
check by ear (the music's start, the volumes, 只关语音) and the older sheets not heard yet.
"""
import argparse, json, os

LANE = {'a': '小游戏', 'w2': '西区', 'al': '恶魔岛', 'w1': '唐人街', 'k': '出行', 'f': '第一分钟', 'r': '真实旧金山', 'n': '带路',
        'g': '游乐', 'h': '万圣', 's': '分享', 'c': '镜头', 'e': '入口', 'x': '配音'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', required=True)
    ap.add_argument('--coverage', required=True)
    a = ap.parse_args()
    qa = f'{a.repo}/docs/opus-bay/qa/w9/X/voice'
    rep = json.load(open(f'{qa}/w9-voice-report.json', encoding='utf-8'))
    cov = json.load(open(a.coverage, encoding='utf-8'))
    clips = rep['clips']
    batches = sorted({e.get('batch', 1) for e in clips.values()})
    out = [
        '# 第九波 · BAYBAY 配音和声音 · 试听单（lane X）',
        '',
        '主人好！这一页是第九波新录的 BAYBAY 台词，加上以前还在等你批准的几条，以及这次改了的声音默认值。机器只能量时长、爆音、停顿和语速，'
        '**好不好听、像不像 BAYBAY、听不听得清，要靠你的耳朵**。',
        '',
        '**怎么听**',
        '',
        '1. 最快：按批次听合集（每句之间停 0.7 秒，顺序 = 下表）：' + '、'.join(f'`w9-voice-preview-b{b}-zh.m4a` / `-en.m4a`' for b in batches) + '（都在本目录）。',
        '2. 单句：`public/opus-bay/w9/voice/<clip>.m4a`（游戏里播的就是这个文件）。',
        '3. 在游戏里听：打开 `https://www.baylink.us/opus-bay`（上线后），走到对应地点；每句的位置写在「在哪儿听」一栏。',
        '',
        '**怎么回复**：在「你的判断」一栏写 ✓（留用）、✗（不要：这句改回只有文字气泡）或「重录」（写一句想要的语气）。',
        '「机器」= 机器检查（没有爆音、没有截断、停顿和语速正常）：pass 的已经在游戏里播放；check 的先静音，等你写 ✓ 才播放。',
        '「识别」= Windows 语音识别在所有台词里听出的是不是这一句（✓ = 听对），只作参考。',
        '',
        f"**现在的配音覆盖率**：BAYBAY 的固定台词共 {cov['lines']} 句，已配音 {cov['voiced']} 句（{cov['pct']}%），"
        f"{cov['muted']} 句等你批准（下面第二部分），{cov['unvoiced']} 句还没有录音。",
        '',
        '## 第一部分 · 第九波新录音',
        '',
    ]
    where = {
        'w5-a-adfb2f33': '叮当车拉闸小游戏：坐不到一站就拉闸',
        'w5-a-ddd3b836': '纸板滑草：滑得很短的时候',
        'w5-w2-280f73fb': '金门公园蓝鹭湖，船屋旁（以前的「这座船屋…一直」改了说法：船屋这门生意从 1893 年开始，现在的房子是 1946–49 年的）',
        'w5-al-3042cee4': '恶魔岛码头坐船回 33 号码头时（新加的一句，以前说的是普通渡轮的「上船啦」）',
        'w8w1-pagodas-ahead-w9': '唐人街 Grant 街和 California 街路口（去掉了没有出处的「黄顶」）',
        'w5-c-df86205a': '鹈鹕第一次见面时选「以后再说」（以前这句带按键名、没法配音；按键现在写在「随时飞」小提示里）',
        'w5-r-a13d0aed': '回访时 BAYBAY 说今天的事（今天城里有活动的日子；活动名和地点写在小提示里）',
        'w5-r-abd86c7b': '回访时（日落前；日落时间写在小提示里）',
        'w5-r-7d16e184': '回访时（日落后）',
        'w5-a-311ad20d': '捉迷藏：想直接横穿马路的时候（G 线新加）',
        'w9-h-today-festival': '10 月 31 日 11:00–15:00 回访（或第一次来、玩了一分半钟、离唐人街远时）：唐人街万圣节庆典',
        'w9-h-today-big-night': '10 月 31 日其他时间回访：讨糖街家家开门（?halloween=night 也能听）',
        'w9-h-today-procession': '11 月 2 日 16:00–21:00 回访：亡灵节游行',
        'w5-n-645daeca': '一日游 / 带路时路被挡住、卡住不动：BAYBAY 的对话框问怎么走（对话框第一次有录音）',
        'w5-n-0dede64c': '一日游没走完，下次回来时：BAYBAY 的对话框问接着走吗',
    }
    for lang, title in (('zh', '中文'), ('en', 'English')):
        out += [f'### {title}', '', '| # | 批次 | 内容 | clip | 台词 | 秒 | 机器 | 识别 | 在哪儿听 | 你的判断 |', '|---|---|---|---|---|---|---|---|---|---|']
        n = 0
        for clip, e in sorted(clips.items(), key=lambda kv: kv[1].get('batch', 1)):
            if e['language'] != lang:
                continue
            n += 1
            p = e['pick']
            heard = '✓' if p.get('asr_ok') else (p.get('asr') or '—')
            out.append(f"| {n} | {e.get('batch', 1)} | {LANE.get(e['lane'], e['lane'])} | `{clip}` | {e['text']} | {p['duration']:.2f} | "
                       f"{'pass' if p['passed'] else 'check'} | {heard} | {where.get(e['line'], '')} | |")
        out.append('')
    muted = [r for r in cov['rows'] if r['status'] == 'muted']
    out += ['## 第二部分 · 以前录好、还在静音等你批准的', '',
            '这些录音没过机器的某一项检查（多半是「语速」：很短的叫声读得慢，或像钟声那样本来就慢），所以游戏里只显示文字。你听了觉得好，写 ✓ 就打开。',
            '', '| 台词（中 / 英） | 静音的录音 | 在哪个试听单里有文件 | 你的判断 |', '|---|---|---|---|']
    sheet_of = {'voiceW5': 'docs/opus-bay/qa/w5/V/voice/', 'voiceW6': 'docs/opus-bay/qa/w6/X/voice/', 'voiceW7': 'docs/opus-bay/qa/w7/X/voice/',
                'voiceW8': 'docs/opus-bay/qa/w8/X/voice/', 'voiceW9': 'docs/opus-bay/qa/w9/X/voice/'}
    for r in muted:
        out.append(f"| {r['zh']} / {r['en']} | {' '.join('`' + c + '`' for c in r.get('mutedClips') or [r['id']])} | `{sheet_of.get(r['table'], r['table'])}` | |")
    unvoiced = [r for r in cov['rows'] if r['status'] == 'unvoiced']
    if unvoiced:
        out += ['', '还没有录音的（只有文字气泡；多半是今晚最后一批之后才加的台词）：', '']
        out += [f"- {r['zh']} / {r['en']}（{r.get('source', '')}）" for r in unvoiced]
    out += ['', '## 第三部分 · 这次改了的声音默认值（请用耳朵确认）', '',
            '1. **音乐不再自己响**：打开游戏、点「开始」后，只有海浪、海鸥这些环境声和 BAYBAY 的声音。等你自己第一次按键 / 点屏幕 / 走一步，'
            '音乐才从无声慢慢起来（大约 9 秒到正常音量），而且比以前小（原来的 60%）。请在安静的房间里试一次：开始时会不会吓一跳？音乐起来时是不是自然？ ✓ / ✗：',
            '2. **设置里的音量**（A 线做滑块）：音乐、音效、语音三个滑块，和「只关语音」。只关语音后：BAYBAY 完全安静、气泡照常，音乐和音效照常。 ✓ / ✗：',
            '3. **一次只说一句**：BAYBAY 说话时，新的一句一开始，上一句会马上淡出；她说话时不会再叠一个「耶」的短叫声。走一圈有很多台词的地方（渡轮大厦、39 号码头）听一听。 ✓ / ✗：',
            '4. iPhone：静音键打开时网页声音会被系统关掉（设置里有提示）；第一次点「开始」那一下解锁声音的做法没有改。',
            '', '## 第四部分 · 以前的试听单（如果还没听）', '',
            '- 第八波：`docs/opus-bay/qa/w8/X/voice/listening.md`（132 句 / 264 段）',
            '- 第七波：`docs/opus-bay/qa/w7/X/voice/listening.md`（88 句 / 176 段）',
            '- 第六波（万圣节）：`docs/opus-bay/qa/w6/X/voice/listening.md`（80 段）',
            '']
    open(f'{qa}/listening.md', 'w', encoding='utf-8', newline='\n').write('\n'.join(out))
    print(f'{qa}/listening.md: {len(clips)} wave-9 clips, {len(muted)} muted, {len(unvoiced)} unvoiced')


if __name__ == '__main__':
    main()
