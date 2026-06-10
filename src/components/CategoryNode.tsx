import { cssVars } from '../lib/style';
import type { CategoryNode } from '../types';
import type { Box } from '../lib/layout';

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
  open: boolean;
  onToggle: () => void;
}

export function CategoryNodeView(props: Props) {
  const {
    node, box, color, connector, paperSelected, highlighted, hitColor, detail, expandable,
    expandLabel, detailLabel, reveal, open, onToggle,
  } = props;

  // Learning-model connector: a small pill (+ / -->) showing how the upstream
  // embeddings are combined. Only rendered when the selected paper uses it.
  if (connector) {
    const sequential = node.label.includes('>');
    return (
      <div
        className="node is-connector"
        style={cssVars({
          left: box.x, top: box.y, width: box.w, height: box.h, '--stage-color': color,
        })}
        title={sequential ? 'Embeddings applied sequentially' : 'Embeddings combined in parallel'}
      >
        <span className="connector-mark">{node.label}</span>
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

  const expandHint = [
    detail && detail.length && detailLabel ? detailLabel : '',
    expandLabel,
  ].filter(Boolean).join('; ');

  const inner = (
    <>
      <span className="node-label">{node.label}</span>
      {detailText && <span className="node-detail">{detailText}</span>}
      {!paperSelected && node.paperCount > 0 && (
        <span className="node-count">{node.paperCount}</span>
      )}
      {highlighted && expandable && (
        <span className="node-expand">{open ? '−' : '+'} {expandHint}</span>
      )}
      {open && (
        <div className="node-pop" role="dialog">
          {detail && detail.length > 0 && detailLabel && (
            <>
              <span className="node-pop-label">{detailLabel}</span>
              {detail.map((d, i) => (
                <span key={`d${i}`} className="node-pop-text">{d}</span>
              ))}
            </>
          )}
          <span className="node-pop-label">{expandLabel}</span>
          {reveal && reveal.length > 0 ? (
            reveal.map((r, i) => (
              <span key={`r${i}`} className="node-pop-text">{r}</span>
            ))
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
