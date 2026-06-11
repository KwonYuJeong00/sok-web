// scripts/normalize-data.mjs
//
// Generates src/data/normalizedData.json from the CSV files in source/.
//
//   * Primary source : source/ai_pipeline_final_sheet.csv  (one row per paper)
//   * Domain metadata: source/taxonomy definitions/domain_definition.csv
//
// The website draws a FLOW DIAGRAM: every stage (column) lists all of its
// possible entries as nodes (e.g. the 9 Artifact-class nodes). Selecting a
// paper highlights the nodes it touches and connects them with edges from one
// column to the next — a left-to-right path through the pipeline.
//
//   * A paper may have several parallel input paths — the CSV separates them
//     with `|`. Path count is driven by `Artifact form`; other per-path
//     columns are aligned to it. Each path becomes a colour-coded flow that
//     fuses into the shared tail (Combine -> Learning -> Inference).
//   * `;` and `->` inside a cell are never split — only `|`. Raw cell text is
//     preserved for the click-to-expand reveal.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'source');
const OUT_DIR = path.join(ROOT, 'src', 'data');
const OUT = path.join(OUT_DIR, 'normalizedData.json');

/* ------------------------------ CSV core ------------------------------- */
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// The sheet's column names drift over time; map known aliases back to the
// logical names the code uses so a rename in the source doesn't silently break
// a stage. (e.g. "Artifact" -> "Analysis Artifact", "Tokenization_Unit" -> "Token Unit".)
const COLUMN_ALIASES = {
  'Analysis Artifact': 'Artifact',
  'Token Unit': 'Tokenization_Unit',
};

function readTable(relPath) {
  const full = path.join(SRC, relPath);
  if (!fs.existsSync(full)) throw new Error(`Missing source file: source/${relPath}`);
  const raw = parseCSV(fs.readFileSync(full, 'utf8')).filter((r) =>
    r.some((c) => c.trim() !== ''),
  );
  const header = raw[0].map((h) => { const t = h.trim(); return COLUMN_ALIASES[t] || t; });
  const rows = raw.slice(1).map((r) => header.map((_, i) => (r[i] ?? '').trim()));
  return { header, rows };
}
const asObjects = (t) =>
  t.rows.map((r) => Object.fromEntries(t.header.map((h, i) => [h, r[i] ?? ''])));

/* ----------------------------- helpers --------------------------------- */
const SKIP = new Set(['', 'n/a', 'na', 'none', '-', '—']);
const isSkip = (v) => !v || SKIP.has(String(v).trim().toLowerCase());
const clean = (v) => (v == null ? '' : String(v).trim());
// Split on a single `|` (the input-lane separator). A doubled `||` is content
// (e.g. "LDP || BoostNE", a logical-or) — never a lane boundary — so keep it.
const splitLanes = (cell) => (!cell ? [] : String(cell).split(/(?<!\|)\|(?!\|)/).map((s) => s.trim()));
const splitMulti = (v) =>
  !v ? [] : String(v).split(/[|;]/).map((s) => s.trim()).filter((s) => s && !isSkip(s));

const phaseOf = (s) => {
  const i = s.indexOf('>');
  return (i >= 0 ? s.slice(0, i) : s).trim();
};
const goalOf = (s) => {
  const i = s.indexOf('>');
  return i >= 0 ? s.slice(i + 1).trim() : '';
};
// Parse an Analysis cell into [phase, goal] pairs. A segment with no phase prefix
// (e.g. "Static > Disassembly; Call-site analysis") is treated as a further goal
// of the preceding phase so its detail isn't dropped.
function phaseGoals(text) {
  const pairs = [];
  let last = '';
  for (const seg of String(text).split(/[|;]/)) {
    if (isSkip(seg)) continue;
    const ph = normPhase(phaseOf(seg));
    if (ph) { last = ph; pairs.push([ph, goalOf(seg)]); }
    else if (last) pairs.push([last, clean(seg)]);
  }
  return pairs;
}

/** Pick the value for lane `i`, aligning a cell to the lane count. */
function alignLane(cell, i, pathCount) {
  const c = clean(cell);
  if (!c) return '';
  if (pathCount <= 1) return c;
  const parts = splitLanes(c);
  if (parts.length <= 1) return c;
  return clean(parts[i] ?? parts[parts.length - 1]);
}

/* -------- value -> canonical node label normalisers -------------------- */
function normPhase(p) {
  const s = clean(p).toLowerCase().replace(/\[[^\]]*\]/g, '').trim();
  if (!s) return '';
  if (s.includes('triage')) return 'Triage';
  if (s.includes('static') || s.includes('satic')) return 'Static';
  if (s.includes('dynamic')) return 'Dynamic';
  if (s.includes('security testing') || s.includes('fuzz')) return 'Security Testing';
  if (s.includes('hybrid')) return 'Hybrid';
  return '';
}

const CLASS_MATCHERS = [
  ['code represent', 'Code representation'],
  ['text stream', 'Text stream'],
  ['graph represent', 'Graph representation'],
  ['binary fact', 'Binary fact'],
  ['numeric', 'Numerical statistic'],
  ['snapshot', 'Snapshot'],
  ['logical express', 'Logical expression'],
  ['test set', 'Test set'],
];
function normClass(seg) {
  const s = clean(seg).toLowerCase();
  if (isSkip(s)) return '';
  for (const [needle, canonical] of CLASS_MATCHERS) if (s.includes(needle)) return canonical;
  return clean(seg);
}

function normForm(f) {
  const s = clean(f).toLowerCase();
  if (isSkip(s)) return '';
  if (s.startsWith('seq')) return 'Sequence';
  if (s.startsWith('graph') || s.startsWith('grp')) return 'Graph';
  if (s.startsWith('num')) return 'Numeric descriptor';
  if (s.startsWith('image')) return 'Image';
  return clean(f);
}

function canonShort(raw) {
  const c = clean(raw);
  if (isSkip(c)) return '';
  const last = (c.split(/\s+/).filter(Boolean).pop() || '').toLowerCase().replace(/[^a-z]/g, '');
  if (last.startsWith('scal')) return 'Scale';
  if (last.startsWith('replac')) return 'Replace';
  if (last.startsWith('remov')) return 'Remove';
  if (last.startsWith('map')) return 'Map';
  if (last.startsWith('transform')) return 'Transform';
  if (last.startsWith('extract')) return 'Extract';
  return '';
}

function normTokUnit(u) {
  const s = clean(u).toLowerCase();
  if (isSkip(s) || s.length <= 1) return '';
  if (s.includes('byte pair') || s === 'bpe' || s.includes('(bpe')) return 'Subword (Byte Pair Encoding)';
  if (s.includes('pretrained')) return 'Subword (Pretrained-LLM)';
  if (s.startsWith('byte')) return 'Byte';
  if (s.includes('opcode') || s.startsWith('instruction')) return 'Instruction';
  if (s === 'element') return 'Element';
  if (s === 'sub-token') return 'Sub-token';
  if (s === 'sub-element') return 'Sub-element';
  if (s.includes('trace event')) return 'Trace event';
  if (s.includes('layout-field')) return 'Layout-field token';
  return clean(u);
}

function normSplitBasis(v) {
  const s = clean(v).toLowerCase();
  if (isSkip(s) || s === 'n' || s === 'a') return '';
  if (s.startsWith('atomic')) return 'Atomic unit';
  if (s.startsWith('data-driven')) return 'Data-driven segmentation';
  if (s.startsWith('rule-based')) return 'Rule-based decomposition';
  if (s.startsWith('syntactic')) return 'Syntactic unit';
  return clean(v);
}

function normEncoding(v) {
  const s = clean(v).toLowerCase();
  if (s.startsWith('dense')) return 'Dense';
  if (s.startsWith('sparse')) return 'Sparse';
  return '';
}
function normEmbedding(v) {
  const s = clean(v).toLowerCase();
  if (s.includes('independent') || s.includes('non-context')) return 'Context-independent';
  if (s.includes('dependent') || s.includes('contextual')) return 'Context-dependent';
  return '';
}
function combineRelationship(learningModel) {
  const lm = clean(learningModel);
  if (!lm) return '';
  if (/\|\|/.test(lm)) return '+';
  if (/-->|->|→|⇒|⟶/.test(lm)) return '-->';
  if (/\+|⊕/.test(lm)) return '+';
  return '';
}

/* -------- FC expression parser and connector graph builder -------------- */
// Parses an embedding-relationship expression such as
//   "(BiLSTM -> GGNN) || H-LSTM || I-LSTM"
//   "(LDP || BoostNE) -> Autoencoder"
//   "((BERT -> GCN) -> ResNet)"
// into an AST of { t:'||'|'->'|'L', c:[...], n:string }.
// Operator precedence: '->' binds tighter than '||' (like multiplication > addition).
class FCParser {
  constructor(str) {
    this.s = str.trim().replace(/→|⇒|⟶/g, '->').replace(/-->/g, '->');
    this.i = 0;
  }
  _ws() { while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++; }
  parse() { return this._par(); }
  // parallel: lowest precedence, N-ary, left-associative
  _par() {
    const ch = [this._seq()];
    while (true) {
      this._ws();
      if (this.s.startsWith('||', this.i)) { this.i += 2; ch.push(this._seq()); }
      else break;
    }
    return ch.length === 1 ? ch[0] : { t: '||', c: ch };
  }
  // sequential: higher precedence, binary left-associative
  _seq() {
    let left = this._atom();
    while (true) {
      this._ws();
      if (this.s.startsWith('->', this.i)) {
        this.i += 2;
        const right = this._atom();
        left = { t: '->', c: [left, right] };
      } else break;
    }
    return left;
  }
  _atom() {
    this._ws();
    if (this.i < this.s.length && this.s[this.i] === '(') {
      this.i++;
      const inner = this._par();
      this._ws();
      if (this.i < this.s.length && this.s[this.i] === ')') this.i++;
      return inner;
    }
    let name = '';
    while (this.i < this.s.length) {
      if (this.s.startsWith('||', this.i) || this.s.startsWith('->', this.i) ||
          this.s[this.i] === '(' || this.s[this.i] === ')') break;
      name += this.s[this.i++];
    }
    return { t: 'L', n: name.trim() };
  }
}

function fcLeaves(node) {
  if (node.t === 'L') return [node.n];
  return node.c.flatMap(fcLeaves);
}

// Build a connector graph from a parsed FC expression and the paper's pathCount.
// If the leaf count exactly matches pathCount the full tree is used; otherwise a
// single-connector fallback based on the top-level operator is returned.
//
// Returns { connectors, pathConnectors, terminalPaths } where:
//   connectors      – ordered list of { id, type, skipPath } specs
//   pathConnectors  – per-path list of connector ids that path touches
//   terminalPaths   – which paths are also assigned learning/inference
const _CONN_IDS = ['combine', 'combine_1', 'combine_2'];

function buildConnectorGraph(ast, pathCount) {
  if (!ast || pathCount < 2) return null;

  const leaves = fcLeaves(ast);

  // ---- full-tree path when leaves exactly match emb column entries ----
  if (leaves.length === pathCount) {
    // Assign left-to-right path indices to leaf nodes
    let pidx = 0;
    function assignIdx(node) {
      if (node.t === 'L') { node.pi = pidx++; return; }
      for (const c of node.c) assignIdx(c);
    }
    assignIdx(ast);

    const connectors = [];
    const pathConns = Array.from({ length: pathCount }, () => []);
    let ci = 0;

    // Returns { rightmost: pathIdx, isLeaf: bool }
    function proc(node) {
      if (node.t === 'L') return { rightmost: node.pi, isLeaf: true };
      const crs = node.c.map(c => proc(c));
      if (ci >= _CONN_IDS.length) throw new Error('too many connectors');
      const connId = _CONN_IDS[ci++];
      const type = node.t;
      // For '->': if the left child is a single leaf the right child is the
      // "processor" whose embedding does not draw an edge to this connector.
      const skipPath = (type === '->' && crs[0].isLeaf)
        ? crs[crs.length - 1].rightmost : null;
      // Each child's rightmost path carries the output / intermediate edge
      // through this connector.
      for (const cr of crs) pathConns[cr.rightmost].push(connId);
      connectors.push({ id: connId, type, skipPath });
      return { rightmost: crs[crs.length - 1].rightmost, isLeaf: false };
    }

    let result;
    try { result = proc(ast); } catch { return null; }

    const lastConn = connectors[connectors.length - 1];
    // For a terminal '||' every path that touches the connector flows to
    // learning; for a terminal '->' only the rightmost does.
    const terminalPaths = lastConn.type === '||'
      ? pathConns.flatMap((cs, pi) => cs.includes(lastConn.id) ? [pi] : [])
      : [result.rightmost];

    return { connectors, pathConnectors: pathConns, terminalPaths };
  }

  // ---- simplified fallback: single connector from top-level operator ----
  // Used when emb column entries don't 1:1 match the FC leaves (e.g. a
  // sub-expression is treated as a single embedding node).
  const topOp = ast.t === '||' ? '||' : (ast.t === '->' ? '->' : null);
  if (!topOp) return null;
  const skipPath = topOp === '->' ? pathCount - 1 : null;
  const pathConns2 = Array.from({ length: pathCount }, () => ['combine']);
  const terminalPaths2 = topOp === '->'
    ? [pathCount - 1]
    : Array.from({ length: pathCount }, (_, i) => i);
  return {
    connectors: [{ id: 'combine', type: topOp, skipPath }],
    pathConnectors: pathConns2,
    terminalPaths: terminalPaths2,
  };
}
// When `for claude` has top-level single-`|` separators, independent embedding
// branches feed different learning nodes. Each top-level segment is one branch;
// within a branch, `||` means concatenation (those paths merge at the `+` node).
// Returns null when there is only one branch (no per-path routing needed).
// Returns null when the counted paths don't match pathCount (data inconsistency).
function parsePathGroups(forClaude, pathCount) {
  const branches = splitLanes(clean(forClaude));
  if (branches.length <= 1) return null;
  const branchPaths = branches.map(b => b.split(/\s*\|\|\s*/).filter(Boolean));
  const total = branchPaths.reduce((s, p) => s + p.length, 0);
  if (total !== pathCount) return null;
  const pathGroup = [];
  const groupHasConcat = [];
  let pi = 0;
  branchPaths.forEach((paths, gi) => {
    groupHasConcat.push(paths.length > 1);
    for (let j = 0; j < paths.length; j++) pathGroup[pi++] = gi;
  });
  return { pathGroup, groupHasConcat, groupCount: branches.length };
}

const isSequenceForm = (form) => normForm(form) === 'Sequence';

/* ----------------------- pipeline stage metadata ----------------------- */
// `fixed` stages always show their full canonical node set (all possible
// entries, even unused). `derived` stages collect their nodes from the data.
const STAGES = [
  { id: 'analysis',         name: 'Analysis',         order: 0, perPath: true,  expand: true,  expandLabel: 'Method', fixed: ['Triage', 'Static', 'Dynamic', 'Security Testing'] },
  { id: 'artifact-class',   name: 'Artifact class',   order: 1, perPath: true,  expand: true, expandLabel: 'Artifact',
    fixed: ['Code representation', 'Text stream', 'Binary fact', 'Graph representation', 'Numerical statistic', 'Snapshot', 'Logical expression', 'Test set'] },
  { id: 'artifact-form',    name: 'Artifact form',    order: 2, perPath: true,  expand: true, expandLabel: 'Transformation',
    fixed: ['Sequence', 'Graph', 'Numeric descriptor', 'Image'] },
  { id: 'canonicalization', name: 'Canonicalization', order: 3, perPath: true,  expand: true, expandLabel: 'Method',
    fixed: ['Scale', 'Replace', 'Remove', 'Map', 'Transform', 'Extract'] },
  { id: 'tokenization',     name: 'Tokenization',     order: 4, perPath: true,  expand: true, expandLabel: 'Unit', sequenceOnly: true },
  { id: 'encoding',         name: 'Encoding',         order: 5, perPath: true,  expand: true, expandLabel: 'Method', fixed: ['Sparse', 'Dense'] },
  { id: 'embedding',        name: 'Embedding',        order: 6, perPath: true,  expand: true, expandLabel: 'Method', fixed: ['Context-dependent', 'Context-independent'] },
  { id: 'combine',          name: 'Learning model',   order: 7,   perPath: false, expand: false, connector: true, fixed: ['-->', '+'] },
  { id: 'combine_1',        name: 'Learning model',   order: 7.5, perPath: false, expand: false, connector: true, fixed: ['-->', '+'] },
  { id: 'learning',         name: 'Learning',         order: 8,   perPath: false, expand: true, expandLabel: 'Model', detailLabel: 'Subcategory' },
  { id: 'inference',        name: 'Inference',        order: 9, perPath: false, expand: true, expandLabel: 'Metric',
    fixed: ['Detection', 'Recovery', 'Discovery', 'Classification', 'Reconstruction', 'Summarization', 'Restoration'] },
];

/* ------------------------------- load ---------------------------------- */
const PRIMARY = 'ai_pipeline_final_sheet.csv';
const summaryRows = asObjects(readTable(PRIMARY));
const domainRows = asObjects(readTable('taxonomy definitions/domain_definition.csv'));
const domainByDid = Object.fromEntries(domainRows.map((r) => [clean(r.Index), r]));
const paperMapRows = asObjects(readTable('taxonomy definitions/domain_paper_map.csv'));
const yearByPid = Object.fromEntries(paperMapRows.map((r) => [clean(r.PID), clean(r.Year)]));

const nid = (stageId, label) => `${stageId}::${label}`;

/* ------ per (stage, lane) and shared label extraction ------------------ */
// Returns [{ label, reveal, detail }]
function laneEntries(stageId, lane) {
  switch (stageId) {
    case 'analysis': {
      const phases = [];
      for (const [ph, goal] of phaseGoals(lane.analysis)) {
        const e = phases.find((x) => x.label === ph);
        if (e) { if (goal && !e.detailArr.includes(goal)) e.detailArr.push(goal); }
        else phases.push({ label: ph, detailArr: goal ? [goal] : [] });
      }
      // Phase is shown by default; its goal(s) are revealed on click (N/A if none).
      return phases.map((p) => ({ label: p.label, reveal: p.detailArr.join('; '), detail: '' }));
    }
    case 'artifact-class': {
      const out = [];
      for (const part of String(lane.artifactClass).split(';')) {
        const c = normClass(part);
        if (c && !out.some((x) => x.label === c)) out.push({ label: c, reveal: lane.artifact, detail: '' });
      }
      return out;
    }
    case 'artifact-form': {
      const f = normForm(lane.artifactForm);
      return f ? [{ label: f, reveal: lane.transformation, detail: '' }] : [];
    }
    case 'canonicalization': {
      const out = [];
      for (const part of String(lane.canonRaw).split(';')) {
        const s = canonShort(part);
        if (s && !out.some((x) => x.label === s)) out.push({ label: s, reveal: lane.canonMethod, detail: '' });
      }
      return out;
    }
    case 'tokenization': {
      if (!lane.isSequence) return [];
      const b = normSplitBasis(lane.splitBasis);
      return b ? [{ label: b, reveal: '', detail: '' }] : [];
    }
    case 'encoding': {
      const e = normEncoding(lane.encoding);
      if (e) return [{ label: e, reveal: lane.encodingExamples, detail: '' }];
      if (lane.isMultiPath && clean(lane.encoding) && isSkip(lane.encoding))
        return [{ label: 'N/A', reveal: '', detail: '' }];
      return [];
    }
    case 'embedding': {
      const e = normEmbedding(lane.embeddingMethod);
      if (e) return [{ label: e, reveal: lane.embeddingExamples, detail: '' }];
      if (lane.isMultiPath && clean(lane.embeddingMethod) && isSkip(lane.embeddingMethod))
        return [{ label: 'N/A', reveal: '', detail: '' }];
      return [];
    }
    default:
      return [];
  }
}

function sharedEntries(stageId, paper) {
  switch (stageId) {
    case 'combine': {
      const conn = paper.connectorGraph?.[0];
      if (conn) return [{ label: conn.type === '->' ? '-->' : '+', reveal: '', detail: '' }];
      return paper.relationship ? [{ label: paper.relationship, reveal: '', detail: '' }] : [];
    }
    case 'combine_1': {
      const conn = paper.connectorGraph?.[1];
      return conn ? [{ label: conn.type === '->' ? '-->' : '+', reveal: '', detail: '' }] : [];
    }
    case 'learning': {
      const out = [];
      for (const rawCat of splitMulti(paper.learningCategory)) {
        const lcCat = rawCat.toLowerCase();
        const cat = (lcCat === 'rule-based' || lcCat === 'rule-based reasoning') ? 'Rule-based\nReasoning' : rawCat;
        if (!out.some((x) => x.label === cat))
          out.push({ label: cat, reveal: paper.learningModel, detail: '' });
      }
      return out;
    }
    case 'inference': {
      const cat = clean(paper.inferenceCategory);
      if (isSkip(cat)) return [];
      // A cell may list several inference types separated by ';' (e.g. "Detection; clustering").
      // Split and normalise each part against the fixed label list (case-insensitive).
      const INFERENCE_FIXED = ['Detection', 'Recovery', 'Discovery', 'Classification',
        'Reconstruction', 'Clustering', 'Summarization', 'Restoration'];
      return cat.split(';').map(s => s.trim()).filter(Boolean).map(s => {
        const match = INFERENCE_FIXED.find(f => f.toLowerCase() === s.toLowerCase());
        const label = match ?? (s.charAt(0).toUpperCase() + s.slice(1));
        return { label, reveal: paper.evaluationMetric, detail: '' };
      });
    }
    default:
      return [];
  }
}

/* ------------- per-path reveal: spreadsheet-faithful (| per input) ------- */
// The raw "detail" column a per-path stage reveals on click. Kept verbatim so a
// `|` (one segment per input path) survives even when several inputs collapse
// onto the same node — otherwise a 2-input paper can look like a single input.
function revealCell(stageId, row) {
  switch (stageId) {
    case 'artifact-class':   return row['Artifact'];
    case 'artifact-form':    return row['Transformation'];
    case 'canonicalization': return row['Canonicalization'];
    case 'tokenization':     return row['Tokenization_Unit'];
    case 'encoding':         return row['Encoding examples'];
    case 'embedding':        return row['Embedding examples'];
    default:                 return '';
  }
}

// Build the reveal for exactly the input lanes that touch a node, preserving
// the sheet's `|`. A `|`-less cell is a single value shared by every input.
function laneReveal(rawCell, touch, pathCount) {
  if (pathCount <= 1) return isSkip(rawCell) ? '' : clean(rawCell);
  const segs = splitLanes(rawCell);
  if (segs.length <= 1) return isSkip(rawCell) ? '' : clean(rawCell);
  const parts = touch.map((i) => {
    const seg = clean(segs[i] ?? segs[segs.length - 1]);
    return isSkip(seg) ? 'N/A' : seg;
  });
  if (parts.length === 1) return parts[0] === 'N/A' ? '' : parts[0];
  return parts.join(' | ');
}

// Canonicalization reveal: only the raw operation(s) whose canonShort maps to
// `nodeLabel`, so each node shows only its own method, not sibling operations.
function canonReveal(nodeLabel, lanes, touch) {
  const parts = touch.map((i) => {
    const matching = String(lanes[i].canonRaw ?? '').split(';')
      .map((s) => s.trim()).filter((op) => canonShort(op) === nodeLabel);
    return matching.length ? matching.join('; ') : '';
  }).filter(Boolean);
  const unique = [...new Set(parts)];
  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0];
  return unique.join(' | ');
}

// Artifact-class reveal: only the artifact values whose class maps to nodeLabel.
// Uses the raw (non-deduplicated) Artifact class column so the ';'-position sync
// with the Artifact column is preserved (lanes[i].artifactClass is deduplicated
// and therefore cannot be used for index-based zipping).
function artifactReveal(nodeLabel, lanes, touch, row, pathCount) {
  const parts = touch.map((i) => {
    const rawClasses = alignLane(row['Artifact class'], i, pathCount).split(';').map((s) => normClass(s.trim()));
    const artifacts = alignLane(row['Artifact'], i, pathCount).split(';').map((s) => s.trim());
    const matching = rawClasses
      .map((c, k) => (c === nodeLabel && artifacts[k] && !isSkip(artifacts[k])) ? artifacts[k] : null)
      .filter(Boolean);
    return matching.length ? matching.join('; ') : '';
  }).filter(Boolean);
  const unique = [...new Set(parts)];
  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0];
  return unique.join(' | ');
}

// Analysis reveal: the goal(s) of `phaseLabel` in each touching lane, by `|`.
function analysisReveal(phaseLabel, lanes, touch) {
  const parts = touch.map((i) => {
    const goals = [];
    for (const [ph, g] of phaseGoals(lanes[i].analysis)) {
      if (ph === phaseLabel && g && !goals.includes(g)) goals.push(g);
    }
    return goals.length ? goals.join('; ') : 'N/A';
  });
  if (parts.length === 1) return parts[0] === 'N/A' ? '' : parts[0];
  return parts.join(' | ');
}

/* --------------------------- build papers ------------------------------ */
function buildPaper(row) {
  const did = clean(row.DID);
  const dd = domainByDid[did] || {};
  // Input-path count = the most `|`-segmented of the columns that define an
  // input's identity. Some rows under-fill Artifact form (a single value shared
  // by both inputs), so derive it from the max across these columns instead of
  // Artifact form alone — otherwise a genuine 2-input paper collapses to one.
  const pathCount = Math.max(
    1,
    splitLanes(row['Analysis']).length,
    splitLanes(row['Artifact']).length,
    splitLanes(row['Artifact class']).length,
    splitLanes(row['Artifact form']).length,
  );

  const lanes = [];
  for (let i = 0; i < pathCount; i++) {
    const v = (col) => alignLane(row[col], i, pathCount);
    lanes.push({
      analysis: v('Analysis'),
      artifactClass: (() => {
        const out = [];
        for (const part of v('Artifact class').split(';')) {
          const c = normClass(part);
          if (c && !out.includes(c)) out.push(c);
        }
        return out.join('; ');
      })(),
      artifact: v('Artifact'),
      artifactForm: v('Artifact form'),
      transformation: v('Transformation'),
      canonRaw: v('Canonicalization'),
      canonMethod: v('Canonicalization_Method'),
      isSequence: isSequenceForm(v('Artifact form')),
      isMultiPath: pathCount > 1,
      splitBasis: v('Split basis'),
      tokenizationUnit: v('Tokenization_Unit'),
      tokenizationTechnique: v('Tokenization_Technique'),
      encoding: v('Encoding'),
      encodingExamples: v('Encoding examples'),
      embeddingMethod: v('Embedding_Method'),
      embeddingExamples: v('Embedding examples'),
    });
  }

  const paper = {
    id: clean(row.PID),
    did,
    title: clean(row.Paper),
    domain: clean(dd.Domain) || clean(row.Domain) || 'Unknown',
    scheme: clean(dd.Scheme) || 'Others',
    tier: clean(dd.Tier) || '',
    inferenceType: clean(dd['Inference Type']) || '',
    conference: clean(row.Conference),
    year: yearByPid[clean(row.PID)] || '',
    isTopTier: clean(row.IsTopTier).toUpperCase() === 'TRUE',
    codeForm: clean(row['Code Form']),
    pathCount,
    // Combine marker only for papers that actually fuse multiple embeddings
    // (one per input path); default an unspecified fusion to '+' (parallel).
    // A single-embedding paper has no combine step, so it gets no marker.
    relationship: pathCount > 1 ? combineRelationship(row['for claude']) : '',
    forClaude: pathCount > 1 ? clean(row['for claude']) : '',
    learningCategory: clean(row.Learning_Category),
    learningSubcategory: clean(row.Learning_Subcategory),
    learningModel: clean(row['Learning_Model']),
    inferenceCategory: clean(row.Inference_Category),
    inferenceSubcategory: clean(row.Inference_Subcategory),
    inferenceOutput: clean(row.Inference_Output),
    evaluationMetric: clean(row.Evaluation_Metric),
    pathNodeIds: [],
    nodeReveal: {},
    nodeDetail: {},
    // Connector graph: built below; stored here so sharedEntries can use it.
    connectorGraph: [],
  };

  // Build the connector graph from the FC expression before anything else so
  // that sharedEntries (called next) can use paper.connectorGraph for labels.
  let cgraph = null;
  if (pathCount > 1) {
    const fcStr = clean(row['for claude']);
    if (fcStr) {
      try {
        const ast = new FCParser(fcStr).parse();
        cgraph = buildConnectorGraph(ast, pathCount);
      } catch { /* ignore parse errors, will fall back */ }
    }
    paper.connectorGraph = cgraph?.connectors ?? [];
  }

  const addReveal = (id, v) => {
    if (isSkip(v)) return;
    (paper.nodeReveal[id] ||= []);
    if (!paper.nodeReveal[id].includes(clean(v))) paper.nodeReveal[id].push(clean(v));
  };
  const addDetail = (id, v) => {
    if (isSkip(v)) return;
    (paper.nodeDetail[id] ||= []);
    if (!paper.nodeDetail[id].includes(clean(v))) paper.nodeDetail[id].push(clean(v));
  };

  // shared-tail node ids (identical for every lane → natural convergence)
  const sharedByStage = {};
  for (const s of STAGES.filter((x) => !x.perPath)) {
    const ids = [];
    for (const e of sharedEntries(s.id, paper)) {
      const id = nid(s.id, e.label);
      ids.push(id);
      addReveal(id, e.reveal);
      addDetail(id, e.detail);
    }
    sharedByStage[s.id] = [...new Set(ids)];
  }

  // per-path nodes: record which input lanes touch each node id (lane order).
  const lanesByNode = {};
  // When `for claude` has multiple top-level branches, paths in each branch
  // connect only to that branch's combine/learning nodes, not to all of them.
  const pathGroups = parsePathGroups(row['for claude'], pathCount);
  const learningCatsByGroup = pathGroups ? splitLanes(paper.learningCategory) : null;

  for (let i = 0; i < pathCount; i++) {
    const perStage = {};
    for (const s of STAGES.filter((x) => x.perPath)) {
      const ids = [];
      for (const e of laneEntries(s.id, lanes[i])) {
        const id = nid(s.id, e.label);
        ids.push(id);
        (lanesByNode[id] ||= []).push(i);
        addDetail(id, e.detail);
      }
      perStage[s.id] = [...new Set(ids)];
    }

    if (pathGroups) {
      const gi = pathGroups.pathGroup[i];
      for (const s of STAGES.filter((x) => !x.perPath)) {
        if (s.id === 'combine') {
          // Only paths inside a concat branch (||) pass through the combine node.
          perStage[s.id] = pathGroups.groupHasConcat[gi] ? sharedByStage[s.id] : [];
        } else if (s.id === 'learning') {
          const rawCat = (learningCatsByGroup[gi] ?? learningCatsByGroup[0] ?? '').trim();
          const lcCat = rawCat.toLowerCase();
          const cat = (lcCat === 'rule-based' || lcCat === 'rule-based reasoning')
            ? 'Rule-based\nReasoning' : rawCat;
          perStage[s.id] = cat && !isSkip(cat) ? [nid('learning', cat)] : [];
        } else {
          perStage[s.id] = sharedByStage[s.id];
        }
      }
    } else {
      for (const s of STAGES.filter((x) => !x.perPath)) {
        if (cgraph) {
          if (s.connector) {
            perStage[s.id] = cgraph.pathConnectors[i].includes(s.id) ? sharedByStage[s.id] : [];
          } else {
            perStage[s.id] = cgraph.terminalPaths.includes(i) ? sharedByStage[s.id] : [];
          }
        } else if (paper.relationship === '-->') {
          // Fallback for papers where connector graph could not be built.
          const K = pathCount - 1;
          if (s.connector) {
            const k = s.id === 'combine' ? 0 : s.id === 'combine_1' ? 1 : -1;
            perStage[s.id] = (k >= 0 && k < K && (i === k || i === k + 1))
              ? sharedByStage[s.id]
              : [];
          } else {
            perStage[s.id] = i !== pathCount - 1 ? [] : sharedByStage[s.id];
          }
        } else {
          perStage[s.id] = sharedByStage[s.id];
        }
      }
    }

    paper.pathNodeIds.push(perStage);
  }

  // Reveal one value per touching lane, joined by `|`, so multi-input papers
  // whose paths collapse onto shared nodes still show every input in the popup.
  for (const id of Object.keys(lanesByNode)) {
    const stageId = id.slice(0, id.indexOf('::'));
    const label = id.slice(stageId.length + 2);
    const touch = [...new Set(lanesByNode[id])].sort((a, b) => a - b);
    addReveal(id, stageId === 'analysis'
      ? analysisReveal(label, lanes, touch)
      : stageId === 'canonicalization'
        ? canonReveal(label, lanes, touch)
        : stageId === 'artifact-class'
          ? artifactReveal(label, lanes, touch, row, pathCount)
          : laneReveal(revealCell(stageId, row), touch, pathCount));
  }

  // Learning subcategory: assign each learning node only the subcategory values
  // from the paths that actually touch it, so shared nodes with different inputs
  // show the right subcategory per path rather than the full joined string.
  const subcatParts = splitLanes(paper.learningSubcategory);
  if (subcatParts.length > 0) {
    for (let i = 0; i < pathCount; i++) {
      const nodeIds = paper.pathNodeIds[i]?.['learning'] ?? [];
      const sub = clean(subcatParts[i] ?? subcatParts[0] ?? '');
      if (!sub || isSkip(sub)) continue;
      for (const id of nodeIds) addDetail(id, sub);
    }
  }

  // Single-path papers whose 'for claude' lists embedding alternatives
  // (e.g. P141: "BERT-based or Word2Vec or Transformer-based") override the
  // embedding reveal with the 'for claude' text, formatted one option per line.
  if (pathCount === 1) {
    const fc = clean(row['for claude']);
    if (fc && !isSkip(fc) && /\bor\b/i.test(fc)) {
      const formatted = fc.replace(/\s+or\s+/gi, '\nor ');
      for (const embId of paper.pathNodeIds[0]['embedding'] ?? []) {
        paper.nodeReveal[embId] = [formatted];
      }
    }
  }

  return paper;
}

const papers = summaryRows
  .filter((r) => clean(r.PID))
  .map(buildPaper)
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

/* ------------------------- build stage nodes --------------------------- */
function buildStage(stage) {
  // count papers touching each label
  const counts = new Map();
  for (const p of papers) {
    const touched = new Set();
    for (const per of p.pathNodeIds) for (const id of per[stage.id] || []) touched.add(id);
    for (const id of touched) {
      const label = id.slice(stage.id.length + 2);
      if (!counts.has(label)) counts.set(label, 0);
      counts.set(label, counts.get(label) + 1);
    }
  }

  let labels;
  if (stage.fixed) {
    labels = stage.fixed.slice(); // always show the full canonical set, in order
    for (const l of counts.keys()) if (!labels.includes(l)) labels.push(l);
  } else {
    labels = [...counts.keys()].sort(
      (a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b),
    );
  }

  const nodes = labels.map((label) => ({
    id: nid(stage.id, label),
    stageId: stage.id,
    label,
    paperCount: counts.get(label) || 0,
    transient: label === 'N/A',
  }));

  return {
    id: stage.id, name: stage.name, order: stage.order,
    perPath: stage.perPath, expand: stage.expand, expandLabel: stage.expandLabel ?? '',
    detailLabel: stage.detailLabel ?? '',
    sequenceOnly: !!stage.sequenceOnly, connector: !!stage.connector,
    nodes,
  };
}
const stages = STAGES.map(buildStage);

/* ------------------ sidebar tree (Scheme -> Domain -> PIDs) ------------- */
const papersByDid = {};
for (const p of papers) (papersByDid[p.did] ||= []).push(p);

const SCHEMES_ORDER = ['Foundation', 'Application', 'Others'];
const sidebar = SCHEMES_ORDER.map((scheme) => {
  const domains = domainRows
    .filter((d) => clean(d.Scheme) === scheme && (papersByDid[clean(d.Index)] || []).length > 0)
    .sort((a, b) => clean(a.Index).localeCompare(clean(b.Index), undefined, { numeric: true }))
    .map((d) => {
      const did = clean(d.Index);
      const ps = (papersByDid[did] || []).slice().sort((a, b) =>
        a.id.localeCompare(b.id, undefined, { numeric: true }),
      );
      return {
        id: did, name: clean(d.Domain), tier: clean(d.Tier),
        inferenceType: clean(d['Inference Type']), paperCount: ps.length,
        papers: ps.map((p) => ({ id: p.id, title: p.title, venue: p.conference, did: p.did, isTopTier: p.isTopTier })),
      };
    });
  return { scheme, domains };
}).filter((g) => g.domains.length > 0);

/* ------------------------------- meta ---------------------------------- */
const pathCounts = papers.map((p) => p.pathCount);
const data = {
  meta: {
    title: 'SoK: AI-Augmented Binary Reversing',
    description: 'Interactive flow-diagram map of the AI-augmented binary-reversing pipeline.',
    paperCount: papers.length,
    domainCount: sidebar.reduce((n, g) => n + g.domains.length, 0),
    stageCount: stages.length,
    maxPaths: Math.max(1, ...pathCounts),
    generatedAt: new Date().toISOString(),
    primarySource: `source/${PRIMARY}`,
  },
  stages,
  papers,
  sidebar,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');

const hist = pathCounts.reduce((m, n) => ((m[n] = (m[n] || 0) + 1), m), {});
console.log('OK  src/data/normalizedData.json');
console.log(`    papers   : ${papers.length}   domains: ${data.meta.domainCount}   paths: ${JSON.stringify(hist)}`);
for (const s of stages) {
  console.log(`    stage ${s.order} ${s.name.padEnd(16)} ${String(s.nodes.length).padStart(2)} nodes  [${s.nodes.map((n) => n.label).join(', ')}]`);
}
