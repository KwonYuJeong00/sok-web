import { useEffect, useState } from 'react';
import { cssVars } from '../lib/style';
import { schemeColor } from '../lib/colors';
import type { SidebarSchemeGroup } from '../types';

interface Props {
  sidebar: SidebarSchemeGroup[];
  selectedPid: string | null;
  filteredPids: Set<string> | null;
  onSelect: (pid: string) => void;
  /** Domain-overview page (full collection) toggle */
  overviewOpen: boolean;
  collectionCount: number;
  onToggleOverview: () => void;
}

export function Sidebar({
  sidebar,
  selectedPid,
  filteredPids,
  onSelect,
  overviewOpen,
  collectionCount,
  onToggleOverview,
}: Props) {
  // Default: schemes expanded, domains collapsed — keeps the list scannable;
  // click a domain to drill in.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const g of sidebar) for (const d of g.domains) s.add(`d:${d.id}`);
    return s;
  });

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // When a paper is selected from outside the tree (e.g. an overview-table
  // Pipeline button), expand its scheme + domain so the selection is visible.
  useEffect(() => {
    if (!selectedPid) return;
    for (const g of sidebar) {
      for (const d of g.domains) {
        if (d.papers.some((p) => p.id === selectedPid)) {
          setCollapsed((prev) => {
            if (!prev.has(`d:${d.id}`) && !prev.has(`s:${g.scheme}`)) return prev;
            const next = new Set(prev);
            next.delete(`d:${d.id}`);
            next.delete(`s:${g.scheme}`);
            return next;
          });
        }
      }
    }
  }, [selectedPid, sidebar]);

  // After the tree re-renders expanded, bring the selected paper into view.
  useEffect(() => {
    if (!selectedPid) return;
    document
      .querySelector('.paper-leaf.is-selected')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedPid, collapsed]);

  const isIn = (pid: string) => !filteredPids || filteredPids.has(pid);

  return (
    <aside className="sidebar">
      <button
        type="button"
        className={`ov-toggle${overviewOpen ? ' is-active' : ''}`}
        onClick={onToggleOverview}
        aria-pressed={overviewOpen}
      >
        <span className="ov-toggle-name">Research Papers by Domain</span>
        <span className="ov-toggle-spacer" />
        <span className="ov-toggle-count">{collectionCount}</span>
      </button>
      {sidebar.map((group) => {
        const schemeKey = `s:${group.scheme}`;
        const schemeCollapsed = collapsed.has(schemeKey);
        const visibleDomains = group.domains.filter((d) =>
          d.papers.some((p) => isIn(p.id)),
        );
        const paperCount = visibleDomains.reduce(
          (n, d) => n + d.papers.filter((p) => isIn(p.id)).length,
          0,
        );
        if (paperCount === 0 && filteredPids) return null;
        return (
          <section key={group.scheme} className="scheme-section">
            <button
              type="button"
              className="scheme-row"
              style={cssVars({ '--scheme': schemeColor(group.scheme) })}
              onClick={() => toggle(schemeKey)}
            >
              <span className="arrow">{schemeCollapsed ? '▸' : '▾'}</span>
              <span className="scheme-name">{group.scheme}</span>
              <span className="scheme-count">{paperCount}</span>
            </button>
            {!schemeCollapsed &&
              visibleDomains.map((d) => {
                const domKey = `d:${d.id}`;
                const domCollapsed = collapsed.has(domKey);
                const papers = d.papers.filter((p) => isIn(p.id));
                if (papers.length === 0) return null;
                return (
                  <div key={d.id} className="domain-block">
                    <button
                      type="button"
                      className="domain-row"
                      onClick={() => toggle(domKey)}
                    >
                      <span className="arrow">{domCollapsed ? '▸' : '▾'}</span>
                      <span className="dom-id">{d.id}</span>
                      <span className="dom-name">{d.name}</span>
                      <span className="dom-count">{papers.length}</span>
                    </button>
                    {!domCollapsed && (
                      <ul className="paper-list">
                        {papers.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className={`paper-leaf${
                                p.id === selectedPid ? ' is-selected' : ''
                              }`}
                              onClick={() => onSelect(p.id)}
                              title={p.title}
                            >
                              <span className="leaf-title">{p.title}</span>
                              {p.venue && <span className="leaf-venue">{p.venue}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
          </section>
        );
      })}
    </aside>
  );
}
