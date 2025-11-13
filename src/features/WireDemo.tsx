import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// Week 5 · Controlled Guidewire Component (React + Three.js)
// 受控版：支持从外层传入 centerline / radiusAt / wireRadius / camera / paused，并通过回调上报 u 与 state。
// 默认内置一个可跑的 centerline 与 radiusAt（含狭窄+弯曲惩罚），即使不传 props 也能独立运行。

// ===== Types & helpers =====
export enum RunState {
  Idle = "idle",
  Navigating = "navigating",
  Success = "success",
  Fail = "fail",
}

export type Vec3 = { x: number; y: number; z: number };

type WireDemoProps = {
  centerline?: Vec3[];                            // 中心线（不传则用内置）
  radiusAt?: (points: Vec3[], u: number) => number; // 有效半径函数（不传则用内置）
  wireRadius?: number;                             // 导丝半径（默认 0.55）
  forwardSpeed?: number;                           // 推进速度（默认 0.22）
  paused?: boolean;                                 // 暂停推进（默认 false）
  cameraPose?: { position: [number,number,number]; lookAt: [number,number,number]; }; // 相机位姿（可选）
  zoom?: number;                                    // 相机缩放（可选）
  onProgress?: (u: number) => void;                 // 进度回调 [0,1]
  onStateChange?: (s: RunState) => void;            // 状态回调
};

function vAdd(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function vSub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function vMul(a: Vec3, s: number): Vec3 { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function vLen(a: Vec3): number { return Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z); }
function vLerp(a: Vec3, b: Vec3, t: number): Vec3 { return vAdd(a, vMul(vSub(b, a), t)); }

const USE_CATMULL = true;
function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t*t, t3 = t2*t;
  return {
    x: 0.5 * ((2*p1.x) + (-p0.x + p2.x)*t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3),
    y: 0.5 * ((2*p1.y) + (-p0.y + p2.y)*t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3),
    z: 0.5 * ((2*p1.z) + (-p0.z + p2.z)*t + (2*p0.z - 5*p1.z + 4*p2.z - p3.z)*t2 + (-p0.z + 3*p1.z - 3*p2.z + p3.z)*t3),
  };
}

function getPointOnCenterline(points: Vec3[], u: number): Vec3 {
  if (points.length === 0) return { x:0,y:0,z:0 };
  if (!USE_CATMULL) {
    const segFloat = Math.max(0, Math.min(points.length - 1.0001, u * (points.length - 1)));
    const i = Math.floor(segFloat), t = segFloat - i;
    return vLerp(points[i], points[i+1], t);
  }
  const n = points.length;
  const segFloat = Math.max(0, Math.min(n - 1.0001, u * (n - 1)));
  const i = Math.floor(segFloat), t = segFloat - i;
  const i0 = Math.max(0, i-1), i1 = i, i2 = Math.min(n-1, i+1), i3 = Math.min(n-1, i+2);
  return catmullRom(points[i0], points[i1], points[i2], points[i3], t);
}

function samplePolyline(points: Vec3[], uEnd: number, samples = 80): Vec3[] {
  const out: Vec3[] = [];
  for (let i=0;i<samples;i++){
    const u = (i/(samples-1)) * Math.max(0.001, uEnd);
    out.push(getPointOnCenterline(points, u));
  }
  return out;
}

// ===== Built-in demo centerlines =====
const STRAIGHT: Vec3[] = Array.from({ length: 80 }, (_, i) => ({ x: 0, y: 0, z: i * 2 }));
const CURVED: Vec3[] = Array.from({ length: 160 }, (_, i) => {
  const z = i * 1.2;
  return { x: Math.sin(i * 0.08) * 6, y: Math.cos(i * 0.04) * 2, z };
});

// ===== Built-in simplified radius model =====
function estimateCurvature(points: Vec3[], u: number): number {
  const e = 0.002;
  const p0 = getPointOnCenterline(points, Math.max(0, u - e));
  const p1 = getPointOnCenterline(points, u);
  const p2 = getPointOnCenterline(points, Math.min(0.999, u + e));
  const v01 = vSub(p1, p0); const v12 = vSub(p2, p1);
  const a = vLen(v01), b = vLen(v12);
  if (a < 1e-5 || b < 1e-5) return 0;
  const dot = (v01.x*v12.x + v01.y*v12.y + v01.z*v12.z) / (a*b);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  return angle / e;
}

function radiusAtBase(): number { return 2.8; }
function builtInRadiusAt(points: Vec3[], u: number): number {
  const base = radiusAtBase();
  const u0 = 0.55, width = 0.06, depth = 0.6; // 60% 狭窄
  const stenosis = Math.exp(-((u - u0)*(u - u0)) / (2*width*width));
  const radiusByStenosis = base * (1 - depth*stenosis);
  const kappa = estimateCurvature(points, u);
  const bendPenalty = Math.min(0.6, kappa * 0.15);
  return Math.max(0.6, radiusByStenosis * (1 - bendPenalty));
}

// ===== Component =====
const WireDemo: React.FC<WireDemoProps> = ({
  centerline: centerlineProp,
  radiusAt: radiusAtProp,
  wireRadius: wireRadiusProp = 0.55,
  forwardSpeed: forwardSpeedProp = 0.22,
  paused = false,
  cameraPose,
  zoom,
  onProgress,
  onStateChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<RunState>(RunState.Idle);
  const [u, setU] = useState(0); // 导丝推进进度 [0,1]
  const [twist, setTwist] = useState(0); // Q/E 扭转角

  const wireRadius = wireRadiusProp;
  const forwardSpeed = forwardSpeedProp;

  // 输入 & 碰撞状态
  const keys = useRef<Record<string, boolean>>({});
  const [collision, setCollision] = useState<{hit:boolean; clearance:number}>({ hit:false, clearance:0 });
  const overpushRef = useRef(0); // 连续顶推计数，用于 Fail

  // 数据源
  const centerline = centerlineProp ?? CURVED;
  const radiusAt = radiusAtProp ?? builtInRadiusAt;

  // three refs
  const threeRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    wire?: THREE.Mesh;         // TubeGeometry (随 u 变化重建)
    wireTip?: THREE.Mesh;      // 球形软头
    vessel?: THREE.Mesh;       // 透明血管
    line?: THREE.Line;         // 中心线可视化
    animId?: number;
  }>({});

  // ===== 事件注册 =====
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, []);

  // ===== Three.js 初始化 =====
  useEffect(() => {
    const div = mountRef.current!;
    const width = div.clientWidth || 800;
    const height = div.clientHeight || 500;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    div.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1020);

    const camera = new THREE.PerspectiveCamera(55, width/height, 0.1, 3000);
    camera.position.set(18, 14, -8);
    camera.lookAt(0, 0, 40);
    if (cameraPose) {
      camera.position.set(...cameraPose.position);
      const la = new THREE.Vector3(...cameraPose.lookAt);
      camera.lookAt(la);
    }
    if (zoom) { camera.zoom = zoom; camera.updateProjectionMatrix(); }

    const light1 = new THREE.DirectionalLight(0xffffff, 1.0); light1.position.set(20, 30, -10); scene.add(light1);
    const amb = new THREE.AmbientLight(0xffffff, 0.35); scene.add(amb);

    // 中心线可视化
    const lineGeom = new THREE.BufferGeometry();
    const linePositions = new Float32Array(centerline.length * 3);
    centerline.forEach((p, i) => { linePositions[i*3+0]=p.x; linePositions[i*3+1]=p.y; linePositions[i*3+2]=p.z; });
    lineGeom.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ linewidth: 2, color: 0x6ea8fe }));
    scene.add(line);

    // 血管（整根）——透明管（视觉占位，可改为 GLB）
    const vesselCurvePoints = samplePolyline(centerline, 1.0, 160);
    const vesselCurve = new THREE.CatmullRomCurve3(vesselCurvePoints.map(p => new THREE.Vector3(p.x,p.y,p.z)));
    const vesselGeo = new THREE.TubeGeometry(vesselCurve, 300, radiusAtBase(), 36, false);
    const vessel = new THREE.Mesh(
      vesselGeo,
      new THREE.MeshStandardMaterial({ color: 0x0e5a86, transparent: true, opacity: 0.1, side: THREE.DoubleSide })
    );
    scene.add(vessel);

    // 导丝（初始 0 长度）
    const wireCurvePoints = samplePolyline(centerline, Math.max(0.001, u), 60);
    const wireCurve = new THREE.CatmullRomCurve3(wireCurvePoints.map(p => new THREE.Vector3(p.x,p.y,p.z)));
    const wireGeo = new THREE.TubeGeometry(wireCurve, 120, wireRadius, 12, false);
    const wire = new THREE.Mesh(
      wireGeo,
      new THREE.MeshStandardMaterial({ color: 0x39e09b, metalness: 0.05, roughness: 0.45 })
    );
    scene.add(wire);

    // 软头 tip
    const tipPos = getPointOnCenterline(centerline, Math.max(0.001, u));
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(wireRadius*1.2, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x4ef3b5, metalness: 0.1, roughness: 0.35 })
    );
    tip.position.set(tipPos.x, tipPos.y, tipPos.z);
    scene.add(tip);

    // 保存引用
    threeRef.current = { renderer, scene, camera, wire, wireTip: tip, vessel, line };

    // resize
    const onResize = () => {
      const w = div.clientWidth || window.innerWidth; const h = div.clientHeight || 500;
      renderer.setSize(w, h);
      camera.aspect = w/h; camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (div.contains(renderer.domElement)) div.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerline, cameraPose?.position?.join(","), cameraPose?.lookAt?.join(","), zoom]);

  // ===== 帧循环 =====
  useEffect(() => {
    const { renderer, scene, camera } = threeRef.current;
    if (!renderer || !scene || !camera) return;

    let animId = 0;
    const step = () => {
      // 推进/回撤 & 扭转输入（暂停时不推进）
      let du = 0;
      if (!paused) {
        if (keys.current["w"] || keys.current["arrowup"]) du += forwardSpeed;
        if (keys.current["s"] || keys.current["arrowdown"]) du -= forwardSpeed;
        if (keys.current["q"]) setTwist(t => t - 0.03);
        if (keys.current["e"]) setTwist(t => t + 0.03);
      }

      // 当前位置有效半径与余量
      const effRadius = radiusAt(centerline, u);
      const clearance = effRadius - wireRadius; // <= 0 表示触碰/受限

      // 碰撞/阻进逻辑
      if (du > 0 && clearance <= 0) {
        setCollision({ hit:true, clearance });
        overpushRef.current += 1; // 连续顶推计数
      } else {
        setCollision({ hit:false, clearance });
        overpushRef.current = Math.max(0, overpushRef.current - 0.5);
        if (du !== 0) {
          setU(prev => Math.max(0, Math.min(0.999, prev + du * 0.002)));
          if (state === RunState.Idle) setState(RunState.Navigating);
        }
      }

      // Fail 条件 & Success 条件
      if (overpushRef.current > 60 && state !== RunState.Success) setState(RunState.Fail);
      if (u > 0.995 && state === RunState.Navigating) setState(RunState.Success);

      // 动态重建导丝几何（按 u）
      const { wire, wireTip } = threeRef.current;
      if (wire && wireTip) {
        const pts = samplePolyline(centerline, Math.max(0.001, u), 80);
        const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x,p.y,p.z)));
        const newGeo = new THREE.TubeGeometry(curve, 160, wireRadius, 14, false);
        wire.geometry.dispose();
        wire.geometry = newGeo;

        const tipP = pts[pts.length-1];
        wireTip.position.set(tipP.x, tipP.y, tipP.z);
        wireTip.rotation.z = twist; // 可视化扭转
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [centerline, u, twist, state, paused, forwardSpeed, wireRadius, radiusAt]);

  // 向外层汇报进度与状态
  useEffect(() => { onProgress?.(u); }, [u, onProgress]);
  useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);

  // ===== UI（可留可去：独立演示模式下使用） =====
  const [selectedLine, setSelectedLine] = useState<"straight" | "curved">("curved");
  useEffect(() => { if (!centerlineProp) setSelectedLine("curved"); }, [centerlineProp]);
  const resetAll = () => { setState(RunState.Idle); setU(0); setTwist(0); setCollision({ hit:false, clearance:0 }); overpushRef.current = 0; };

  return (
    <div className="w-full h-[600px] relative rounded-2xl shadow-lg overflow-hidden bg-slate-900">
      {/* 独立演示工具条（集成到外壳后可移除） */}
      {!centerlineProp && (
        <div className="absolute top-3 left-3 z-20 flex gap-2 items-center">
          <select
            className="px-2 py-1 rounded bg-slate-800 text-slate-100 border border-slate-700"
            value={selectedLine}
            onChange={(e) => {
              const val = e.target.value as any;
              // 仅用于演示：切换内置中心线
              if (val === "straight") {
                (window as any).__demo_centerline__ = STRAIGHT;
              } else {
                (window as any).__demo_centerline__ = CURVED;
              }
              resetAll();
            }}
          >
            <option value="curved">Curved centerline</option>
            <option value="straight">Straight centerline</option>
          </select>
          <button onClick={resetAll} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white">Reset</button>
          <div className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-sm border border-slate-700">
            State: <span className="font-semibold text-slate-100">{state}</span>
          </div>
        </div>
      )}

      {/* Collision toast */}
      {collision.hit && (
        <div className="absolute top-3 right-3 z-20 px-3 py-2 rounded bg-rose-600 text-white shadow">
          Contact – advance blocked (clearance {collision.clearance.toFixed(2)})
        </div>
      )}

      {/* Success/Fail banner */}
      {state === RunState.Success && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded bg-emerald-600 text-white shadow text-lg font-semibold">Success ✓</div>
      )}
      {state === RunState.Fail && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded bg-rose-600 text-white shadow text-lg font-semibold">Failed ✗</div>
      )}

      {/* Help */}
      <div className="absolute bottom-3 left-3 z-20 text-slate-300 text-xs bg-slate-800/60 rounded px-2 py-1">
        Controls: W/S or ↑/↓ advance/withdraw · Q/E twist · Reset to restart
      </div>

      {/* Three.js mount */}
      <div ref={mountRef} className="absolute inset-0" />
    </div>
  );
};

export default WireDemo;
