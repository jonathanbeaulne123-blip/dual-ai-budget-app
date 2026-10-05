/**
 * Prop collision parts (neighbourhoods/types.ts `PropRecord.collide`): plain JSON solids the bake turns into
 * `StructureSolid`s, matching what the prop kit draws (horizon-create rule: collision is what's drawn).
 *
 */
import type { StructureSolid } from '../../land/interfaces.ts';

export type CollisionRole = StructureSolid['role'];
export type { CollisionPart } from '../buildings/index.ts';
// shape owned by kit/buildings (E2)
