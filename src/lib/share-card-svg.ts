import type { EditorialShare } from './editorial-share';
import { escapeHtml } from './seo';

/** Character-width wrapping is independent of browser/OS fonts; never cuts UTF-16 pairs. */
export function cardLines(text: string, width: number, fontSize: number, maxLines: number): string[] {
  const result: string[] = []; let line = ''; let used = 0;
  const letters = Array.from(text.replace(/\s+/g, ' ').trim());
  for (let index = 0; index < letters.length; index++) {
    const char = letters[index];
    const advance = /[\u2e80-\uffff]/u.test(char) ? fontSize : /[MW@]/.test(char) ? fontSize * .86 : /[il .,:|]/.test(char) ? fontSize * .32 : fontSize * .59;
    if (used + advance > width && line) {
      if (result.length === maxLines - 1) { result.push(`${line.trimEnd()}…`); return result; }
      result.push(line.trim()); line = ''; used = 0;
    }
    line += char; used += advance;
  }
  if (line.trim()) result.push(line.trim());
  return result;
}
const textLines = (lines: string[], x: number, y: number, size: number, lineHeight: number, weight = 400, fill = '#183e34') => lines.map((line, i) => `<text x="${x}" y="${y + i * lineHeight}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeHtml(line)}</text>`).join('');
export function renderShareCardSvg(item: EditorialShare, qrPath: string, qrSize: number, logoData: string): string {
  const title = cardLines(item.title, 780, 44, 4);
  const dateY = 176 + title.length * 54;
  const summaryY = dateY + 159;
  const summaryLines = Math.max(0, Math.min(3, Math.floor((516 - summaryY) / 28) + 1));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f7f4eb"/><rect x="12" y="12" width="1176" height="606" rx="26" fill="none" stroke="#174d3f" stroke-width="3"/>
  <path d="M892 14H1162Q1186 14 1186 40V590Q1186 616 1162 616H892Z" fill="#dce8cc"/>
  <path d="M895 72C978 140 1086 8 1185 96M895 102C1000 176 1090 38 1185 128" fill="none" stroke="#b9ceb2" stroke-width="2"/>
  <g font-family="Noto Sans SC"><image href="${logoData}" x="48" y="40" width="58" height="58"/>
  <text x="119" y="80" font-size="31" font-weight="700" fill="#174d3f">BAYLINK</text><text x="292" y="77" font-size="19" letter-spacing="3" fill="#6a7f70">YOUR BAY. YOUR PEOPLE.</text>
  <rect x="50" y="127" width="262" height="36" rx="18" fill="#174d3f"/><text x="68" y="152" font-size="18" fill="#fff">${escapeHtml(item.label)}</text>
  ${textLines(title, 50, 216, 44, 54, 650)}
  ${textLines(cardLines(item.date, 766, 23, 2), 52, dateY + 42, 23, 34, 500, '#476653')}
  ${textLines(cardLines(item.area, 766, 21, 1), 52, dateY + 111, 21, 29, 400, '#476653')}
  ${summaryLines ? textLines(cardLines(item.summary, 766, 21, summaryLines), 52, summaryY, 21, 28, 400, '#476653') : ''}
  <line x1="50" y1="536" x2="854" y2="536" stroke="#d0d8c7"/><text x="52" y="577" font-size="21" fill="#174d3f">收藏一份湾区日常，约一次值得的出门。</text>
  <text x="52" y="603" font-size="15" fill="#6a7f70">日期、领取条件与开放状态，请以详情页和官方入口为准。</text>
  <text x="931" y="208" font-size="25" font-weight="600" fill="#174d3f">一起发现湾区</text>
  <rect x="922" y="238" width="234" height="234" rx="16" fill="#fff"/>
  <svg x="935" y="251" width="208" height="208" viewBox="-4 -4 ${qrSize + 8} ${qrSize + 8}" shape-rendering="crispEdges"><path fill="#173f34" d="${qrPath}"/></svg>
  <text x="956" y="507" font-size="18" fill="#174d3f">扫码查看这条详情</text><text x="953" y="545" font-size="23" font-weight="650" fill="#174d3f">baylink.us</text>
  </g></svg>`;
}
