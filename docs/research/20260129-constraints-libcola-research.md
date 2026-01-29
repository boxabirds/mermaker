# Mermaid Visual Editor: Constraint Systems & Layout Research

**Date:** 2026-01-29
**Goal:** Enable live direct-manipulation editing of arbitrary Mermaid diagrams with autolayout from text

---

## 1. Mermaid Diagram Types (Complete List)

Mermaid supports ~20 diagram types, reducible to 5-6 visual metaphors:

| Category | Types | Visual Metaphor |
|----------|-------|-----------------|
| **Flow/Process** | flowchart, graph, stateDiagram | Node-edge graph |
| **Interactions** | sequenceDiagram, journey | Lanes + messages |
| **Time-based** | gantt, timeline, gitGraph | Timeline bars |
| **Structure** | classDiagram, erDiagram, C4, architecture | UML boxes |
| **Data** | pie, xychart, quadrantChart, sankey | Chart segments |
| **Conceptual** | mindmap, requirementDiagram | Hierarchical tree |
| **Network** | packet, block | Block diagrams |

### Diagram Type Details

| Diagram Type | Natural Layout | Constraint Characteristics |
|--------------|----------------|----------------------------|
| flowchart | Layered (TB/LR/etc) | Hierarchical, directed edges |
| sequence | Lanes + timeline | Participants pinned to top, messages ordered |
| state | Layered or organic | States not strictly hierarchical |
| class | Organic with hierarchy | Inheritance relationships, compartments |
| ER | Organic | Entities with relationships |
| gantt | Timeline axis | Fixed axis, items positioned relative |
| journey | Lanes | Sections with steps |
| gitGraph | Layered (commits over time) | Branches, merges |
| mindmap | Radial/tree | Hierarchical from center |
| pie/quadrant/xy | Not graph layout | Specialized renderers |
| C4/architecture | Layered with containment | Nested containers |
| sankey | Flow with widths | Specialized flow visualization |

---

## 2. Common Constituent Elements

| Element | Appears In | Constraint Type |
|---------|------------|-----------------|
| **Node/Box** | All | Position (x,y), size, non-overlap |
| **Edge/Connector** | flowchart, sequence, ER, class, state | Routing around obstacles |
| **Lane/Swimlane** | sequence, journey | Vertical strip, participants pinned to top |
| **Timeline axis** | gantt, timeline, gitGraph | Fixed axis, items positioned relative |
| **Label** | All | Attached to parent element |
| **Group/Cluster** | flowchart (subgraph), class (package) | Containment, children inside bounds |
| **Port/Anchor** | Most | Connection point on parent boundary |

---

## 3. Constraint System Architecture

### Constraint Types Required

| Constraint | Description | Example Use |
|------------|-------------|-------------|
| **Separation** | `x1 + gap ≤ x2` | Non-overlapping nodes |
| **Alignment** | `x1 = x2` or `y1 = y2` | Sequence diagram participants on same row |
| **Containment** | `parent.left ≤ child.x ≤ parent.right` | Subgraph contains its nodes |
| **Fixed position** | `x = constant` | Lane header pinned to top |
| **Relative position** | `x1 = x2 + offset` | Label offset from parent |
| **Ordering** | `x1 < x2 < x3` | Timeline event sequence |
| **Distribution** | Equal spacing between elements | Grid layouts |

### Constraint Strengths (Cassowary Model)

- **Required** - Must be satisfied (non-overlap)
- **Strong** - Prefer strongly (alignment)
- **Medium** - Prefer (ideal spacing)
- **Weak** - Nice to have (centering)

---

## 4. Mermaid Parser Architecture

### Current State (JISON-based)

Mermaid currently uses **separate JISON parsers per diagram type**:
- `packages/mermaid/src/diagrams/flowchart/parser/flow.jison`
- `packages/mermaid/src/diagrams/class/parser/classDiagram.jison`
- etc.

Each diagram type has its own grammar file.

### Future State (Langium Migration)

Mermaid is migrating to Langium ([Issue #4401](https://github.com/mermaid-js/mermaid/issues/4401)):
- Unified, typed AST
- LSP support
- Better error reporting
- TypeScript integration

### Recommendation for Visual Editor

Build a **unified Mermaid parser** that outputs a typed AST:

```
MermaidAST {
  diagramType: "flowchart" | "sequence" | ...
  elements: Element[]
  relationships: Relationship[]
  metadata: DirectivesAndFrontmatter
}
```

Then **diagram-type-specific interpreters** convert AST to constraint models.

---

## 5. Layout Algorithms Comparison

### Dagre (Sugiyama/Hierarchical)

**Algorithm:** Layered/hierarchical layout (Sugiyama 1981)

**Approach:**
1. Assign nodes to layers
2. Minimize edge crossings
3. Assign coordinates

**Pros:**
- Good for flowcharts with clear direction
- Fast
- Minimizes edge crossings

**Cons:**
- Stateless - recomputes from scratch each time
- No concept of "previous position"
- Dragging a node then re-running = unpredictable jumps
- Not designed for interactive editing
- Outdated codebase (2015), minimal maintenance

### libcola (Stress Majorization + Constraints)

**Algorithm:** Force-directed via stress majorization with constraint projection

**Approach:**
1. Minimize stress (difference between graph-theoretic and Euclidean distances)
2. Project onto constraint-satisfying space using VPSC
3. Iterate until converged

**Pros:**
- Designed for interactive editing
- Stateful - refines from current positions
- Smooth adjustments when user drags nodes
- First-class constraint support (alignment, separation, containment)
- Topology preservation (with libtopology)

**Cons:**
- More complex
- Requires porting to Rust

### ELK (Eclipse Layout Kernel)

**Algorithm:** Multiple algorithms, flagship is layered (Sugiyama-based)

**Pros:**
- Highly configurable (140+ options)
- Supports compound graphs and ports
- Active development (academic team)

**Cons:**
- Complex, difficult to support
- Large file size
- Java-based (transpiled to JS)

### Comparison Summary

| Aspect | Dagre | libcola | ELK |
|--------|-------|---------|-----|
| **Algorithm** | Sugiyama layers | Stress majorization | Multiple (layered flagship) |
| **Interactive editing** | Poor | Excellent | Moderate |
| **Constraint support** | Limited | First-class | Configuration-based |
| **Topology preservation** | No | Yes (with libtopology) | No |
| **Maintenance** | Stale (2015) | Academic (Adaptagrams) | Active (academic) |
| **Incremental updates** | No | Yes | Partial |

### Recommendation

**libcola** is the right choice for a visual editor because:
1. Designed for interactive editing from the ground up
2. First-class constraint support
3. Smooth behavior when user manipulates diagram
4. Topology preservation prevents jarring jumps
5. Integrates with libavoid for connector routing

---

## 6. Adaptagrams Library Suite

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Adaptagrams                            │
├─────────────┬─────────────┬─────────────────────────────────┤
│             │             │                                 │
│  libvpsc    │  libavoid   │  (independent of each other)   │
│  (VPSC      │  (connector │                                 │
│   solver)   │   routing)  │                                 │
│             │             │                                 │
├─────────────┴─────────────┤                                 │
│                           │                                 │
│  libcola                  │  (depends on libvpsc only)     │
│  (stress majorization     │                                 │
│   + constraints)          │                                 │
│                           │                                 │
├───────────────────────────┴─────────────────────────────────┤
│                                                             │
│  libtopology                                                │
│  (topology preservation - depends on ALL THREE)             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  libdialect                                                 │
│  (human-like orthogonal layouts - depends on ALL THREE)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Library Details

| Library | Purpose | Dependencies | Status in Rust |
|---------|---------|--------------|----------------|
| **libvpsc** | Variable Placement with Separation Constraints solver | None | ✓ In libavoid-rust |
| **libavoid** | Object-avoiding connector routing (polyline + orthogonal) | None | ✓ libavoid-rust |
| **libcola** | Node layout via stress majorization with constraints | libvpsc | ✗ Not ported |
| **libtopology** | Topology preservation during edits | libvpsc, libcola, libavoid | ✗ Not ported |
| **libdialect** | Human-like orthogonal layouts | libvpsc, libcola, libavoid | ✗ Not ported |

### What Each Library Does

**libvpsc (Variable Placement with Separation Constraints):**
- Solves quadratic programming problem
- Minimizes squared differences from desired positions
- Subject to separation constraints: `x1 + gap ≤ x2`
- Foundation for all constraint-based layout

**libavoid:**
- Routes connectors around obstacles
- Polyline routing (any angle)
- Orthogonal routing (horizontal/vertical only)
- Visibility graph computation
- Incremental re-routing when shapes move

**libcola:**
- Stress majorization for organic layout
- Gradient projection onto constraint space (uses libvpsc)
- Cluster/group handling
- Directed graph layout
- Non-overlap constraints

**libtopology:**
- Tracks topology (which side of nodes/edges things are on)
- Ensures movements don't break crossing relationships
- Critical for sane interactive editing
- Prevents "jumping" behavior when dragging

**libdialect:**
- DiAlEcT = Decompose/Distribute, Arrange, Expand/Emend, Transform
- Produces human-like orthogonal network layouts
- Optional aesthetic refinement

---

## 7. libavoid-rust Current State

### What Exists

Location: `/Users/julian/expts/libavoid-rust/`

**Modules:**
- `geometry.rs` - Point, Polygon, Rectangle, Box
- `router.rs` - Main routing engine
- `connector.rs` - Connector definitions
- `shape.rs` - Shape/obstacle representation
- `visibility.rs` - Visibility graph computation
- `orthogonal.rs` - Orthogonal routing
- `vpsc.rs` - VPSC solver (for route nudging)
- `channel.rs` - VPSC-based route nudging
- `wasm.rs` - WebAssembly bindings

**VPSC Implementation:**
- Full `IncSolver` with variables, constraints, blocks
- Separation constraints: `left + gap ≤ right`
- Equality constraints
- Block merging algorithm
- Lagrange multiplier computation

**Current VPSC Usage:**
VPSC is used specifically for **nudging orthogonal routes** (separating overlapping parallel route segments), not for general node positioning.

### What's Missing

| Component | Purpose | Required For |
|-----------|---------|--------------|
| libcola | Node layout with constraints | Initial layout + interactive editing |
| libtopology | Topology preservation | Sane drag behavior |

---

## 8. Topology Preservation: Why It's Critical

### Without Topology Preservation

1. User drags node A slightly to the right
2. Constraint solver finds new valid positions
3. But solver doesn't know edge E used to go around node B on the left
4. New solution has edge E going around on the right
5. Or worse: node C was above node D, now below
6. Diagram "jumps" into technically valid but visually broken state

### User Experience Impact

- Drag one thing → half the diagram rearranges unexpectedly
- Lose mental model of the diagram
- Undo and try again → same problem
- Tool feels broken and unpredictable

### With Topology Preservation

- Constraints say **what** relationships must hold
- Topology says **how** things are currently arranged
- When you drag, solver respects both
- Nothing jumps through anything else
- Changes are local and predictable

### Conclusion

For live editing, **libtopology is required**, not optional.

---

## 9. Rust/WASM Constraint Solving

### Why Rust/WASM

- Constraint solving is O(n³) worst case
- Real-time interaction requires fast updates
- [webcola-wasm](https://github.com/Ameobea/webcola-wasm) shows **4x performance gains** over pure JS
- Already proven with libavoid-rust

### Available Rust Crates

| Crate | Purpose | Status |
|-------|---------|--------|
| [cassowary-rs](https://docs.rs/cassowary) | General linear constraint solving | Maintained |
| libavoid-rust | Connector routing + VPSC | Exists (yours) |

### What Needs Porting

| Component | Complexity | Reuses |
|-----------|------------|--------|
| libcola | Medium | Existing VPSC in libavoid-rust |
| libtopology | Medium-High | libcola, libavoid, libvpsc |

---

## 10. WebCola Constraint API Reference

WebCola (JavaScript port of libcola) supports three constraint types:

### Separation Constraints

```javascript
{
    type: "separation",
    axis: "y",
    left: 0,      // node index
    right: 1,     // node index
    gap: 25,
    equality: false  // true for exact distance
}
```

Enforces: `nodes[left].y + gap ≤ nodes[right].y`

### Alignment Constraints

```javascript
{
    type: "alignment",
    axis: "x",
    offsets: [
        {node: 1, offset: 0},
        {node: 2, offset: 0},
        {node: 3, offset: 0}
    ]
}
```

Aligns node centers (offset: 0) or with custom offsets.

### Group Constraints

```javascript
{
    leaves: [0, 1, 2],
    padding: 20,
    groups: [{leaves: [3, 4]}]  // nested groups
}
```

Clusters nodes into rectangular containers.

---

## 11. Key Research Papers

- **Sugiyama et al. (1981)** - Layered graph drawing (dagre basis)
- **Dwyer, Marriott, Wybrow (2008)** - [Topology Preserving Constrained Graph Layout](https://users.monash.edu/~mwybrow/papers/dwyer-gd-2008-1.pdf)
- **Dwyer, Marriott, Stuckey (2005)** - Fast Node Overlap Removal (VPSC basis)
- **Badros, Borning, Stuckey (2001)** - Cassowary constraint solver

---

## 12. Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      @mermaker/core (TypeScript)                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Mermaid      │  │ Constraint   │  │ Diagram Type          │  │
│  │ Parser       │  │ Model        │  │ Interpreters          │  │
│  │ (unified)    │  │ (elements +  │  │ (AST → constraints    │  │
│  │              │  │  constraints)│  │  per diagram type)    │  │
│  └──────┬───────┘  └──────────────┘  └───────────────────────┘  │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Constraint Solver (WASM)                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ libvpsc     │  │ libavoid    │  │ libcola         │   │   │
│  │  │ (in         │  │ (connector  │  │ (TO BE PORTED)  │   │   │
│  │  │ libavoid-rs)│  │  routing)   │  │                 │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  │                   ┌─────────────────┐                     │   │
│  │                   │ libtopology     │                     │   │
│  │                   │ (TO BE PORTED)  │                     │   │
│  │                   └─────────────────┘                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Visual Canvas (per framework)            │   │
│  │         React / Svelte / Web Components                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. What Needs to Be Built

### Required Components

| Component | Priority | Effort | Notes |
|-----------|----------|--------|-------|
| Unified Mermaid parser | High | Medium | Or wait for Langium migration |
| libcola-rust | High | Medium | Reuses existing VPSC |
| libtopology-rust | High | Medium-High | Required for sane editing |
| Diagram type interpreters | High | High | One per diagram type |
| Mermaid serializer | High | Medium | Model → Mermaid text |
| Visual canvas | Medium | Medium | React Flow or similar |
| Framework bindings | Low | Low | Thin wrappers |

### Porting libcola

libcola's main additions over libvpsc:
1. **Stress majorization** - Iterative layout loop
2. **Gradient projection** - Project gradient onto constraint space
3. **Cluster handling** - Groups of nodes

Since VPSC exists in libavoid-rust, porting libcola would reuse that foundation.

### Porting libtopology

Adds topology preservation:
1. Track which side of nodes/edges things are on
2. Ensure movements preserve these relationships
3. Integrates with libcola's layout loop

---

## 14. Sources

### Libraries & Tools
- [Adaptagrams](https://www.adaptagrams.org/) - C++ constraint layout libraries
- [WebCola](https://ialab.it.monash.edu/webcola/) - JavaScript port of libcola
- [libavoid-rust](file:///Users/julian/expts/libavoid-rust) - Rust port of libavoid
- [cassowary-rs](https://docs.rs/cassowary) - Rust Cassowary implementation
- [Mermaid](https://mermaid.js.org/) - Diagramming library

### Research
- [Dunnart Paper](https://www.researchgate.net/publication/221557356_Dunnart_A_Constraint-Based_Network_Diagram_Authoring_Tool) - Constraint-based diagram editor
- [Topology Preserving Layout](https://link.springer.com/chapter/10.1007/978-3-642-00219-9_22) - Dwyer, Marriott, Wybrow
- [Cassowary Algorithm](https://en.wikipedia.org/wiki/Cassowary_(software)) - Constraint solving

### Mermaid Internals
- [Langium Migration Issue](https://github.com/mermaid-js/mermaid/issues/4401)
- [AST Access Request](https://github.com/mermaid-js/mermaid/issues/2523)
- [Visual Editor Feature Request](https://github.com/mermaid-js/mermaid-live-editor/issues/1284) (closed as not planned)
