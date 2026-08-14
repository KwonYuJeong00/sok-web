// Domain overview — a standalone page charting the FULL paper collection
// (source/taxonomy definitions/domain_paper_map.csv) as a pie of domains
// D01–D22 plus a grouped "Others" wedge (D23–D26), with per-domain paper
// tables below. Clicking a slice or its callout label scrolls to the table.
// Rendered instead of the pipeline diagram while the sidebar toggle is active;
// the pipeline view itself is untouched.
//
// Label scheme: wedges wide enough (>=10°) carry a DID + % pair inside;
// narrow wedges stay clean (share via hover tooltip). Every slice gets an
// elbow-leader callout with "DID Domain name"; the four Others callouts are
// additionally bundled by a "{" brace captioned "Others".
import { useMemo, useState } from 'react';
import type { CollectionDomain } from '../types';

interface Props {
  collection: CollectionDomain[];
}

/* ------------------------------ geometry ------------------------------- */
const W = 1400;
const H = 840;
const CX = 700;
const CY = 410;
const R = 272;
const TAU = Math.PI * 2;
const LABEL_X_RIGHT = 1030;
const LABEL_X_LEFT = 370;
const LINE_H = 19;

/* Every main domain gets its OWN colour — a soft pastel walk around the hue
 * wheel (blue → teal → green → yellow → coral → pink → violet), deliberately
 * skipping muddy brown/olive tones by keeping the warm band light and
 * saturated. Adjacent slices alternate light/deep so neighbours always
 * differ in value. The walk spans ~315° (210° down through red and back up
 * to 254°) so its two ends never meet — no two domains share a colour.
 * Others stays ONE slate hue varied in lightness only, reading as a unit. */
const MAIN_COLORS = [
  'hsl(222, 55%, 76%)', // D01 pale blue (table chip only — no papers yet)
  'hsl(210, 60%, 72%)', // D02 sky
  'hsl(193, 60%, 48%)', // D03 cyan deep
  'hsl(178, 48%, 68%)', // D04 aqua
  'hsl(163, 45%, 50%)', // D05 teal
  'hsl(147, 45%, 70%)', // D06 mint
  'hsl(131, 40%, 52%)', // D07 green
  'hsl(115, 45%, 70%)', // D08 leaf
  'hsl(103, 42%, 54%)', // D09 grass
  'hsl(97, 50%, 72%)',  // D10 apple
  'hsl(48, 82%, 56%)',  // D11 gold (the single yellow slot)
  'hsl(28, 82%, 72%)',  // D12 peach
  'hsl(14, 68%, 58%)',  // D13 burnt coral
  'hsl(2, 72%, 74%)',   // D14 salmon
  'hsl(350, 58%, 55%)', // D15 rose red
  'hsl(335, 60%, 74%)', // D16 pink
  'hsl(318, 45%, 55%)', // D17 plum
  'hsl(300, 45%, 74%)', // D18 orchid
  'hsl(282, 42%, 56%)', // D19 purple
  'hsl(266, 50%, 74%)', // D20 lavender
  'hsl(250, 45%, 58%)', // D21 violet
  'hsl(234, 55%, 76%)', // D22 periwinkle
];
// single hue, value steps only — first step dark against D22's pale
// periwinkle, last step darkest so the wrap-around boundary back to D02's
// light sky never pairs two pale tones
const OTHERS_LIGHTNESS = [52, 76, 62, 46];

function domainColor(scheme: string, i: number): string {
  if (scheme === 'Foundation') return MAIN_COLORS[i] ?? MAIN_COLORS[i % MAIN_COLORS.length];
  if (scheme === 'Application') return MAIN_COLORS[11 + i] ?? MAIN_COLORS[(11 + i) % MAIN_COLORS.length];
  return `hsl(215, 12%, ${OTHERS_LIGHTNESS[i % 4]}%)`;
}

interface Slice {
  did: string;
  name: string;
  scheme: string;
  count: number;
  a0: number;
  a1: number;
  pct: number;
  color: string;
}

interface OuterLabel {
  key: string;
  targetId: string;        // dom-<id> anchor to scroll to
  mid: number;             // slice mid-angle the leader starts from
  lines: string[];
  isOthers: boolean;       // grouped under the "}" Others brace
  hot: string[];           // dids whose hover highlights this label
  side: 1 | -1;            // 1 = right column, -1 = left column
  top: number;             // stacked y (top edge)
  h: number;
}

function arcPath(a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const x0 = CX + R * Math.cos(a0);
  const y0 = CY + R * Math.sin(a0);
  const x1 = CX + R * Math.cos(a1);
  const y1 = CY + R * Math.sin(a1);
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
}

const fmtPct = (p: number) => (p >= 10 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`);

function wrapLabel(text: string, max = 46): string[] {
  if (text.length <= max) return [text];
  let cut = text.lastIndexOf(' ', max);
  if (cut < 16) cut = max;
  return [text.slice(0, cut), text.slice(cut + 1)];
}

function build(collection: CollectionDomain[], colorOf: Map<string, string>) {
  const active = collection.filter((d) => d.paperCount > 0);
  const main = active.filter((d) => d.scheme !== 'Others');
  const others = active.filter((d) => d.scheme === 'Others');
  const ordered = [...main, ...others]; // DID order, Others contiguous at the end
  const total = ordered.reduce((n, d) => n + d.paperCount, 0);

  const slices: Slice[] = [];
  let acc = 0;
  for (const d of ordered) {
    const a0 = -Math.PI / 2 + (acc / total) * TAU;
    acc += d.paperCount;
    const a1 = -Math.PI / 2 + (acc / total) * TAU;
    slices.push({
      did: d.did,
      name: d.name,
      scheme: d.scheme,
      count: d.paperCount,
      a0,
      a1,
      pct: (d.paperCount / total) * 100,
      color: colorOf.get(d.did) ?? '#ccc',
    });
  }

  // ---- callout labels: name only, one per slice; Others slices get their
  // own leader + label too and are wrapped by a "{" brace in the render ----
  const labels: OuterLabel[] = [];
  for (const s of slices) {
    const mid = (s.a0 + s.a1) / 2;
    const lines = wrapLabel(`${s.did} ${s.name}`);
    labels.push({
      key: s.did,
      targetId: s.did,
      mid,
      lines,
      isOthers: s.scheme === 'Others',
      hot: [s.did],
      side: Math.cos(mid) >= 0 ? 1 : -1,
      top: 0,
      h: lines.length * LINE_H + 10,
    });
  }

  // ---- stack each side's labels top-to-bottom so they never collide ----
  for (const side of [1, -1] as const) {
    const col = labels
      .filter((l) => l.side === side)
      .sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));
    let cursor = 16;
    for (const l of col) {
      const ideal = CY + Math.sin(l.mid) * (R + 40) - l.h / 2;
      l.top = Math.max(ideal, cursor);
      cursor = l.top + l.h + 4;
    }
    let bottom = H - 16; // push back up if the column ran past the canvas
    for (let i = col.length - 1; i >= 0; i--) {
      const l = col[i];
      if (l.top + l.h > bottom) l.top = bottom - l.h;
      bottom = l.top - 4;
    }
  }

  return { slices, labels, total };
}

/* ------------------------------ component ------------------------------ */
export function DomainOverview({ collection }: Props) {
  const [hot, setHot] = useState<string | null>(null);

  // Stable per-domain colour (position within its scheme over the FULL
  // definition list) — D01 keeps a chip colour even with zero papers.
  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    const seen: Record<string, number> = {};
    for (const d of collection) {
      m.set(d.did, domainColor(d.scheme, seen[d.scheme] ?? 0));
      seen[d.scheme] = (seen[d.scheme] ?? 0) + 1;
    }
    return m;
  }, [collection]);

  const { slices, labels, total } = useMemo(
    () => build(collection, colorOf),
    [collection, colorOf],
  );

  const mainDomains = collection.filter((d) => d.scheme !== 'Others');
  const otherDomains = collection.filter((d) => d.scheme === 'Others');
  const othersTotal = otherDomains.reduce((n, d) => n + d.paperCount, 0);
  const othersDids = new Set(otherDomains.map((d) => d.did));

  // Hovering any Others sub-slice lights the whole slate group.
  const lit: Set<string> | null =
    hot == null ? null : othersDids.has(hot) ? othersDids : new Set([hot]);

  const scrollTo = (target: string) =>
    document
      .getElementById(`dom-${target}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const years = collection
    .flatMap((d) => d.papers.map((p) => parseInt(p.year, 10)))
    .filter((y) => !Number.isNaN(y));
  const yearRange = years.length ? `${Math.min(...years)}~${Math.max(...years)}` : '';

  return (
    <div className="overview-scroll">
      <section className="ov-card">
        <h2 className="ov-title">
          Collected papers by research domain ({yearRange}); {total} papers
        </h2>
        <svg
          className="ov-pie"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Distribution of ${total} collected papers across research domains`}
        >
          {/* slices */}
          {slices.map((s) => (
            <path
              key={s.did}
              d={arcPath(s.a0, s.a1)}
              fill={s.color}
              className={`ov-slice${lit && !lit.has(s.did) ? ' is-dim' : ''}`}
              onMouseEnter={() => setHot(s.did)}
              onMouseLeave={() => setHot(null)}
              onClick={() => scrollTo(s.did)}
            >
              <title>{`${s.did} ${s.name} — ${s.count} ${s.count === 1 ? 'paper' : 'papers'} (${fmtPct(s.pct)})`}</title>
            </path>
          ))}
          {/* crisp rim over the light wedges */}
          <circle cx={CX} cy={CY} r={R} className="ov-rim" fill="none" />

          {/* share labels — DID + % inside wedges wide enough to hold them;
              narrow wedges stay clean (share available via hover tooltip) */}
          {slices.map((s) => {
            const spanDeg = ((s.a1 - s.a0) / TAU) * 360;
            if (spanDeg < 10) return null;
            const mid = (s.a0 + s.a1) / 2;
            const x = CX + Math.cos(mid) * R * 0.68;
            const y = CY + Math.sin(mid) * R * 0.68;
            return (
              <g key={s.did} pointerEvents="none">
                <text x={x} y={y - 4} textAnchor="middle" className="ov-ilabel-did">
                  {s.did}
                </text>
                <text x={x} y={y + 16} textAnchor="middle" className="ov-ilabel-pct">
                  {fmtPct(s.pct)}
                </text>
              </g>
            );
          })}

          {/* elbow leader lines + name callouts (Others leaders stop short of
              the brace that groups their four labels) */}
          {labels.map((l) => {
            const colX = l.side === 1 ? LABEL_X_RIGHT : LABEL_X_LEFT;
            const p1x = CX + Math.cos(l.mid) * (R - 1);
            const p1y = CY + Math.sin(l.mid) * (R - 1);
            const p2x = CX + Math.cos(l.mid) * (R + 26);
            const p2y = CY + Math.sin(l.mid) * (R + 26);
            const yAnchor = l.top + 10;
            const inset = l.isOthers ? 26 : 10;
            const p3x = l.side === 1 ? colX - inset : colX + inset;
            const isHot = lit != null && l.hot.some((d) => lit.has(d));
            return (
              <g
                key={l.key}
                className={`ov-olabel${isHot ? ' is-hot' : ''}`}
                onMouseEnter={() => setHot(l.hot[0])}
                onMouseLeave={() => setHot(null)}
                onClick={() => scrollTo(l.targetId)}
              >
                <polyline
                  className="ov-leader"
                  fill="none"
                  points={`${p1x},${p1y} ${p2x},${p2y} ${p3x},${yAnchor}`}
                />
                {l.lines.map((ln, i) => (
                  <text
                    key={i}
                    x={colX}
                    y={l.top + 15 + i * LINE_H}
                    textAnchor={l.side === 1 ? 'start' : 'end'}
                    className="ov-olabel-text"
                  >
                    {ln}
                  </text>
                ))}
              </g>
            );
          })}

          {/* "{" brace bundling the four Others callouts, cusp toward the labels */}
          {(() => {
            const ol = labels.filter((l) => l.isOthers);
            if (ol.length === 0) return null;
            const side = ol[0].side;
            if (ol.some((l) => l.side !== side)) return null;
            const colX = side === 1 ? LABEL_X_RIGHT : LABEL_X_LEFT;
            const dir = side === 1 ? -1 : 1; // toward the pie
            const yTop = Math.min(...ol.map((l) => l.top)) + 2;
            const yBot = Math.max(...ol.map((l) => l.top + l.h)) - 2;
            const cy = (yTop + yBot) / 2;
            // "{" orientation: arms open toward the incoming leader lines,
            // cusp points at the label group
            const x0 = colX + dir * 23; // arm tips (leader side)
            const x1 = colX + dir * 12; // spine
            const x2 = colX + dir * 6;  // cusp (label side)
            const d =
              `M ${x0} ${yTop} Q ${x1} ${yTop} ${x1} ${yTop + 10}` +
              ` L ${x1} ${cy - 10} Q ${x1} ${cy} ${x2} ${cy} Q ${x1} ${cy} ${x1} ${cy + 10}` +
              ` L ${x1} ${yBot - 10} Q ${x1} ${yBot} ${x0} ${yBot}`;
            const isHot = lit != null && ol.some((l) => lit.has(l.hot[0]));
            return (
              <g
                className={`ov-brace-g${isHot ? ' is-hot' : ''}`}
                onMouseEnter={() => setHot(ol[0].hot[0])}
                onMouseLeave={() => setHot(null)}
                onClick={() => scrollTo('others')}
              >
                <path className="ov-brace" d={d} fill="none" />
                <text
                  x={x0 + dir * 7}
                  y={cy + 5}
                  textAnchor={side === 1 ? 'end' : 'start'}
                  className="ov-brace-caption"
                >
                  Others
                </text>
              </g>
            );
          })()}
        </svg>
      </section>

      {/* per-domain paper tables — every defined domain, including empty ones */}
      <div className="ov-tables">
        {mainDomains.map((d) => (
          <DomainSection key={d.did} d={d} color={colorOf.get(d.did) ?? 'var(--border)'} />
        ))}
        {otherDomains.length > 0 && (
          <section className="ov-others" id="dom-others">
            <h3 className="ov-others-head">
              Others <span className="ov-dom-paren">({othersTotal})</span>
            </h3>
            {otherDomains.map((d) => (
              <DomainSection
                key={d.did}
                d={d}
                color={colorOf.get(d.did) ?? 'var(--border)'}
                sub
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function DomainSection({
  d,
  color,
  sub,
}: {
  d: CollectionDomain;
  color: string;
  sub?: boolean;
}) {
  return (
    <section id={`dom-${d.did}`} className={`ov-domain${sub ? ' ov-domain--sub' : ''}`}>
      <h3 className="ov-dom-head">
        <span className="ov-dom-dot" style={{ background: color }} />
        <span className="ov-dom-did">{d.did}</span>
        <span className="ov-dom-name">
          {d.name} <span className="ov-dom-paren">({d.paperCount})</span>
        </span>
      </h3>
      <table className="ov-table">
        <thead>
          <tr>
            <th className="ov-col-n">#</th>
            <th className="ov-col-year">Year</th>
            <th>Paper Title</th>
            <th className="ov-col-conf">Conference / Journal</th>
          </tr>
        </thead>
        <tbody>
          {d.papers.length === 0 ? (
            <tr className="ov-row-na">
              <td className="ov-col-n">–</td>
              <td className="ov-col-year">–</td>
              <td>N/A</td>
              <td className="ov-col-conf">–</td>
            </tr>
          ) : (
            d.papers.map((p, i) => (
              <tr key={p.pid}>
                <td className="ov-col-n">{i + 1}</td>
                <td className="ov-col-year">{p.year}</td>
                <td>
                  {p.url ? (
                    <a
                      className="ov-link"
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {p.title}
                    </a>
                  ) : (
                    p.title
                  )}
                </td>
                <td className="ov-col-conf">{p.venue}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
