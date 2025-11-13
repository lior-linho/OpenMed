import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

export async function loadVessel(url: string): Promise<THREE.Group> {
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene ?? new THREE.Group().add(gltf.scene);

  const group = new THREE.Group();
  group.name = "vesselRoot";
  group.add(root);

  // 居中+统一尺度
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  group.position.sub(center);

  const maxEdge = Math.max(size.x, size.y, size.z) || 1;
  const target = 1.0;
  const scale = target / maxEdge;
  group.scale.setScalar(scale);

  // 简单材质合理化
  group.traverse((o) => {
    const mat = (o as any).material as THREE.Material | undefined;
    if (mat && "metalness" in mat) {
      (mat as any).metalness = 0.0;
      (mat as any).roughness = 0.9;
    }
  });

  return group;
}
