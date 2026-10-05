import {MONTHLY_EVENTS} from '../src/data/monthly-edition';
import {GUIDE_IMAGES} from '../src/data/guide-media';
const photos=new Set(MONTHLY_EVENTS.filter(event=>event.verifiedAt==='2026-10-05'&&GUIDE_IMAGES[event.imageKey]?.kind==='photo').map(event=>event.imageKey));
console.log(JSON.stringify([...photos].map(key=>({key,image:GUIDE_IMAGES[key],events:MONTHLY_EVENTS.filter(event=>event.imageKey===key).map(({id,title,venue})=>({id,title,venue}))})),null,2));
