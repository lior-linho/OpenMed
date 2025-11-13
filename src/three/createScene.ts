import * as THREE from "three";

export function createScene(canvas: HTMLCanvasElement, opts?: {
  initialCamPos?: [number, number, number];
}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.01, 1000);
  const [cx, cy, cz] = opts?.initialCamPos ?? [1.0, 0.9, 1.0];
  camera.position.set(cx, cy, cz);
  camera.lookAt(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(2, 2, 2);
  scene.add(dir);

  function resize() {
    const r = canvas.getBoundingClientRect();
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    renderer.setSize(r.width, r.height, false);
  }
  window.addEventListener("resize", resize);

  return {
    scene, camera, renderer,
    dispose: () => {
      window.removeEventListener("resize", resize);
      renderer.dispose();
    }
  };
}
