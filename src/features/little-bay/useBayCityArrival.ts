import { useCallback, useEffect, useRef, useState } from 'react';
import { BAY_CITIES, createBayCityPresence, stepBayCityPresence } from './bay-cities';

/** City names follow the character, while previews leave its location alone. */
export function useBayCityArrival() {
  const presence=useRef(createBayCityPresence());
  const [cityId,setCityId]=useState<string|null>(null);
  const [arrival,setArrival]=useState<{cityId:string;time:number}|null>(null);
  const report=useCallback((x:number,z:number,active:boolean)=>{
    const now=Date.now();
    const result=stepBayCityPresence(presence.current,{x,z,now,active});
    presence.current=result.state;setCityId(result.state.cityId);
    if(result.entered)setArrival({cityId:result.entered.id,time:now});
  },[]);
  const reset=useCallback(()=>{presence.current=createBayCityPresence();setCityId(null);setArrival(null);},[]);
  useEffect(()=>{if(!arrival)return;const timer=window.setTimeout(()=>setArrival(null),4200);return()=>window.clearTimeout(timer);},[arrival]);
  return {city:BAY_CITIES.find(city=>city.id===cityId)||null,arrival:arrival?BAY_CITIES.find(city=>city.id===arrival.cityId)||null:null,report,reset};
}
