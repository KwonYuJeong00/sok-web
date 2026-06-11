import { cssVars } from '../lib/style';
import type { CategoryNode } from '../types';
import type { Box } from '../lib/layout';

function renderPopText(value: string, key: string, breakArrow = false) {
  const parts = value.split(';').map((p) => p.trim()).filter(Boolean);
  const text = (parts.length > 1 ? parts.join('\n') : value)
    .replace(/\s*-->/g, '\n-->')
    .replace(breakArrow ? /([^-])\s*->/g : /(?!)/g, '$1\n->')
    .split('\n').map((l) => l.length > 0 ? l[0].toUpperCase() + l.slice(1) : l).join('\n');
  return <span key={key} className="node-pop-text">{text}</span>;
}

interface PathReveal { color: string; text: string; }

interface Props {
  node: CategoryNode;
  box: Box;
  color: string;            // stage hue
  connector?: boolean;      // render as a compact +/--> marker, not a column node
  paperSelected: boolean;
  highlighted: boolean;
  hitColor?: string;        // per-path highlight colour when hit
  detail?: string[];        // secondary detail (inline when not expandable, else in popup)
  expandable: boolean;
  expandLabel: string;
  detailLabel: string;      // popup heading for the detail value
  reveal?: string[];        // click-to-expand value(s)
  pathReveals?: PathReveal[]; // per-path reveal entries with artifact-form color prefix
  open: boolean;
  onToggle: () => void;
  stripeColors?: string[];  // right-edge path-color strips (analysis column only)
  breakArrow?: boolean;     // insert newline before '->' in popup text
}

export function CategoryNodeView(props: Props) {
  const {
    node, box, color, connector, paperSelected, highlighted, hitColor, detail, expandable,
    expandLabel, detailLabel, reveal, pathReveals, open, onToggle, stripeColors, breakArrow,
  } = props;

  // Learning-model connector: a small pill (+ / -->) showing how the upstream
  // embeddings are combined. Only rendered when the selected paper uses it.
  if (connector) {
    const sequential = node.label.includes('>');
    const label = detail?.[0];
    return (
      <div
        className="node is-connector"
        style={cssVars({
          left: box.x, top: box.y, width: box.w, height: box.h, '--stage-color': color,
        })}
        title={sequential ? 'Embeddings applied sequentially' : 'Embeddings combined in parallel'}
      >
        {label && <span className="connector-label">{label}</span>}
        <span className={`connector-mark${sequential ? ' connector-mark--seq' : ''}`}>{node.label}</span>
      </div>
    );
  }

  const dimmed = paperSelected && !highlighted;
  const className =
    `node${highlighted ? ' is-hit' : ''}${dimmed ? ' is-dimmed' : ''}` +
    `${expandable ? ' is-expandable' : ''}${open ? ' is-open' : ''}`;
  const style = cssVars({
    left: box.x, top: box.y, width: box.w, height: box.h, '--stage-color': color,
    ...(highlighted && hitColor ? { '--hit-color': hitColor } : {}),
  });

  // Detail shows inline only for non-expandable nodes; expandable nodes surface it
  // inside the popup (keeps long text from overflowing and hiding the node label).
  const detailText =
    highlighted && !expandable && detail && detail.length ? detail.join('; ') : '';

  const inner = (
    <>
      <span className="node-label">{node.label}</span>
      {detailText && <span className="node-detail">{detailText}</span>}
      {!paperSelected && (
        <span className="node-count">{node.paperCount}</span>
      )}
      {highlighted && expandable && detailLabel && detail && detail.length > 0 && (
        <span className="node-expand">{open ? '−' : '+'} {detailLabel}</span>
      )}
      {highlighted && expandable && (
        <span className="node-expand">{open ? '−' : '+'} {expandLabel}</span>
      )}
      {highlighted && stripeColors && stripeColors.length > 0 && (
        <div className="node-stripes">
          {stripeColors.map((c, i) => (
            <div key={i} className="node-stripe" style={{ background: c }} />
          ))}
        </div>
      )}
      {open && (
        <div className={`node-pop${node.stageId === 'analysis' ? ' node-pop--left' : ''}`} role="dialog">
          {detail && detail.length > 0 && detailLabel && (
            <>
              <span className="node-pop-label">{detailLabel}</span>
              {detail.map((d, i) => renderPopText(d, `d${i}`, breakArrow))}
            </>
          )}
          <span className="node-pop-label">{expandLabel}</span>
          {pathReveals && pathReveals.length > 0 ? (
            pathReveals.map(({ color: dotColor, text }, i) => (
              <div key={i} className="node-pop-path">
                <span className="node-pop-dot" style={{ background: dotColor }} />
                <div className="node-pop-path-text">{renderPopText(text, `pr${i}`, breakArrow)}</div>
              </div>
            ))
          ) : reveal && reveal.length > 0 ? (
            reveal.map((r, i) => renderPopText(r, `r${i}`, breakArrow))
          ) : (
            <span className="node-pop-text">N/A</span>
          )}
        </div>
      )}
    </>
  );

  return highlighted && expandable ? (
    <button
      type="button"
      className={className}
      style={style}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      {inner}
    </button>
  ) : (
    <div className={className} style={style}>
      {inner}
    </div>
  );
}
