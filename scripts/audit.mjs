// One-off audit: compare the source spreadsheet against what the website shows
// (normalizedData.json). Flags dropped values, lane-count mismatches, and
// values that fall through normalization. Read-only; prints findings.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CSV = path.join(ROOT, 'source', 'ai_pipeline_final_sheet.csv');

/* CSV parser (same as normalize-data.mjs) */
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* normalizers — copied verbatim from normalize-data.mjs */
const SKIP = new Set(['', 'n/a', 'na', 'none', '-', '—']);
const isSkip = (v) => !v || SKIP.has(String(v).trim().toLowerCase());
const clean = (v) => (v == null ? '' : String(v).trim());
const splitLanes = (cell) => (!cell ? [] : String(cell).split(/(?<!\|)\|(?!\|)/).map((s) => s.trim()));
const splitMulti = (v) => !v ? [] : String(v).split(/[|;]/).map((s) => s.trim()).filter((s) => s && !isSkip(s));
const phaseOf = (s) => { const i = s.indexOf('>'); return (i >= 0 ? s.slice(0, i) : s).trim(); };
const goalOf = (s) => { const i = s.indexOf('>'); return i >= 0 ? s.slice(i + 1).trim() : ''; };
function alignLane(cell, i, pc) { const c = clean(cell); if (!c) return ''; if (pc <= 1) return c; const p = splitLanes(c); if (p.length <= 1) return c; return clean(p[i] ?? p[p.length - 1]); }
function normPhase(p) { const s = clean(p).toLowerCase().replace(/\[[^\]]*\]/g, '').trim(); if (!s) return ''; if (s.includes('triage')) return 'Triage'; if (s.includes('static') || s.includes('satic')) return 'Static'; if (s.includes('dynamic')) return 'Dynamic'; if (s.includes('security testing') || s.includes('fuzz')) return 'Security Testing'; if (s.includes('hybrid')) return 'Hybrid'; return ''; }
const CLASS_MATCHERS = [['code represent', 'Code representations'], ['string', 'String literals'], ['text stream', 'Text streams'], ['graph represent', 'Graph representations'], ['binary fact', 'Binary facts'], ['numeric', 'Numerical statistics'], ['snapshot', 'Snapshots'], ['logical express', 'Logical expressions'], ['test set', 'Test sets']];
function normClass(seg) { const s = clean(seg).toLowerCase(); if (isSkip(s)) return ''; for (const [n, c] of CLASS_MATCHERS) if (s.includes(n)) return c; return clean(seg); }
function normForm(f) { const s = clean(f).toLowerCase(); if (isSkip(s)) return ''; if (s.startsWith('seq')) return 'Sequence'; if (s.startsWith('graph') || s.startsWith('grp')) return 'Graph'; if (s.startsWith('num')) return 'Numeric descriptor'; if (s.startsWith('image')) return 'Image'; if (s.startsWith('struct')) return 'Structural transformation'; return clean(f); }
function canonShort(raw) { const c = clean(raw); if (isSkip(c)) return ''; const last = (c.split(/\s+/).filter(Boolean).pop() || '').toLowerCase().replace(/[^a-z]/g, ''); if (last.startsWith('scal')) return 'Scale'; if (last.startsWith('replac')) return 'Replace'; if (last.startsWith('remov')) return 'Remove'; if (last.startsWith('map')) return 'Map'; if (last.startsWith('transform')) return 'Transform'; if (last.startsWith('extract')) return 'Extract'; return ''; }
function normTokUnit(u) { const s = clean(u).toLowerCase(); if (isSkip(s) || s.length <= 1) return ''; if (s.includes('byte pair') || s === 'bpe' || s.includes('(bpe')) return 'Subword (BPE)'; if (s.includes('pretrained')) return 'Subword (Pretrained-LLM)'; if (s.startsWith('byte')) return 'Byte'; if (s.includes('opcode') || s.startsWith('instruction')) return 'Instruction'; if (s === 'element') return 'Element'; if (s === 'sub-token') return 'Sub-token'; if (s === 'sub-element') return 'Sub-element'; if (s.includes('trace event')) return 'Trace event'; if (s.includes('layout-field')) return 'Layout-field token'; return clean(u); }
function normEncoding(v) { const s = clean(v).toLowerCase(); if (s.startsWith('dense')) return 'Dense'; if (s.startsWith('sparse')) return 'Sparse'; return ''; }
function normEmbedding(v) { const s = clean(v).toLowerCase(); if (s.includes('independent') || s.includes('non-context')) return 'Context-independent'; if (s.includes('dependent') || s.includes('contextual')) return 'Context-dependent'; return ''; }
const isSeq = (f) => normForm(f) === 'Sequence';

// Map renamed source columns back to the logical names used here (kept in sync
// with normalize-data.mjs COLUMN_ALIASES).
const COLUMN_ALIASES = { 'Analysis Artifact': 'Artifact', 'Token Unit': 'Tokenization_Unit' };
const t = parseCSV(fs.readFileSync(CSV, 'utf8')).filter((r) => r.some((c) => c.trim() !== ''));
const H = t[0].map((h) => { const x = h.trim(); return COLUMN_ALIASES[x] || x; });
const rows = t.slice(1).map((r) => Object.fromEntries(H.map((h, i) => [h, (r[i] ?? '').trim()]))).filter((r) => r.PID);

const findings = { drop: [], laneMismatch: [], tokOnNonSeq: [], oddLabel: [] };
const allSkip = (cell) => isSkip(cell) || (splitLanes(cell).length > 0 && splitLanes(cell).every(isSkip));
function phaseGoals(text) { const out = []; let last = ''; for (const seg of String(text).split(/[|;]/)) { if (isSkip(seg)) continue; const ph = normPhase(phaseOf(seg)); if (ph) { last = ph; out.push([ph, goalOf(seg)]); } else if (last) out.push([last, clean(seg)]); } return out; }

// columns that are |-split per input lane (aligned to Artifact form)
const LANE_COLS = ['Analysis', 'Artifact', 'Artifact class', 'Transformation', 'Artifact form',
  'Canonicalization', 'Canonicalization_Method', 'Tokenization_Unit', 'Tokenization_Technique',
  'Encoding', 'Encoding examples', 'Embedding_Method', 'Embedding examples'];

for (const r of rows) {
  const pid = r.PID;
  const pc = Math.max(1, splitLanes(r['Analysis']).length, splitLanes(r['Artifact']).length,
    splitLanes(r['Artifact class']).length, splitLanes(r['Artifact form']).length);

  // (1) lane-count mismatch vs pathCount
  for (const col of LANE_COLS) {
    const n = splitLanes(r[col]).length;
    if (n > 1 && n !== pc) findings.laneMismatch.push(`${pid}  ${col}: ${n} '|'-segments vs pathCount ${pc}  ::  ${JSON.stringify(r[col])}`);
  }

  for (let i = 0; i < pc; i++) {
    const v = (c) => alignLane(r[c], i, pc);
    const laneTag = pc > 1 ? ` lane${i}` : '';

    // (2) analysis phases dropped (with phase carry-forward for prefix-less goals)
    {
      let last = '';
      for (const seg of String(v('Analysis')).split(/[|;]/)) {
        const raw = clean(seg); if (isSkip(raw)) continue;
        const ph = normPhase(phaseOf(seg));
        if (ph) last = ph;
        else if (!last) findings.drop.push(`${pid}${laneTag}  Analysis segment has no phase: ${JSON.stringify(raw)}`);
      }
    }
    // (3) artifact class -> unknown label kept verbatim?
    for (const part of String(v('Artifact class')).split(';')) {
      const raw = clean(part); if (isSkip(raw)) continue;
      const c = normClass(part);
      if (c && !CLASS_MATCHERS.some(([, canon]) => canon === c)) findings.oddLabel.push(`${pid}${laneTag}  Artifact class not canonical: ${JSON.stringify(c)}`);
    }
    // (4) artifact form unknown
    if (!isSkip(v('Artifact form'))) {
      const f = normForm(v('Artifact form'));
      const canon = ['Sequence', 'Graph', 'Numeric descriptor', 'Image', 'Structural transformation'];
      if (f && !canon.includes(f)) findings.oddLabel.push(`${pid}${laneTag}  Artifact form not canonical: ${JSON.stringify(f)}  (from ${JSON.stringify(v('Artifact form'))})`);
    }
    // (5) canonicalization dropped
    if (!allSkip(v('Canonicalization')) && !canonShort(v('Canonicalization')))
      findings.drop.push(`${pid}${laneTag}  Canonicalization unmapped: ${JSON.stringify(v('Canonicalization'))}`);
    // (6) encoding dropped
    if (!allSkip(v('Encoding')) && !normEncoding(v('Encoding')))
      findings.drop.push(`${pid}${laneTag}  Encoding unmapped: ${JSON.stringify(v('Encoding'))}`);
    // (7) embedding dropped
    if (!allSkip(v('Embedding_Method')) && !normEmbedding(v('Embedding_Method')))
      findings.drop.push(`${pid}${laneTag}  Embedding unmapped: ${JSON.stringify(v('Embedding_Method'))}`);
    // (8) tokenization unit present but form not sequence (hidden) OR unmapped
    const tu = v('Tokenization_Unit');
    if (!allSkip(tu)) {
      if (!isSeq(v('Artifact form'))) findings.tokOnNonSeq.push(`${pid}${laneTag}  Tokenization_Unit ${JSON.stringify(tu)} but form is ${JSON.stringify(v('Artifact form'))} (tokenization hidden)`);
      else { const toks = splitMulti(tu).map(normTokUnit).filter(Boolean); if (!toks.length) findings.drop.push(`${pid}${laneTag}  Tokenization unmapped: ${JSON.stringify(tu)}`); }
    }
  }
  // (9) shared: a Learning_Category with no subcategory yields no Learning node
  if (isSkip(r['Learning_Subcategory']) && !isSkip(r['Learning_Category']))
    findings.oddLabel.push(`${pid}  Learning_Category ${JSON.stringify(r['Learning_Category'])} but Learning_Subcategory empty (no Learning node)`);
}

const out = (title, arr) => { console.log(`\n=== ${title} (${arr.length}) ===`); arr.forEach((x) => console.log('  ' + x)); };
out('DROPPED values (source has content, website shows no node)', findings.drop);
out('LANE-COUNT mismatches (|-segments != pathCount)', findings.laneMismatch);
out('TOKENIZATION present but form not Sequence (hidden by design)', findings.tokOnNonSeq);
out('NON-canonical labels (kept verbatim via fallback)', findings.oddLabel);
console.log(`\npapers audited: ${rows.length}`);
