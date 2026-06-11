import { useMemo, useState } from 'react';
import { data, paperById } from './lib/data';
import { computeLayout } from './lib/layout';
import { backboneEdges, paperTraceEdges } from './lib/edges';
import { computeNodeColors } from './lib/highlight';
import { filterPapers, EMPTY_FILTER, isFilterActive } from './lib/filters';
import { pathColor } from './lib/colors';
import { cssVars } from './lib/style';
import type { Selection, FilterState, Paper } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PipelineGraph } from './components/PipelineGraph';

export default function App() {
  const [selection, setSelection] = useState<Selection>({ kind: 'none' });
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);

  const filterActive = isFilterActive(filter);

  const selectedPaper =
    selection.kind === 'paper' ? paperById.get(selection.paperId) ?? null : null;

  // The connector slot (and the wider Embedding->Learning gap) only exists when
  // the selected paper fuses multiple embeddings; otherwise the gap is uniform.
  const showConnector = !!selectedPaper?.relationship;
  const layout = useMemo(() => computeLayout(data.stages, showConnector), [showConnector]);
  const backbone = useMemo(() => backboneEdges(data.stages, layout), [layout]);
  const filteredPids = useMemo(() => filterPapers(data.papers, filter), [filter]);

  const nodeColors = useMemo(
    () => (selectedPaper ? computeNodeColors(selectedPaper, data.stages) : new Map<string, string>()),
    [selectedPaper],
  );

  const edges = useMemo(() => {
    if (!selectedPaper) return backbone;
    return [...backbone, ...paperTraceEdges(selectedPaper, data.stages, layout, nodeColors)];
  }, [selectedPaper, backbone, layout, nodeColors]);

  const selectPaper = (pid: string) =>
    setSelection((prev) =>
      prev.kind === 'paper' && prev.paperId === pid
        ? { kind: 'none' }
        : { kind: 'paper', paperId: pid },
    );
  const clearSelection = () => setSelection({ kind: 'none' });

  return (
    <div className="app">
      <Header
        meta={data.meta}
        filter={filter}
        onChange={setFilter}
        resultCount={filteredPids.size}
        selectedPid={selectedPaper?.id ?? null}
        onClearSelection={clearSelection}
      />
      <div className="body">
        <Sidebar
          sidebar={data.sidebar}
          selectedPid={selectedPaper?.id ?? null}
          filteredPids={filterActive ? filteredPids : null}
          onSelect={selectPaper}
        />
        <main className="main-area">
          {selectedPaper && <PaperInfoBar paper={selectedPaper} />}
          <PipelineGraph
            stages={data.stages}
            layout={layout}
            edges={edges}
            paper={selectedPaper}
            nodeColors={nodeColors}
          />
        </main>
      </div>
    </div>
  );
}

function PaperInfoBar({ paper }: { paper: Paper }) {
  return (
    <header className="info-bar">
      <span className="ib-meta">
        <span className="ib-tag">{paper.did} {paper.domain}</span>
        {paper.isTopTier && <span className="ib-tag">Top-tier</span>}
        {paper.conference && <span className="ib-tag">{paper.conference}</span>}
        {paper.year && <span className="ib-tag">{paper.year}</span>}
        <span className="ib-tag">{paper.id}</span>
      </span>
      <span className="ib-title" title={paper.title}>{paper.title}</span>
      {paper.pathCount > 1 && (
        <span className="ib-legend">
          {paper.pathNodeIds.map((per, i) => {
            const formId = (per['artifact-form'] || [])[0];
            const form = formId ? formId.split('::')[1] : `Input ${i + 1}`;
            return (
              <span key={i} className="ib-legend-item">
                <span className="ib-legend-dot" style={cssVars({ '--accent': pathColor(i) })} />
                {form}
              </span>
            );
          })}
        </span>
      )}
    </header>
  );
}
