// Per-paper node highlight colours, shared by the cells (PipelineGraph) and
// the trace edges (edges.ts) so a flow and its cells always match.
//
// Rule for a node a selected paper touches:
//   * touched by >1 input path  -> neutral slate (a true merge point of the
//     paper's parallel `|` inputs).
//   * otherwise                 -> a colour by the node's order within its
//     column. Several cells lit in one column (e.g. a paper whose single input
//     fuses 4 `;`-separated artifact classes) therefore get distinct colours,
//     while a clean `|`-split paper keeps one colour per path across every
//     column (position index == path index when each path lights one cell).
import { pathColor } from './colors';
import type { Paper, Stage } from '../types';

export function computeNodeColors(paper: Paper, stages: Stage[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const s of stages) {
    // highlighted nodes of this column, in path order then `;`-branch order
    const ordered: string[] = [];
    for (const per of paper.pathNodeIds) {
      for (const id of per[s.id] || []) if (!ordered.includes(id)) ordered.push(id);
    }
    // distinct colour per cell in the column; a clean |-split paper keeps one
    // colour per path across columns (position index == path index there).
    ordered.forEach((id, i) => colors.set(id, pathColor(i)));
  }
  return colors;
}
