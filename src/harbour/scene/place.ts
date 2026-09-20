import type * as THREE from "three";
export type Anchor = { id: string; position: THREE.Vector3; zone: "queen"|"piece"|"prop"|"gate"; label: string; target?: string };
export type Region = { id: string; box: THREE.Box3 };
export type Pose = { target: [number,number,number]; r: number; theta: number; phi: number };
export interface PlaceHandle { group: THREE.Group; update(reading: unknown): void; animate(t: number, dt: number): boolean; dispose(): void; anchors(): Anchor[]; poses(): Record<string, Pose>; regions(): Region[] }
export interface Place { id: string; build(scene: THREE.Scene, dressing: unknown, reading: unknown, quality: "full"|"lite"): Promise<PlaceHandle> | PlaceHandle }
