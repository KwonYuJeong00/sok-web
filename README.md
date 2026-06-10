# SoK: AI-assisted Binary Reversing — interactive pipeline

A static web app that visualises the AI-assisted binary-reversing pipeline as a
**flow diagram**. Every stage is a column listing *all of its possible entries*
(e.g. the 9 Artifact-class nodes). Pick a paper from the left and the entries it
uses light up, connected column-to-column into a path. Papers with several
inputs draw parallel, colour-coded paths that fuse through a `+` / `-->` marker
just before **Learning**.

**80 papers · 19 research domains · 10 pipeline stages · up to 4 parallel input paths.**

## Pipeline stages

Each column shows a default label on its nodes. **Click a highlighted node** to
reveal a secondary value in a popover — shown **verbatim** from the source sheet.

| # | Column | Node shows (default) | Click reveals | CSV column(s) |
|---|--------|----------------------|---------------|---------------|
| 1 | **Analysis** | analysis phase (Triage / Static / Dynamic / Security Testing / Hybrid) | — | `Analysis` |
| 2 | **Artifact class** | one of 9 canonical classes (singular form) | the raw artifact(s) | `Artifact class`; `Artifact` |
| 3 | **Artifact form** | Sequence / Graph / Numeric descriptor / Image | the transformation chain | `Artifact form`; `Transformation` |
| 4 | **Canonicalization** | short label — Scale / Replace / Remove / Map / Transform / Extract | the full method | `Canonicalization`; `Canonicalization_Method` |
| 5 | **Tokenization** *(sequence inputs only)* | the token unit | the technique | `Token Unit`; `Tokenization_Technique` |
| 6 | **Encoding** | Sparse / Dense | examples | `Encoding`; `Encoding examples` |
| 7 | **Embedding** | Context-dependent / Context-independent | examples | `Embedding_Method`; `Embedding examples` |
| 8 | **Learning** | learning category (Discriminative / Generative / LLM-based / …) | subcategory; model architecture | `Learning_Category`; `Learning_Subcategory`; `for claude` |
| 9 | **Inference** | inference category (Detection / Recovery / …) | evaluation metric | `Inference_Category`; `Evaluation_Metric` |

Columns 1–7 are **per input path**; columns 8–9 are the **shared tail** where a
paper's inputs fuse into one downstream model. Tokenization is skipped (no nodes)
for non-sequence inputs.

## Data

The build reads exactly **two** files from `source/`:

- `ai_pipeline_final_sheet.csv` — the primary sheet, one row per paper.
- `taxonomy definitions/domain_definition.csv` — scheme / tier / inference-type
  per domain (D01–D26), used to build the sidebar tree and the per-paper tags.

The other files in `source/taxonomy definitions/` (`artifact_class.csv`,
`inference_type.csv`, `tokenization_taxonomy.csv`, `domain_paper_map.csv`) are
**reference taxonomies** the normalizer's canonical lists are based on; they are
documentation only and not read at build time.

`scripts/normalize-data.mjs` reads the sheet at **build time** and emits
`src/data/normalizedData.json`, which is imported straight into the bundle —
nothing is fetched at runtime, so the deployed site is fully static. Values are
preserved verbatim: only a column's **default node label** is normalised (canonical
class, short canon label, phase, etc.); every **click-reveal** value comes directly
from the sheet.

### Updating the data

1. Edit `source/ai_pipeline_final_sheet.csv` (or `domain_definition.csv`).
2. `npm run normalize` — regenerate `src/data/normalizedData.json`.
3. `npm run audit` — check the generated data against the sheet (flags dropped
   values, lane-count mismatches, and values that fall through normalisation).
4. `npm run dev` (or `npm run build`) to see the change.

## Requirements

| Tool | Minimum | Recommended |
|------|---------|-------------|
| **Node.js** | 16.0.0 | **20 LTS** |
| **npm** | 7.0.0 | ships with Node 20 |

## Installation & local development

### Linux / macOS

```bash
# Install Node 20 via nvm (https://github.com/nvm-sh/nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # or ~/.zshrc
nvm install 20 && nvm use 20

# Clone and run
git clone https://github.com/KwonYuJeong00/sok-web.git
cd sok-web
npm install
npm run normalize
npm run dev        # → http://localhost:5173
```

### Windows

Install **Node 20 LTS** from <https://nodejs.org/en/download/> (tick "Add to PATH"), then in PowerShell or Git Bash:

```powershell
git clone https://github.com/KwonYuJeong00/sok-web.git
cd sok-web
npm install
npm run normalize
npm run dev        # → http://localhost:5173
```

### Available commands

```bash
npm run normalize   # CSV → src/data/normalizedData.json
npm run audit       # sanity-check the generated data
npm run dev         # Vite dev server
npm run build       # normalize + type-check + production build → dist/
npm run preview     # serve the production build locally
```

`npm run build` always re-runs `normalize` first, so the bundled data stays in
lock-step with the CSV.

### Troubleshooting

#### `notsup Unsupported engine` / `SyntaxError: Unexpected identifier`

```
npm ERR! notsup Required: {"node":"^14.18.0 || >=16.0.0"}
npm ERR! notsup Actual:   {"node":"10.19.0"}
```

Your Node version is too old. Upgrade to Node 20 using the steps above.
The `SyntaxError: Unexpected identifier` on `import fs from 'node:fs'` is the
same root cause — Node 10 does not support ES-module syntax.

#### Port already in use

```bash
npm run dev -- --port 3000   # pick any free port
```

## Project layout

```
sok-web/
├── source/
│   ├── ai_pipeline_final_sheet.csv        primary data (read at build)
│   └── taxonomy definitions/
│       ├── domain_definition.csv          domains (read at build)
│       ├── artifact_class.csv             reference taxonomy
│       ├── inference_type.csv             reference taxonomy
│       ├── tokenization_taxonomy.csv      reference taxonomy
│       └── domain_paper_map.csv           reference (PID -> DID + venue)
├── scripts/
│   ├── normalize-data.mjs                 CSV -> JSON
│   └── audit.mjs                          ground-truth audit (npm run audit)
├── src/
│   ├── App.tsx                            top-level state & composition
│   ├── main.tsx                           React entry point
│   ├── index.css                          all styles
│   ├── types.ts                           shared TypeScript types
│   ├── data/normalizedData.json           generated; safe to commit
│   ├── lib/
│   │   ├── data.ts                        loads the JSON + paper lookup
│   │   ├── filters.ts                     search logic
│   │   ├── layout.ts                      column / node geometry
│   │   ├── edges.ts                       backbone + trace edges
│   │   ├── highlight.ts                   per-cell highlight colours
│   │   ├── colors.ts                      stage / path / scheme palettes
│   │   └── style.ts                       CSS-var helper
│   └── components/
│       ├── Header.tsx                     title + search
│       ├── Sidebar.tsx                    scheme -> domain -> paper tree
│       ├── PipelineGraph.tsx              the flow diagram (columns + SVG edges)
│       └── CategoryNode.tsx               one node + click-to-expand popover
├── vercel.json
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Stack

React 18 · TypeScript · Vite 6 · zero runtime dependencies beyond React. The
flow diagram is a custom absolute-positioned layout with an SVG edge layer — no
charting library — so the bundle stays small and the site works offline as a
pure static app.
