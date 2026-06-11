import type { Stage, Paper } from '../types';
import type { GraphLayout, Box } from './layout';
import { LAYOUT } from './layout';
import { pathColor } from './colors';
import { computePathColorIndices } from './highlight';

export type EdgeKind = 'backbone' | 'trace';

export interface GEdge {
  id: string;
  d: string;
  kind: EdgeKind;
  color?: string;
}


function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/**
 * Returns the Y centre of path pi's colour strip on nodeId.
 *
 * Strips are stacked top-to-bottom in path-index order for all paths that
 * touch the node. Each strip occupies 1/N of the node height, so its centre
 * is at (stripIndex + 0.5) / N of the node height.
 * Falls back to the node centre when the node has only one touching path.
 */
function stripY(nodeId: string, stageId: string, pi: number, paper: Paper, box: Box): number {
  const touching = paper.pathNodeIds
    .map((paths, i) => ((paths[stageId] ?? []).includes(nodeId) ? i : null))
    .filter((x): x is number => x !== null);
  const idx = touching.indexOf(pi);
  const N = touching.length;
  if (N <= 1 || idx < 0) return box.y + box.h / 2;
  return box.y + box.h * (idx + 0.5) / N;
}

export function backboneEdges(stages: Stage[], layout: GraphLayout): GEdge[] {
  const ordered = [...stages].sort((a, b) => a.order - b.order).filter((s) => !s.connector);
  const edges: GEdge[] = [];
  const hy = LAYOUT.pad + LAYOUT.headerH / 2;
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = layout.stageBox.get(ordered[i].id);
    const b = layout.stageBox.get(ordered[i + 1].id);
    if (!a || !b) continue;
    edges.push({ id: `bb-${i}`, d: curve(a.x + a.w, hy, b.x, hy), kind: 'backbone' });
  }
  return edges;
}

export function paperTraceEdges(
  paper: Paper,
  stages: Stage[],
  layout: GraphLayout,
): GEdge[] {
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const pathColorIdxs = computePathColorIndices(paper, stages);

  // Collect one entry per (path, source→dest pair). Keyed with \x00 which
  // cannot appear in cleaned CSV values, so it is safe as a separator.
  type PairEntry = { aId: string; bId: string; stageFromId: string; stageToId: string; items: Array<{ color: string; pi: number }> };
  const pairMap = new Map<string, PairEntry>();

  paper.pathNodeIds.forEach((perStage, pi) => {
    const active = ordered.filter((s) => (perStage[s.id] || []).length > 0);
    for (let i = 0; i < active.length - 1; i++) {
      const from = active[i];
      const to = active[i + 1];
      const color = pathColor(pathColorIdxs[pi]);

      for (const aId of perStage[from.id]) {
        for (const bId of perStage[to.id]) {
          const key = `${aId}\x00${bId}`;
          if (!pairMap.has(key)) {
            pairMap.set(key, { aId, bId, stageFromId: from.id, stageToId: to.id, items: [] });
          }
          const entry = pairMap.get(key)!;
          if (!entry.items.some(e => e.pi === pi)) {
            entry.items.push({ color, pi });
          }
        }
      }
    }
  });

  const edges: GEdge[] = [];
  let seq = 0;

  for (const { aId, bId, stageFromId, stageToId, items } of pairMap.values()) {
    const A = layout.nodeBox.get(aId);
    const B = layout.nodeBox.get(bId);
    if (!A || !B) continue;

    for (const { color, pi } of items) {
      const yA = stripY(aId, stageFromId, pi, paper, A);
      const yB = stripY(bId, stageToId, pi, paper, B);
      edges.push({
        id: `tr-${paper.id}-${seq++}`,
        d: curve(A.x + A.w, yA, B.x, yB),
        kind: 'trace',
        color,
      });
    }
  }

  return edges;
}
