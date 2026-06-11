import { useState } from 'react';
import { cssVars } from '../lib/style';
import { schemeColor } from '../lib/colors';
import type { SidebarSchemeGroup } from '../types';

interface Props {
  sidebar: SidebarSchemeGroup[];
  selectedPid: string | null;
  filteredPids: Set<string> | null;
  onSelect: (pid: string) => void;
}

export function Sidebar({ sidebar, selectedPid, filteredPids, onSelect }: Props) {
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

  const isIn = (pid: string) => !filteredPids || filteredPids.has(pid);

  return (
    <aside className="sidebar">
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
                              <span className="leaf-pid">{p.id}</span>
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
