import { useCallback, useEffect, useState } from 'react';
import { bayJourneyKey, emptyBayJourney, parseBayJourney, visitBayPlace, type BayJourney, type BayRegionId } from './bay-journey';
import { parseSfExploration, sfExplorationStorageKey } from './sf-exploration';

function read(key:string,owner?:string):BayJourney {
  if(typeof window==='undefined')return emptyBayJourney();
  try {
    let journey=parseBayJourney(window.localStorage.getItem(key));
    const sf=parseSfExploration(window.localStorage.getItem(sfExplorationStorageKey(owner)));
    for(const [id,stamp] of Object.entries(sf.stamps))journey=visitBayPlace(journey,'sf',id,new Date(stamp.collectedAt));
    return journey;
  } catch{return emptyBayJourney();}
}
export function useBayJourney(owner?:string) {
  const key=bayJourneyKey(owner);
  const [saved,setSaved]=useState(()=>({key,journey:read(key,owner)}));
  const [persistent,setPersistent]=useState(true);
  const journey=saved.key===key?saved.journey:read(key,owner);
  useEffect(()=>{setSaved(current=>current.key===key?current:{key,journey:read(key,owner)});},[key,owner]);
  useEffect(()=>{if(saved.key!==key)return;try{window.localStorage.setItem(key,JSON.stringify(saved.journey));setPersistent(true);}catch{setPersistent(false);}},[key,saved]);
  useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key===key||event.key===null)setSaved({key,journey:read(key,owner)});};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[key,owner]);
  const visit=useCallback((region:BayRegionId,id:string)=>setSaved(current=>{const prior=current.key===key?current.journey:read(key,owner);const next=visitBayPlace(prior,region,id);return next===prior&&current.key===key?current:{key,journey:next};}),[key,owner]);
  return {journey,visit,persistent};
}
