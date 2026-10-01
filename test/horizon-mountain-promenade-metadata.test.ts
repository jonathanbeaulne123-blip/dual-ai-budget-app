/** Route ownership only: these assertions do not certify ordinary walking access.
 * The existing west stair water and east ground/path failures remain separate evidence. */
import { describe, expect, it } from 'vitest';
import { mountainV2Promenade } from '../src/harbour/horizon/land/mountainV2/beds';
import V2 from '../src/harbour/horizon/land/mountainV2/v2-data.json';
import { MOUNTAIN_PATH_GRAPH } from '../src/harbour/mountain/definition';
import { regionPathGraph } from '../src/harbour/horizon/regions/mountainV2/graph';
import { toHorizonXYZ } from '../src/harbour/horizon/regions/mountainV2/placement';

describe('dam crest metadata uses the native route, without an undrawn road chord', () => {
  it('keeps every native crest point, source width and region ownership', () => {
    const source = MOUNTAIN_PATH_GRAPH.edges.find(e => e.id === 'promenade:dam-crest')!;
    const exported = V2.nativePlanning.walks.find(e => e.id === source.id)!;
    const actual = mountainV2Promenade();
    expect(actual.points).toEqual(exported.points);
    expect(actual.points.length).toBe(source.points.length);
    // Six-decimal export precision is a mapping assertion, never a physical clearance tolerance.
    source.points.forEach((p, i) => toHorizonXYZ(p).forEach((v, k) => {
      expect(Math.abs(actual.points[i]![k]! - v)).toBeLessThanOrEqual(.000000501);
    }));
    expect(actual.width).toBe(source.halfWidth * 2);
    expect(actual.surface).toBe('paved');
    expect(actual.terrainCut).toBe(false);
    expect(actual.structureIds).toEqual([]);
    expect(actual.carried).toEqual([actual.points.map(p => [p[0], p[2]])]);
    expect(actual.terrainExclusions).toHaveLength(actual.points.length);
    // The route ends at the native abutment, with no nearest-road continuation.
    expect(actual.points.at(-1)).toEqual(exported.points.at(-1));
  });

  it('retains all native graph edges, including both real dam approaches', () => {
    const graph = regionPathGraph();
    expect(graph.edges).toHaveLength(MOUNTAIN_PATH_GRAPH.edges.length);
    for (const source of MOUNTAIN_PATH_GRAPH.edges) {
      const actual = graph.edges.find(e => e.id === `v2:${source.id}`)!;
      expect(actual.from).toBe(`v2:${source.from}`);
      expect(actual.to).toBe(`v2:${source.to}`);
      expect(actual.points).toEqual(source.points.map(toHorizonXYZ));
      expect(actual.halfWidth).toBe(source.halfWidth);
    }
    const west = graph.edges.find(e => e.id === 'v2:stair:dam-west-steps')!;
    const east = graph.edges.find(e => e.id === 'v2:path:dam:east~door:pavilion')!;
    const station = graph.edges.find(e => e.id === 'v2:path:station:funicular:reservoir~dam:east')!;
    expect(west.to).toBe('v2:dam:west');
    expect(east.from).toBe('v2:dam:east');
    expect(station.to).toBe('v2:dam:east');
  });
});
