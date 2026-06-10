// Deterministic column/node layout for the flow diagram. Each stage is a
// column; its nodes are stacked top-aligned. Node positions are fixed so the
// SVG edge layer can draw straight curves between hit nodes.
import type { Stage } from '../types';

export const LAYOUT = {
  pad: 22,
  headerH: 48,
  headerGap: 16,
  colW: 158,
  colGap: 34,
  connectorW: 42,   // narrow slot for the Learning-model +/--> marker
  nodeH: 50,
  nodeGap: 8,
};

export interface Box { x: number; y: number; w: number; h: number; }

export interface GraphLayout {
  canvasW: number;
  canvasH: number;
  firstNodeY: number;
  stageBox: Map<string, Box>;
  nodeBox: Map<string, Box>;
}

export function computeLayout(stages: Stage[], showConnector = false): GraphLayout {
  const { pad, headerH, headerGap, colW, colGap, connectorW, nodeH, nodeGap } = LAYOUT;
  const stageBox = new Map<string, Box>();
  const nodeBox = new Map<string, Box>();
  const firstNodeY = pad + headerH + headerGap;
  let maxBottom = firstNodeY;

  // The connector (Learning model) is not a full column. It only claims a narrow
  // slot — widening the Embedding->Learning gap to host the +/--> marker — when
  // the selected paper fuses multiple embeddings; otherwise it collapses so that
  // gap matches every other inter-column gap.
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  let x = pad;
  for (const stage of ordered) {
    if (stage.connector) {
      const w = showConnector ? connectorW : 0;
      stageBox.set(stage.id, { x, y: pad, w, h: headerH });
      // markers share one row — only one is ever active for a given paper
      for (const n of stage.nodes) nodeBox.set(n.id, { x, y: firstNodeY, w, h: nodeH });
      if (showConnector) x += w + colGap;
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
