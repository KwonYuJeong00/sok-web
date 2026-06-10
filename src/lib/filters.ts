// Simple search over PID / title / domain / venue.
import type { Paper, FilterState } from '../types';

export const EMPTY_FILTER: FilterState = { query: '' };

export function isFilterActive(f: FilterState): boolean {
  return f.query.trim().length > 0;
}

export function filterPapers(papers: Paper[], f: FilterState): Set<string> {
  const q = f.query.trim().toLowerCase();
  if (!q) return new Set(papers.map((p) => p.id));
  const out = new Set<string>();
  for (const p of papers) {
    if (
      p.id.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.domain.toLowerCase().includes(q) ||
      p.did.toLowerCase().includes(q) ||
      (p.conference && p.conference.toLowerCase().includes(q))
    ) {
      out.add(p.id);
    }
  }
  return out;
}
