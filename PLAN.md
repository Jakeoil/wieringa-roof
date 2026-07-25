# Wieringa Roof — Interactive Golden Rhombus Net Builder

## Goal

An interactive tool for exploring the Wieringa roof. The screen shows a Penrose
rhomb tiling (gen-3 deflation) with colored tiles. A separate work canvas shows
the net being built. The user clicks a tile or tile edge in the tiling to place
the corresponding golden rhombus (side φ−½ ≈ 1.118") on the work canvas.
Overlaps are allowed. Tiles can be removed. The user explores different unfolding
routes manually.

## Two-Canvas Layout

**Left: Tiling view**
- Gen-3 Penrose rhomb tiling (thick 72° / thin 36°)
- Colored by type (thick/thin) or by vertex index
- Click a rhomb → adds it to the work canvas
- Click an edge → adds the neighbor across that edge
- Highlight placed rhombs (so you can see what's already in the net)

**Right: Work canvas (net)**
- Golden rhombi laid flat, unfolded from the tiling
- Each new rhomb is reflected across the shared edge of the last placement
- Shows fold lines (ridge/valley), vertex index labels
- Click a placed rhomb to remove it
- The net represents what will be printed/cut

## Golden Rhombus Dimensions

All rhombi are identical golden rhombi:
- Side: φ − ½ = √5/2 ≈ 1.118"
- Short diagonal: √(3−φ) ≈ 1.176"
- Long diagonal: √(2+φ) ≈ 1.902"
- Acute angle: arctan(2) ≈ 63.43°

The work canvas is scaled 1:1 to inches for print fidelity.

## Data Model

### Rhomb (from tiling)

```
Rhomb {
    id: number
    vertices: [v0, v1, v2, v3]   // 2D Penrose coordinates
    thick: boolean
    isHeads: boolean              // v0 high or v0 low
    edges: [Edge, Edge, Edge, Edge]
}
```

### Vertex

```
Vertex {
    id: number
    pos: Point
    index: number                 // 1–4 (Wieringa height)
}
```

### Edge

```
Edge {
    v1: Vertex, v2: Vertex
    rhombs: [Rhomb, Rhomb | null] // the two rhombs sharing this edge
    foldType: 'ridge' | 'valley' | 'boundary'
}
```

### NetRhomb (on work canvas)

```
NetRhomb {
    sourceRhomb: Rhomb            // link back to tiling
    flatVertices: [P, P, P, P]    // 2D positions on the work canvas (inches)
    foldEdges: FoldInfo[]         // which edges are folds, ridge/valley
}
```

## Vertex Index Propagation

1. Generate all rhombs from gen-3 deflation
2. Build vertex/edge adjacency from positions
3. Seed: star center → index 4
4. BFS: across each edge, index changes by ±1
5. `isHeads` gives direction: v0 high → index(v0) > index(v2)

## Unfolding Mechanics

When the user clicks a tiling rhomb adjacent to the current net:

1. Find the shared edge E between the new rhomb and an existing net rhomb
2. In the work canvas, reflect the golden rhombus template across E
3. Place it (even if overlapping — the user decides)
4. Mark fold type on the shared edge (ridge or valley, from vertex indices)

When no shared edge exists (first rhomb, or disconnected placement):
- Place the golden rhombus at a default position on the work canvas

## Implementation Phases

### Phase 1: Project setup + tiling display
- npm + TypeScript (same structure as pentagrid)
- Generate gen-3 rhomb tiling via deflation
- Render colored rhombs on left canvas
- Vertex index computation and display

### Phase 2: Interaction + work canvas
- Click detection (which rhomb / which edge was clicked)
- Work canvas with golden rhombus template
- Place first rhomb, unfold neighbors across edges
- Remove rhombs on click

### Phase 3: Annotations
- Fold lines (ridge/valley) on work canvas
- Vertex index labels at corners
- Highlight placed rhombs in the tiling view

### Phase 4: Print
- Export work canvas as SVG for clean printing
- 8.5 × 10" page bounds shown on work canvas
- Cut lines, fold lines, labels

## Tech

- TypeScript + Canvas 2D
- npm project (like pentagrid)
- `src/` → `dist/` via tsc
- Static HTML served locally
