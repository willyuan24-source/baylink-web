import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import QRCode from 'qrcode';
import { Resvg } from '@resvg/resvg-js';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { getContentReviewManifest } from '../src/data/content-review';
import { getBayAreaToday, getMonthlyDateRange } from '../src/lib/monthly';
import type { MonthlyEvent } from '../src/data/monthly-types';
import { getBuildWeekend } from '../src/lib/home-weekend-build';
import { getWeeklyCardDays } from '../src/lib/home-weekend';
import { cardLines } from '../src/lib/share-card-svg';
import { escapeHtml, SITE_URL } from '../src/lib/seo';
import { eventOccursOn, addCalendarDays } from '../src/lib/event-calendar';

const today = getBayAreaToday();
const regions = { all: '湾区', sf: '旧金山', 'east-bay': '东湾', peninsula: '半岛', 'south-bay': '南湾', 'north-bay': '北湾' };
await mkdir('public/weekly', { recursive:true }); await mkdir('public/calendars',{recursive:true});
await writeFile('public/content-review-manifest.json', JSON.stringify(getContentReviewManifest(today),null,2));
const icsText=(value:string)=>value.replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(';','\\;').replaceAll(',','\\,');
const fold=(line:string)=>{ const out:string[]=[];let current='';for(const char of line) {if(Buffer.byteLength(current+char)>73){out.push(current);current=' '+char;}else current+=char;}out.push(current);return out.join('\r\n');};
const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
const fonts=['scripts/fonts/NotoSansSC-Regular.ttf','scripts/fonts/NotoSansSC-Bold.ttf'];
// Dated cards from an earlier local build would otherwise linger next to the new ones.
for(const file of await readdir('public/weekly')) if(/^all-\d{4}-\d{2}-\d{2}\.(png|json)$/.test(file)) await rm(`public/weekly/${file}`);
const card=async(region:string,label:string,catalog:MonthlyEvent[],day:string,name:string)=>{
  const range=getMonthlyDateRange('weekend',day)!;
  const selection=getBuildWeekend(day,catalog).picks;
  const picks=selection.map(pick=>pick.event);
  // Editor picks carry their one-line reason after the date.
  const dateLine=({date,editorial}:(typeof selection)[number])=>editorial?`${date} · 编辑精选：${editorial.reason.zh}`:date;
  const qr=await QRCode.toString(`${SITE_URL}/n/${region}`,{type:'svg',errorCorrectionLevel:'M',margin:1,width:200});
  const qrImage=`data:image/svg+xml;base64,${Buffer.from(qr).toString('base64')}`;
  const lines=(text:string,y:number,size:number,max:number=2)=>cardLines(text,920,size,max).map((line,index)=>`<text x="80" y="${y+index*(size+14)}" font-size="${size}" fill="#16352B">${escapeHtml(line)}</text>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440"><rect width="1080" height="1440" fill="#F8F9F6"/><g font-family="Noto Sans SC"><text x="80" y="105" font-size="38" font-weight="700" fill="#176B52">BAYLINK · ${label}周末</text><text x="80" y="172" font-size="32" fill="#3F5247">${range.start} — ${range.end}</text>${picks.map((event,index)=>`<rect x="56" y="${230+index*290}" width="968" height="266" rx="20" fill="white" stroke="#C9D3C1"/>${lines(event.title,290+index*290,36,2)}${lines(dateLine(selection[index]),379+index*290,26,1)}${lines(`${event.city} · ${event.venue}`,414+index*290,26,1)}${lines(event.costLabel,447+index*290,26,1)}<text x="80" y="${482+index*290}" font-size="22" fill="#5B6B61">官方来源 · 核对 ${event.verifiedAt}</text>`).join('')}${!picks.length?lines('本周暂没有已确认活动，扫码查看常设去处。',300,36,3):''}<image href="${qrImage}" x="78" y="1135" width="204" height="204"/><text x="320" y="1200" font-size="34" fill="#16352B">扫码看当期完整日期、条件与来源</text><text x="320" y="1260" font-size="28" fill="#3F5247">baylink.us/n/${region}</text><text x="80" y="1388" font-size="23" fill="#5B6B61">这是 ${today} 生成的快照；行前再查官方。未验证票价不标免费。</text></g></svg>`;
  // A fresh original share layout. The stable QR destination survives a particular event ending.
  const png=new Resvg(svg,{font:{loadSystemFonts:false,fontFiles:fonts}}).render().asPng();
  await writeFile(`public/weekly/${name}.png`,png);
  await writeFile(`public/weekly/${name}.json`,JSON.stringify({generatedAt:today,day,range,region,picks:selection.map(({event:{id,title,startDate,endDate,city,venue,costLabel,officialUrl,verifiedAt},date,editorial})=>({id,title,date,startDate,endDate,city,venue,costLabel,officialUrl,verifiedAt,...editorial&&{editorial}}))}));
};
for(const [region,label] of Object.entries(regions)) {
  const catalog=MONTHLY_EVENTS.filter(event=>region==='all'||event.region===region);
  await card(region,label,catalog,today,region);
  // The home page links the card for its own day, so Sunday and Monday visitors share what they see.
  if(region==='all') for(const day of getWeeklyCardDays()) await card(region,label,catalog,day,`all-${day}`);
  const entries:string[]=[];
  for(const event of catalog) for(let date=event.startDate>today?event.startDate:today; date<=event.endDate&&date<=addCalendarDays(today,45);date=addCalendarDays(date,1)) {
    if(!eventOccursOn(event,date)) continue;
    // All-day is intentional: a time is not invented for a listing without structured session times.
    entries.push('BEGIN:VEVENT',`UID:${event.id}-${date}@baylink.us`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${date.replaceAll('-','')}`,`DTEND;VALUE=DATE:${addCalendarDays(date,1).replaceAll('-','')}`,`SUMMARY:${icsText(event.title)}`,`LOCATION:${icsText(event.city+' · '+event.venue)}`,`DESCRIPTION:${icsText(event.dateLabel+'\n'+event.costLabel+'\n请查官方时段；这是活动日期提醒，不是门票或入场预约。\n'+event.officialUrl)}`,`URL:${SITE_URL}/events/${event.id}?date=${date}`,'BEGIN:VALARM','TRIGGER:-P2D','ACTION:DISPLAY',`DESCRIPTION:${icsText(event.title+' · 行前核对官方')}`,'END:VALARM','END:VEVENT');
  }
  await writeFile(`public/calendars/${region}.ics`, ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//BAYLINK//Official-source event dates//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH',`X-WR-CALNAME:BAYLINK ${label}活动日期`,...entries,'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n');
}
console.log(`Weekly cards (${getWeeklyCardDays().length} dated Bay Area cards) and six subscription calendars generated for ${today}; full source review manifest exported.`);
