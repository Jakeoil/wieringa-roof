# Wieringa Roof

Printable nets for the Wieringa roof — the folded surface whose shadow is a
Penrose rhomb tiling.

Lift every rhombus of a Penrose tiling out of the plane and it becomes a *golden*
rhombus, thirty of which close up into a rhombic triacontahedron. Because every
face is the same shape, a physical model needs only one cut shape; the tiling
supplies nothing but the pattern of which rhombus joins which, and at what angle.

## Pages

| | |
|---|---|
| `index.html` | what the surface is |
| `net.html` | pick a patch, unfold it, print a sheet at true size |
| `roof3d.html` | orbit the surface itself |
| `info.html` | the mathematics — the lift, fold angles, curvature |
| `polyhedra.html` | the triacontahedron and the two golden rhombohedra |
| `legacy.html` | unfold a net by hand, choosing the route yourself |

## Running

```
npm install
npm run build      # copies three.js into vendor/, compiles src/ -> dist/
python3 -m http.server 8000
```

`dist/` and `vendor/` are generated and gitignored, so the build step is required
before serving. Deployment builds the same way in CI.

Command-line net generation, if you would rather not use the browser:

```
node tools/bfs-unfold.mjs --gen=3 --side=12mm --mode=widened --svg=out
```

## The geometry, briefly

Take the six five-fold axes of an icosahedron; put one on the vertical and the
other five form a cone, `E_j = (2/√5·cos 72j°, 2/√5·sin 72j°, 1/√5)`. A Penrose
vertex `Σ n_j ζ^j` lifts to `Σ n_j E_j`. From that:

- `E_j · E_k = ±1/√5` for every pair, so all ten face orientations are the same
  golden rhombus (63.4349° / 116.5651°, diagonals φ:1). Thick versus thin is only
  which corner meets the shared vertex.
- All five generators share `z = 1/√5`, so every edge rises or falls by exactly
  `s/√5`, inclined `arctan(½)`. Vertex height is `index · s/√5` with the index in
  `{1,2,3,4}` and nothing between — four tent-pole lengths would hold up the whole
  roof. Total relief is only `1.342 s`.
- Fold angles are **36°, 72° or 108°**, never 0°: every interior edge is a real
  crease.
- Negative-curvature (saddle) vertices have more than 360° of paper meeting at a
  point, so the faces around them cannot all stay joined. Every saddle forces a
  cut, and that is the whole difficulty of net-making here.

## Unfolding methods

Three, selectable on the net page:

- **Widened ribbons** (default) — take the longest de Bruijn ribbon as a backbone,
  then accrete neighbours onto it. Gathers 80–90% of a patch into one piece.
- **BFS** — spread outward in rings from a seed. Fewest pieces overall, but more
  evenly sized, so more real joins.
- **Ribbon strips** — pure de Bruijn ribbons. Every crease in a strip is parallel
  and spaced exactly `2/√5`, so a strip *provably* cannot overlap itself at any
  length. Elegant, but a ribbon only reaches the two fifths of rhombi sharing its
  direction, so you get many thin bands.

## Credit

The recursive P1 expansion is ported from
[penrose-mosaic](https://github.com/Jakeoil/penrose-mosaic), including the
star/boat/diamond cluster colours and the isogloss contour lines.
