// SVG edges for the flow diagram:
//   * backbone — faint connectors between consecutive column headers.
//   * trace    — per-path curves between the hit nodes of one column and the
//     next non-empty column. Coloured by input path (consistent across the
//     pipeline); the shared tail (Combine -> Learning -> Inference) is neutral.
import type { Stage, Paper } from '../types';
import type { GraphLayout } from './layout';
import { LAYOUT } from './layout';

export type EdgeKind = 'backbone' | 'trace';

export interface GEdge {
  id: string;
  d: string;
  kind: EdgeKind;
  color?: string;
}

const SHARED_EDGE = '#94a3b8'; // slate-400

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function backboneEdges(stages: Stage[], layout: GraphLayout): GEdge[] {
  // skip the connector — its slot has no header, so the backbone joins the
  // real columns directly (Embedding -> Learning across the marker gap).
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
  nodeColors: Map<string, string>,
): GEdge[] {
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const edges: GEdge[] = [];
  const seen = new Set<string>();

  paper.pathNodeIds.forEach((perStage, pi) => {
    // ordered list of columns this path actually touches
    const active = ordered.filter((s) => (perStage[s.id] || []).length > 0);
    for (let i = 0; i < active.length - 1; i++) {
      const from = active[i];
      const to = active[i + 1];
      for (const aId of perStage[from.id]) {
        // an edge takes the colour of the cell it leaves (matches the nodes)
        const color = nodeColors.get(aId) ?? SHARED_EDGE;
        for (const bId of perStage[to.id]) {
          const key = `${aId}>${bId}>${color}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const A = layout.nodeBox.get(aId);
          const B = layout.nodeBox.get(bId);
          if (!A || !B) continue;
          edges.push({
            id: `tr-${paper.id}-${pi}-${i}-${aId}-${bId}`,
            d: curve(A.x + A.w, A.y + A.h / 2, B.x, B.y + B.h / 2),
            kind: 'trace',
            color,
          });
        }
      }
    }
  });
  return edges;
}
