import { create } from "zustand";
import type * as THREE from "three";

type CatalogItem = { key: string; name: string; url: string };

type VesselState = {
  catalog: CatalogItem[];
  currentKey: string | null;
  setCatalog: (c: CatalogItem[]) => void;
  setCurrent: (k: string) => void;
  loadedMap: Record<string, THREE.Group | null>;
  setLoaded: (k: string, g: THREE.Group) => void;
};

export const useVesselStore = create<VesselState>((set) => ({
  catalog: [],
  currentKey: null,
  setCatalog: (catalog) => set({ catalog }),
  setCurrent: (currentKey) => set({ currentKey }),
  loadedMap: {},
  setLoaded: (k, g) =>
    set((s) => ({ loadedMap: { ...s.loadedMap, [k]: g } })),
}));
