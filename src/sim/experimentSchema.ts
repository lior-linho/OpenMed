// src/sim/experimentSchema.ts

export type DataSource = "simulation" | "phantom" | "clinical";

export interface VesselParamsExt {
  innerDiameterMm: number;   // 血管内径 (mm)
  elasticityMPa: number;     // 弹性模量 E (MPa)
}

export interface BloodParamsExt {
  flowVelocityCms: number;   // 血流速度 (cm/s)
  viscosityCp: number;       // 黏度 (cP)
  pulsatility: number;       // 0–1
}

export interface GuidewireParamsExt {
  diameterInch: number;      // 导丝直径 (inch)
  lengthCm: number;          // 导丝长度 (cm)
  stiffness: number;         // 刚度（无量纲）
}

export interface FrictionParamsExt {
  catheterCoeff: number;     // 导管摩擦系数
  stentCoeff: number;        // 支架摩擦系数
}

export interface SimulationMetrics {
  forceN: number;            // 力 (N)
  pathPoints: number;        // 路径点数
  iterations: number;        // 迭代步
  attempts: number;          // 尝试次数
  patency01: number;         // 通畅度 (0–1)
}

export interface ExperimentMeta {
  id: string;                // 实验/仿真 ID
  timestamp: string;         // ISO 时间
  operator?: string;         // 操作者
  vesselModelKey?: string;   // 使用的血管模型 key (cta_aorta 等)
  note?: string;             // 备注
}

export interface ExperimentRecord {
  meta: ExperimentMeta;
  source: DataSource;
  vessel: VesselParamsExt;
  blood: BloodParamsExt;
  guidewire: GuidewireParamsExt;
  friction: FrictionParamsExt;
  metrics: SimulationMetrics;
}
