#!/bin/bash
# Sequential perf runs, one headless Chrome at a time. Usage: bash run-all.sh <tag> <chrome flags>
cd /c/Users/willy/baylink-opus
Q=C:/Users/willy/opus-qa/w2-perf
TAG=$1; FLAGS=$2
mkdir -p $Q/$TAG
U="http://localhost:5174/opus-bay?start=free&world=city&quality=high&time=golden"
for s in ferry-gate chinatown twin-peaks ocean-beach ggb-south mission; do
  CHROME_FLAGS="$FLAGS" node scripts/opus-shot.mjs --url "$U" --w 1440 --h 900 --wait 30000 --out "$Q/$TAG/perf-$s-desktop.jpg" --actions "$(sed "s#perf-$s-desktop.jpg#$Q/$TAG/perf-$s-desktop.jpg#" $Q/perf-$s-desktop.json)" > "$Q/$TAG/perf-$s-desktop.log" 2>&1
  CHROME_FLAGS="$FLAGS" node scripts/opus-shot.mjs --url "$U" --mobile --wait 30000 --out "$Q/$TAG/perf-$s-mobile.jpg" --actions "$(sed "s#perf-$s-mobile.jpg#$Q/$TAG/perf-$s-mobile.jpg#" $Q/perf-$s-mobile.json)" > "$Q/$TAG/perf-$s-mobile.log" 2>&1
  echo "$TAG $s done $(date +%T)"
done
