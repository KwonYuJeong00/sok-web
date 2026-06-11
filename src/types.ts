// Shared types — mirror the output of scripts/normalize-data.mjs.

export interface NormalizedData {
  meta: Meta;
  stages: Stage[];
  papers: Paper[];
  sidebar: SidebarSchemeGroup[];
}

export interface Meta {
  title: string;
  description: string;
  paperCount: number;
  domainCount: number;
  stageCount: number;
  maxPaths: number;
  generatedAt: string;
  primarySource: string;
}

/** A pipeline stage = one column of the flow diagram. */
export interface Stage {
  id: string;
  name: string;
  order: number;
  perPath: boolean;       // per-input-path column vs shared (fused) tail
  expand: boolean;        // hit nodes reveal a secondary value on click
  expandLabel: string;
  detailLabel: string;    // popup label for the inline detail value (e.g. Inference subcategory)
  sequenceOnly: boolean;  // tokenization — applies to sequence inputs only
  connector: boolean;     // the Combine merge column
  nodes: CategoryNode[];  // every possible entry for this column
}

export interface CategoryNode {
  id: string;             // `${stageId}::${label}`
  stageId: string;
  label: string;
  paperCount: number;
  transient?: boolean;
}

export interface Paper {
  id: string;
  did: string;
  title: string;
  domain: string;
  scheme: string;
  tier: string;
  inferenceType: string;
  conference: string;
  year: string;
  isTopTier: boolean;
  codeForm: string;
  pathCount: number;
  relationship: string;
  forClaude: string;
  learningCategory: string;
  learningSubcategory: string;
  learningModel: string;
  inferenceCategory: string;
  inferenceSubcategory: string;
  inferenceOutput: string;
  evaluationMetric: string;
  /** one entry per input path: stageId -> node ids this path touches. */
  pathNodeIds: Record<string, string[]>[];
  /** node id -> reveal (click-to-expand) value(s), separators preserved. */
  nodeReveal: Record<string, string[]>;
  /** node id -> default detail line(s) shown inside the hit node. */
  nodeDetail: Record<string, string[]>;
}

export interface SidebarPaperRef {
  id: string;
  title: string;
  venue: string;
  did: string;
  isTopTier: boolean;
}
export interface SidebarDomain {
  id: string;
  name: string;
  tier: string;
  inferenceType: string;
  paperCount: number;
  papers: SidebarPaperRef[];
}
export interface SidebarSchemeGroup {
  scheme: string;
  domains: SidebarDomain[];
}

export type Selection = { kind: 'none' } | { kind: 'paper'; paperId: string };

export interface FilterState {
  query: string;
}
