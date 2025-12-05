// src/sim/interfaceAdapter.ts
import type { ParamsState } from "../state/paramsStore";
import type {
  ExperimentRecord,
  ExperimentMeta,
} from "./experimentSchema";

/**
 * 把当前面板里的 params 映射成一个 ExperimentRecord，
 * meta 由调用方传入（比如 id / timestamp / vesselModelKey 等）。
 */
export function paramsToExperiment(
  meta: ExperimentMeta,
  params: ParamsState["params"]
): ExperimentRecord {
  return {
    meta,
    source: "simulation",
    vessel: {
      innerDiameterMm: params.vessel.innerDiameter,
      elasticityMPa: params.vessel.elasticity,
    },
    blood: {
      flowVelocityCms: params.blood.flowVelocity,
      viscosityCp: params.blood.viscosity,
      pulsatility: params.blood.pulsatility,
    },
    guidewire: {
      diameterInch: params.guidewire.diameter,
      lengthCm: params.guidewire.length,
      stiffness: params.guidewire.stiffness,
    },
    friction: {
      catheterCoeff: params.friction.catheter,
      stentCoeff: params.friction.stent,
    },
    metrics: {
      forceN: params.display.force,
      pathPoints: params.display.pathPoints,
      iterations: params.display.iterations,
      attempts: params.display.attempts,
      patency01: params.display.patency,
    },
  };
}

/**
 * 把外部给你的 ExperimentRecord（例如模型算出来的结果）
 * 转回面板使用的 params 结构，方便写入 Zustand。
 */
export function experimentToParams(
  rec: ExperimentRecord
): ParamsState["params"] {
  return {
    vessel: {
      innerDiameter: rec.vessel.innerDiameterMm,
      elasticity: rec.vessel.elasticityMPa,
    },
    blood: {
      flowVelocity: rec.blood.flowVelocityCms,
      viscosity: rec.blood.viscosityCp,
      pulsatility: rec.blood.pulsatility,
    },
    guidewire: {
      diameter: rec.guidewire.diameterInch,
      length: rec.guidewire.lengthCm,
      stiffness: rec.guidewire.stiffness,
    },
    friction: {
      catheter: rec.friction.catheterCoeff,
      stent: rec.friction.stentCoeff,
    },
    display: {
      force: rec.metrics.forceN,
      pathPoints: rec.metrics.pathPoints,
      iterations: rec.metrics.iterations,
      attempts: rec.metrics.attempts,
      patency: rec.metrics.patency01,
    },
  };
}
