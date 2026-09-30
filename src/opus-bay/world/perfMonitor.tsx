/**
 * W7-P1 · drei's PerformanceMonitor as its own small chunk (lane P, sf-w6-P.md Request 5: GameRoot ≤ 265 KB gzip).
 * WorldScene mounts it 9 s into play (world/quality.ts MONITOR), so it is fetched when play begins, not with GameRoot.
 */
export { PerformanceMonitor } from '@react-three/drei';
