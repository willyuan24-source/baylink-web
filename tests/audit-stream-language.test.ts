import assert from 'node:assert/strict';
import test from 'node:test';
import { readBayBayStream, parseBayBayQuickCards } from '../src/lib/baybay-stream';
import { languagePath, pathLanguage } from '../src/lib/language-path';
import { getDiscoveryMetadata } from '../src/lib/discovery-metadata';
import { postImageUrl } from '../src/lib/post-image';
import { bayBayRequestPath } from '../src/lib/baybay-conversation';

test('page context keeps a valid event occurrence and strips unrelated or invalid query data', () => {
  assert.equal(bayBayRequestPath('/en/events/Official_Event-1?date=2026-10-11&email=private@example.org#notes'), '/events/Official_Event-1?date=2026-10-11');
  assert.equal(bayBayRequestPath('/events/example?date=2026-02-30'), '/events/example');
  assert.equal(bayBayRequestPath('/events/example?date=2026-10-10&date=2026-10-11'), '/events/example');
  assert.equal(bayBayRequestPath('/guides/example?date=2026-10-10&token=private'), '/guides/example');
});

test('stream shows only verified canonical cards and validated text, with the final result authoritative', async () => {
  const frames = [
    ['quick_card', { verified:true, cards:[{kind:'event',id:'fleet-week',title:'Fleet Week',url:'/events/fleet-week',summary:'Official dates'}, {kind:'event',id:'evil',title:'Injected link',url:'https://attacker.example',summary:'x'}] }],
    ['delta', {text:'Unvalidated model draft', validated:false}],
    ['delta', {text:'Verified answer', validated:true}],
    ['result', {ok:true,answer:'Verified final answer'}],
  ].map(([event,data])=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  const cards: string[]=[]; const text: string[]=[];
  const result=await readBayBayStream(new Response(frames),undefined,undefined,{onCards:items=>cards.push(...items.map(item=>item.url)),onText:chunk=>text.push(chunk)});
  assert.deepEqual(cards,['/events/fleet-week']); assert.deepEqual(text,['Verified answer']);
  assert.deepEqual(result,{ok:true,answer:'Verified final answer'});
});
test('language URLs remain distinct and stable without double prefixes',()=>{
  assert.equal(languagePath('/en/guides/example','zh-Hant'),'/zh-Hant/guides/example');
  assert.equal(languagePath('/zh-Hant/','zh-Hans'),'/');
  assert.equal(pathLanguage('/english'),'zh-Hans');
});
test('quick cards match server ID and text limits and reject invalid dates or paths', () => {
  const card = { kind: 'event', id: 'Official_Event-1', title: 'x'.repeat(300), summary: 'x'.repeat(1600), url: '/events/Official_Event-1', date: '2026-02-30', temporalStatus: 'past' };
  assert.equal(parseBayBayQuickCards([card])[0]?.date, undefined);
  assert.equal(parseBayBayQuickCards([card])[0]?.temporalStatus, 'past');
  assert.equal(parseBayBayQuickCards([{ ...card, date: '2026-10-10' }])[0]?.date, '2026-10-10');
  assert.deepEqual(parseBayBayQuickCards([{ ...card, id: '../foo', url: '/events/../foo' }]), []);
  assert.deepEqual(parseBayBayQuickCards([{ ...card, title: 'x'.repeat(301) }]), []);
});
test('events have event dates and venue schema, with no invented ticket price or time',()=>{
  const metadata=getDiscoveryMetadata({kind:'event',event:{id:'sample-event',title:'Official event',startDate:'2026-10-10',endDate:'2026-10-11',dateLabel:'Oct 10–11',region:'sf',city:'San Francisco',venue:'Official venue',category:'culture',cost:'unknown',costLabel:'Check the organizer',summary:'A verified listing',plan:[],audience:[],officialUrl:'https://example.org',sourceLabel:'Official organizer',verifiedAt:'2026-10-05',imageKey:'culture'}});
  assert.equal(metadata.structuredData?.[0]['@type'],'Event');
  assert.equal(metadata.structuredData?.[0].startDate,'2026-10-10');
  assert.equal(metadata.structuredData?.[0].offers,undefined);
});
test('public post covers are bounded Cloudinary derivatives and signed or foreign URLs are preserved',()=>{
  assert.match(postImageUrl('https://res.cloudinary.com/bay/image/upload/v123/photo.jpg',480), /f_auto,q_auto,c_limit,w_480\/v123/);
  const signed='https://res.cloudinary.com/bay/image/upload/s--signature--/v123/photo.jpg';
  assert.equal(postImageUrl(signed),signed); assert.equal(postImageUrl('/brand/image.png'),'/brand/image.png');
});
