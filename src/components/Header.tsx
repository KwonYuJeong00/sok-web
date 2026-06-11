import type { Meta, FilterState } from '../types';

interface Props {
  meta: Meta;
  filter: FilterState;
  onChange: (f: FilterState) => void;
  resultCount: number;
  selectedPid: string | null;
  onClearSelection: () => void;
}

export function Header(props: Props) {
  const { meta, filter, onChange, resultCount, selectedPid, onClearSelection } = props;
  return (
    <header className="header">
      <h1 className="title">{meta.title}</h1>
      <div className="header-controls">
        <input
          type="search"
          className="search"
          placeholder="Search method / title…"
          value={filter.query}
          onChange={(e) => onChange({ query: e.target.value })}
        />
        <span className="result-count">
          <strong>{resultCount}</strong> / {meta.paperCount}
        </span>
      </div>
    </header>
  );
}
