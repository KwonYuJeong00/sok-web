import { useState } from 'react';
import { cssVars } from '../lib/style';
import { stageColor } from '../lib/colors';
import { LAYOUT } from '../lib/layout';
import type { GraphLayout } from '../lib/layout';
import type { GEdge } from '../lib/edges';
import type { Stage, Paper } from '../types';
import { CategoryNodeView } from './CategoryNode';

interface Props {
  stages: Stage[];
  layout: GraphLayout;
  edges: GEdge[];
  paper: Paper | null;
  nodeColors: Map<string, string>;
}

export function PipelineGraph({ stages, layout, edges, paper, nodeColors }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const paperSelected = !!paper;

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <div className="graph-scroll" onClick={() => setOpenId(null)}>
      <div
        className="graph-canvas"
        style={{ width: layout.canvasW, height: layout.canvasH }}
      >
        {/* column bands */}
        {stages.filter((s) => !s.connector).map((s) => {
          const sb = layout.stageBox.get(s.id)!;
          return (
            <div
              key={`band-${s.id}`}
              className="stage-band"
              style={cssVars({
                left: sb.x, top: sb.y,
                width: sb.w, height: layout.canvasH - sb.y - LAYOUT.pad,
                '--stage-color': stageColor(s.id),
              })}
            />
          );
        })}

        {/* edge layer */}
        <svg className="edge-layer" width={layout.canvasW} height={layout.canvasH}>
          <defs>
            <marker id="bb-arrow" markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#c2c8d2" />
            </marker>
          </defs>
          {edges.map((e) => (
            <path
              key={e.id}
              d={e.d}
              className={`edge edge-${e.kind}`}
              style={e.color ? { stroke: e.color } : undefined}
              markerEnd={e.kind === 'backbone' ? 'url(#bb-arrow)' : undefined}
            />
          ))}
        </svg>

        {/* column headers */}
        {stages.filter((s) => !s.connector).map((s, idx) => {
          const sb = layout.stageBox.get(s.id)!;
          return (
            <div
              key={s.id}
              className="stage-header"
              style={cssVars({
                left: sb.x, top: sb.y, width: sb.w, height: sb.h,
                '--stage-color': stageColor(s.id),
              })}
            >
              <span className="stage-order">{idx + 1}</span>
              <span className="stage-name">{s.name}</span>
              {s.sequenceOnly && <span className="stage-only">sequence only</span>}
            </div>
          );
        })}

        {/* nodes */}
        {stages.map((s) =>
          s.nodes.map((n) => {
            // the connector marker only appears for a selected paper that uses it
            if (s.connector && !(paperSelected && nodeColors.has(n.id))) return null;
            const box = layout.nodeBox.get(n.id)!;
            return (
              <CategoryNodeView
                key={n.id}
                node={n}
                box={box}
                color={stageColor(s.id)}
                connector={s.connector}
                paperSelected={paperSelected}
                highlighted={nodeColors.has(n.id)}
                hitColor={nodeColors.get(n.id)}
                detail={paper?.nodeDetail[n.id]}
                expandable={s.expand && nodeColors.has(n.id)}
                expandLabel={s.expandLabel}
                detailLabel={s.detailLabel}
                reveal={paper?.nodeReveal[n.id]}
                open={openId === n.id}
                onToggle={() => toggle(n.id)}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
