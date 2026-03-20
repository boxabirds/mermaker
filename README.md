# Mermaker

A direct manipulation editor for [Mermaid](https://mermaid.js.org/) diagrams. What mermaid.live should have been — drag nodes, edges follow, text updates.

## Vision

Mermaid is the most popular text-to-diagram language, but editing diagrams as raw text is painful. You can't see what you're changing until you re-render, and there's no way to nudge a node or reshape an edge. Mermaker bridges the gap: you get a live split-pane editor where the diagram is a first-class interactive canvas, not a read-only preview.

The goal is a `<mer-maker>` web component you can drop into any page — with React and Svelte wrappers to follow.

### Architecture

- **Vanilla JS + SVG** — no framework, no build step for dev (`npx serve .` and ES modules)
- **Mermaid.js** for parsing (pinned version, isolated behind an extractor layer)
- **libdialect (HOLA)** compiled to WASM for initial orthogonal layout — clean right-angle edges
- **libtopology** compiled to WASM for topology-preserving drag (planned)
- Positions stored separately from mermaid text (mermaid has no position syntax)

## Status

### Working

- **Flowchart parsing** — mermaid text is parsed via mermaid's internal API and extracted into a clean graph model
- **Hierarchical layout** — nodes are positioned using a layered/hierarchical algorithm with configurable direction (TD, LR, etc.)
- **SVG rendering** — nodes render as interactive SVG with correct shapes (rectangles, rounded rects, diamonds, circles, etc.)
- **Edge routing** — orthogonal edges with proper arrow connections to node borders, label placement that avoids overlapping nodes, and diamond-specific port assignment
- **Live sync** — edit text on the left, diagram updates on the right
- **Node interaction** — hover highlighting on nodes
- **Examples gallery** — a set of sample flowcharts for testing

### Not yet working

- **Drag to move nodes** — the core interaction (requires libtopology WASM integration)
- **Edge manipulation** — no direct edge reshaping yet
- **Text sync (diagram → text)** — dragging a node doesn't update the mermaid source
- **Sequence diagrams** — planned (grid layout, no WASM needed), decomposed into 6 stories
- **Web component packaging** — `<mer-maker>` element not yet implemented
- **Framework wrappers** — React, Svelte
- **WASM layout** — libdialect WASM is built but not yet wired into the browser layout pipeline; currently using a pure-JS hierarchical layout

## Backlog

Project planning and backlog management is handled through [Ceetrix](https://ceetrix.com). Stories are spec'd with PRDs, designs, and implementation tasks before work begins.

## Development

```bash
npm install      # or bun install
npx serve .      # serves on localhost:3000
```

No build step required — the app runs directly from ES modules with an import map.

### Tests

```bash
npm test                # unit + integration
npm run test:unit       # unit only
npm run test:e2e        # end-to-end (starts a local server)
npm run test:smoke      # quick smoke test
```

## License

Apache 2.0
