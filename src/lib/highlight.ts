import { pathColor } from './colors';
import type { Paper, Stage } from '../types';

/**
 * Returns the color index for each path.
 *
 * Paths are first sorted by their artifact-form node's position in the stage
 * list (Sequence < Graph < Numeric descriptor < Image), then by path index as
 * a tiebreaker for same-artifact-form paths. Sequential color indices 0,1,2…
 * are assigned in that order, so:
 *   - A paper with Sequence+Graph+Numeric always yields blue/orange/green.
 *   - A paper with 4× Numeric descriptor yields 4 distinct colors (blue,
 *     orange, green, purple) rather than all-green.
 */
export function computePathColorIndices(paper: Paper, stages: Stage[]): number[] {
  const afStage = stages.find(s => s.id === 'artifact-form');
  const afOrder = new Map<string, number>();
  afStage?.nodes.forEach((n, i) => afOrder.set(n.id, i));

  const afKeys = paper.pathNodeIds.map((pathNodes, pi) => {
    const afNodes = pathNodes['artifact-form'] ?? [];
    const idxs = afNodes
      .map(id => afOrder.get(id))
      .filter((i): i is number => i !== undefined);
    return { pi, afKey: idxs.length > 0 ? Math.min(...idxs) : pi };
  });

  // Sort by (afKey, original path index) and assign sequential color indices.
  const sorted = [...afKeys].sort((a, b) => a.afKey - b.afKey || a.pi - b.pi);
  const colorIdxMap = new Map<number, number>();
  sorted.forEach(({ pi }, colorIdx) => colorIdxMap.set(pi, colorIdx));

  return paper.pathNodeIds.map((_, pi) => colorIdxMap.get(pi) ?? pi);
}

export function computeNodeColors(paper: Paper, stages: Stage[]): Map<string, string> {
  const colors = new Map<string, string>();
  const pathColorIdxs = computePathColorIndices(paper, stages);

  for (const s of stages) {
    const nodePathIndices = new Map<string, number[]>();
    for (let i = 0; i < paper.pathNodeIds.length; i++) {
      for (const id of paper.pathNodeIds[i][s.id] || []) {
        if (!nodePathIndices.has(id)) nodePathIndices.set(id, []);
        nodePathIndices.get(id)!.push(i);
      }
    }
    for (const [id, indices] of nodePathIndices) {
      colors.set(id, pathColor(pathColorIdxs[indices[0]]));
    }
  }
  return colors;
}
