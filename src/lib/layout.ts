// Deterministic column/node layout for the flow diagram. Each stage is a
// column; its nodes are stacked top-aligned. Node positions are fixed so the
// SVG edge layer can draw straight curves between hit nodes.
import type { Stage } from '../types';

export const LAYOUT = {
  pad: 24,
  headerH: 48,
  headerGap: 20,
  colW: 180,
  colGap: 49,
  connectorW: 53,   // narrow slot for the Learning-model +/--> marker
  nodeH: 90,
  nodeGap: 10,
};

export interface Box { x: number; y: number; w: number; h: number; }

export interface GraphLayout {
  canvasW: number;
  canvasH: number;
  firstNodeY: number;
  stageBox: Map<string, Box>;
  nodeBox: Map<string, Box>;
}

export function computeLayout(stages: Stage[], connectorCount = 0): GraphLayout {
  const { pad, headerH, headerGap, colW, colGap, connectorW, nodeH, nodeGap } = LAYOUT;
  const stageBox = new Map<string, Box>();
  const nodeBox = new Map<string, Box>();
  const firstNodeY = pad + headerH + headerGap;
  let maxBottom = firstNodeY;

  // Connector stages (Learning model +/-->) only claim their narrow slot when
  // the selected paper uses them. connectorCount says how many are visible.
  // combine = index 0, combine_1 = index 1.
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  let x = pad;
  for (const stage of ordered) {
    if (stage.connector) {
      const idx = stage.id === 'combine' ? 0 : stage.id === 'combine_1' ? 1 : 99;
      const show = idx < connectorCount;
      const w = show ? connectorW : 0;
      stageBox.set(stage.id, { x, y: pad, w, h: headerH });
      if (show) {
        // Single connector: widen the node box to span the full embedding→learning
        // gap so CSS flex-centering places the pill at the true midpoint of the gap.
        // Multiple connectors (P095): keep narrow boxes to avoid overlap.
        const nodeW = connectorCount === 1 ? colGap + w + colGap : w;
        const nodeX = connectorCount === 1 ? x - colGap : x;
        for (const n of stage.nodes) nodeBox.set(n.id, { x: nodeX, y: firstNodeY, w: nodeW, h: nodeH });
      } else {
        for (const n of stage.nodes) nodeBox.set(n.id, { x, y: firstNodeY, w: 0, h: nodeH });
      }
      if (show) x += w + colGap;
      continue;
    }
    stageBox.set(stage.id, { x, y: pad, w: colW, h: headerH });
    let cy = firstNodeY;
    for (const n of stage.nodes) {
      nodeBox.set(n.id, { x, y: cy, w: colW, h: nodeH });
      cy += nodeH + nodeGap;
    }
    maxBottom = Math.max(maxBottom, cy);
    x += colW + colGap;
  }

  const canvasW = x - colGap + pad;
  const canvasH = maxBottom + pad - nodeGap;
  return { canvasW, canvasH, firstNodeY, stageBox, nodeBox };
}
