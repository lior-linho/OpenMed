// src/components/DualViewPage.tsx

import React, { useEffect } from "react";

import {
  getCenterlineForVessel,
  VesselId,
} from "../../assets/vessels/centerlines";

import { useVesselStore } from "../store/vesselStore";

import View3D from "../components/View3D";
import View2D from "../components/View2D";

import ParameterPanel from "./ParameterPanel";
import "../styles/dualview.css";

type DualViewPageProps = {
  vesselId: VesselId;                     // 当前选中的血管 ID（来自上层）
  onVesselChange: (id: VesselId) => void; // 当内部切换模型时，通知上层
};

const models = [
  { key: "cta_aorta",    name: "CTA Aorta",    url: "/assets/vessels/cta_aorta.glb" },
  { key: "coronary_lad", name: "Coronary LAD", url: "/assets/vessels/coronary_LAD.glb" },
  { key: "renal_demo",   name: "Renal Demo",   url: "/assets/vessels/renal_demo.glb" },
];

export default function DualViewPage({ vesselId, onVesselChange }: DualViewPageProps) {
  const setCatalog = useVesselStore((s) => s.setCatalog);
  const currentKey = useVesselStore((s) => s.currentKey);
  const setCurrent = useVesselStore((s) => s.setCurrent);

  // 把可选模型列表同步进全局 store
  useEffect(() => {
    setCatalog(models);
  }, [setCatalog]);

  // 如果上层给了 vesselId，而 store 里还没有 currentKey，就用上层的
  useEffect(() => {
    if (!currentKey && vesselId) {
      setCurrent(vesselId);
    }
  }, [currentKey, vesselId, setCurrent]);

  useEffect(() => {
    if (currentKey && currentKey !== vesselId) {
      onVesselChange(currentKey as VesselId);
    }
  }, [currentKey, vesselId, onVesselChange]);

  const effectiveId: VesselId = (currentKey as VesselId) || vesselId;

  const centerline = getCenterlineForVessel(effectiveId);
  console.log(
    "[DualView] centerline len =",
    centerline?.length,
    "for",
    effectiveId
  );

  return (
    <div className="dv-root">
      {/* 顶部工具栏：模型选择 */}
      <div className="dv-toolbar">
        <label>Vessel Model:</label>
        <select
          value={currentKey || ""}
          onChange={(e) => setCurrent(e.target.value as VesselId)}
        >
          {models.map((m) => (
            <option key={m.key} value={m.key}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* 三栏布局：3D | 2D | 参数面板 */}
      <div className="dv-main-grid">
        <div className="dv-pane">
          <View3D centerline={centerline} />
        </div>

        <div className="dv-pane">
          <View2D centerline={centerline} />
        </div>

        <div className="dv-params">
          <ParameterPanel />
        </div>
      </div>
    </div>
  );
}
