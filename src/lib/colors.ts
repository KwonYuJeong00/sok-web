// Two colour dimensions:
//   * stage hue — a thin per-column accent (academic, muted).
//   * path colour — distinguishes the parallel input lanes of a multi-input
//     paper. The same lane keeps its colour across every stage (requirement 11).

const STAGE_COLORS: Record<string, string> = {
  analysis:         '#475569', // slate-600
  'artifact-class': '#1d4ed8', // blue-700
  'artifact-form':  '#0369a1', // sky-700
  canonicalization: '#0f766e', // teal-700
  tokenization:     '#15803d', // green-700
  encoding:         '#a16207', // yellow-700
  embedding:        '#c2410c', // orange-700
  combine:          '#57534e', // stone-600
  learning:         '#b91c1c', // red-700
  inference:        '#86198f', // fuchsia-800
};

// Distinct colours for the cells lit within a single column (parallel `|`
// inputs and/or `;`-separated branches). Wide enough for the busiest column.
const PATH_COLORS = [
  '#2563eb', // blue-600
  '#ea580c', // orange-600
  '#059669', // emerald-600
  '#9333ea', // purple-600
  '#db2777', // pink-600
  '#0891b2', // cyan-600
  '#ca8a04', // amber-600
  '#4338ca', // indigo-700
];

const SCHEME_COLORS: Record<string, string> = {
  Foundation:  '#0f766e',
  Application: '#1d4ed8',
  Others:      '#57534e',
};

export function stageColor(stageId: string): string {
  return STAGE_COLORS[stageId] ?? '#475569';
}
export function pathColor(index: number): string {
  return PATH_COLORS[index % PATH_COLORS.length];
}
export function schemeColor(scheme: string): string {
  return SCHEME_COLORS[scheme] ?? '#78716c';
}
