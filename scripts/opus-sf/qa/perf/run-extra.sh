#!/bin/bash
# Extras: twin peaks pool=tile (nvidia), district re-measure (nvidia), phone emulation (amd iGPU, DPR 3, auto quality)
cd /c/Users/willy/baylink-opus
Q=C:/Users/willy/opus-qa/w2-perf
NV="--force_high_performance_gpu"
mkdir -p $Q/extra
U="http://localhost:5174/opus-bay?start=free&world=city&quality=high&time=golden&pool=tile"
CHROME_FLAGS="$NV" node scripts/opus-shot.mjs --url "$U" --w 1440 --h 900 --wait 30000 --out "$Q/extra/tile-twin-peaks.jpg" --actions "$(sed "s#perf-twin-peaks-desktop.jpg#$Q/extra/tile-twin-peaks.jpg#" $Q/perf-twin-peaks-desktop.json)" > "$Q/extra/tile-twin-peaks.log" 2>&1
echo "tile done $(date +%T)"
while read at time vp; do
  UD="http://localhost:5174/opus-bay?start=free&quality=high&time=$time&at=$at"
  if [ "$vp" = mobile ]; then V="--mobile"; else V="--w 1440 --h 900"; fi
  CHROME_FLAGS="$NV" node scripts/opus-shot.mjs --url "$UD" $V --wait 30000 --out "$Q/extra/district-$at-$time.jpg" --actions "$(sed "s#SHOT#$Q/extra/district-$at-$time.jpg#" $Q/district.json)" > "$Q/extra/district-$at-$time.log" 2>&1
  echo "district $at $time done $(date +%T)"
done <<LIST
ferry-gate golden desktop
sea-lion-viewpoint golden desktop
coit-view golden desktop
ferry-clock night desktop
pier39-entrance day mobile
coit-view night mobile
LIST
for gpu in amd nv; do
  if [ $gpu = nv ]; then F="$NV"; else F=""; fi
  UP="http://localhost:5174/opus-bay?start=free&world=city&time=golden"
  CHROME_FLAGS="$F" node scripts/opus-shot.mjs --url "$UP" --mobile --dpr 3 --wait 30000 --out "$Q/extra/phone-$gpu-ferry.jpg" --actions "$(sed "s#SHOT#$Q/extra/phone-$gpu-ferry.jpg#" $Q/phone-ferry.json)" > "$Q/extra/phone-$gpu-ferry.log" 2>&1
  CHROME_FLAGS="$F" node scripts/opus-shot.mjs --url "$UP" --mobile --dpr 3 --wait 30000 --out "$Q/extra/phone-$gpu-tp.jpg" --actions "$(sed "s#SHOT#$Q/extra/phone-$gpu-tp.jpg#" $Q/phone-twinpeaks.json)" > "$Q/extra/phone-$gpu-tp.log" 2>&1
  echo "phone $gpu done $(date +%T)"
done
