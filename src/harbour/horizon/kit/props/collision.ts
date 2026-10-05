/**
 * Prop collision parts (neighbourhoods/types.ts `PropRecord.collide`): plain JSON solids the bake turns into
 * `StructureSolid`s, matching what the prop kit draws (horizon-create rule: collision is what's drawn).
 *
 * INTEGRATOR NOTE: `CollisionPart` is owned by kit/buildings (E2). This file declares the identical type locally so the
 * prop kit builds on its own; once kit/buildings/index.ts exports it, replace this declaration with
 * `export type { CollisionPart } from '../buildings/index.ts';` (the shapes are the brief's, field for field).
 */
import type { StructureSolid } from '../../land/interfaces.ts';

export type CollisionRole = StructureSolid['role'];
export type CollisionPart =
  | { kind: 'box'; centre: [number, number]; size: [number, number]; yaw: number; bottom: number; top: number; role: CollisionRole; walkable: boolean; surface: string }
  | { kind: 'prism'; corners: [number, number, number][]; bottom: number; role: CollisionRole; walkable: boolean; surface: string };
