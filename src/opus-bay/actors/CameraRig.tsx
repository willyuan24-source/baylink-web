import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { CameraController, chooseYaw, heroPoints, yawCandidates, zoneViews } from './camera';
import { preferredViewDir } from './viewField';
import { frameStats } from './frameStats';

/** Third-person follow camera (see actors/camera.ts). Runs after Actors in the frame loop. */
export function CameraRig() {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera;
  const rig = useMemo(() => new CameraController(), []);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    // (QA: the camera maths of this very module instance — a dynamic import from a page script can load a second copy)
    w.__opusBay = { ...(w.__opusBay ?? {}), cameraRig: rig, camera, frameStats: () => frameStats(camera), cameraApi: { chooseYaw, yawCandidates, zoneViews, heroPoints, preferredViewDir } };
  }, [rig, camera]);
  useFrame((state, dt) => {
    rig.update(camera, Math.min(dt, 0.1), state.clock.elapsedTime, state.size.height, state.size.width);
  });
  return null;
}
