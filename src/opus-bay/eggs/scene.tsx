import type * as THREE from 'three';

/** Wave 5 · lane D · mounts the eggs' root (the prop pool and the flock) inside game/Systems (registerSceneSystem). */
export function makeEggScene(root: THREE.Object3D) {
  return function EggScene() {
    return <primitive object={root} />;
  };
}
