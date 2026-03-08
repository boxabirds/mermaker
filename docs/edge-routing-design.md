# Edge Routing Architecture: Design Review & Fix Plan

## Current State: What's Broken

### 1. Arrows disconnected from nodes
`clipAtBorder()` adds `ARROW_TIP_GAP` (6px) offset beyond the node border.
The SVG marker `refX=ARROW_SIZE` already places the arrow tip at the path
endpoint. Adding the gap means the arrow tip floats 6px from the node border.

**Fix:** Remove ARROW_TIP_GAP from clipAtBorder. The marker system handles
arrowhead placement. The path endpoint should be ON the node border, and
the marker draws the arrow tip there.

### 2. Arrows overlapping/hidden by nodes
The real problem ARROW_TIP_GAP was trying to solve: if the path endpoint is
inside the node (due to clipping errors or rounding), the arrowhead is hidden.
But the fix (offsetting outward) causes disconnection.

**Root cause:** `clipAtBorder` uses `inside[0]` (node center coordinate) for
one axis of the clip point. For orthogonal segments this works, but for
segments that aren't perfectly H/V, the clip point can land inside the node.

**Fix:** Use `clipToNodeBorder()` (the geometry function) instead of the
hand-rolled `clipAtBorder`. It handles all shapes correctly and always
produces a point ON the border.

### 3. Text labels obscured by nodes
`_getRouteMidpoint()` returns the geometric middle waypoint. For 3-waypoint
L-bend routes, this is the corner — which often coincides with a node.

**Fix:** For L-bend routes, place the label on the LONGER segment's midpoint,
not at the corner. For multi-waypoint routes, find the longest segment and
place the label at its midpoint.

### 4. Two separate edge pipelines
Router edges go through `clipRouterWaypoints`. Non-router edges go through
`assignPorts` + `fixDiagonalEdges`. These produce different visual results.

During drag, the router re-routes all connected edges, producing multi-waypoint
routes. But `reassignPorts` then runs `fixDiagonalEdges` which only touches
2-waypoint edges — so router edges are left alone. This is correct but means
the two styles coexist in the same diagram.

**Fix:** This is acceptable. The router produces better routes (obstacle
avoidance, nudge separation). Non-router edges are simpler but correct.
The key is that BOTH pipelines should produce endpoints ON the node border
(not offset from it).

### 5. Diamond shapes: arrows miss the border
`clipAtBorder` assumes rectangular borders (halfW/halfH). Diamonds have
diagonal borders. The clip point lands on the rect border, not the diamond
border, so arrows float or clip incorrectly.

**Fix:** Use `clipToNodeBorder()` which dispatches to `clipToDiamondBorder()`
for diamond shapes. This requires passing the node's shape to the clipping
function.

## Proposed Architecture

### Single clipping function for all paths

Replace `clipAtBorder` with calls to `clipToNodeBorder` from geometry.js.
This function already handles rect, diamond, and other shapes correctly.

For multi-waypoint routes, the clipping needs to:
1. Find the first/last waypoint outside the node
2. Clip the segment crossing the border using `clipToNodeBorder`
3. The clip point is the direction FROM the outside waypoint TOWARD the node center

```javascript
// For target end:
const lastOutside = trimmed[trimmed.length - 1];
const tgtClip = clipToNodeBorder(tgtPos, lastOutside[0], lastOutside[1]);
trimmed.push(tgtClip);
```

This produces a point ON the border. The SVG marker places the arrow tip
at this point. No gap needed.

### Label placement improvement

```javascript
_getRouteMidpoint(waypoints) {
  if (waypoints.length <= 2) {
    // Straight line: midpoint
    return [(a[0]+b[0])/2, (a[1]+b[1])/2];
  }
  // Find longest segment and use its midpoint
  let maxLen = 0, maxIdx = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const len = distance(waypoints[i], waypoints[i+1]);
    if (len > maxLen) { maxLen = len; maxIdx = i; }
  }
  const a = waypoints[maxIdx], b = waypoints[maxIdx + 1];
  return [(a[0]+b[0])/2, (a[1]+b[1])/2];
}
```

## Implementation Order

1. Remove ARROW_TIP_GAP from clipAtBorder and clipStraightRoute
2. Replace clipAtBorder with clipToNodeBorder calls (pass shape info)
3. Fix _getRouteMidpoint for L-bend/multi-waypoint routes
4. Test all gallery examples
5. Test drag for all gallery examples

## Key Invariant

After all processing, every edge's waypoints must satisfy:
- First waypoint is ON the source node's border
- Last waypoint is ON the target node's border
- All intermediate segments are orthogonal (dx=0 or dy=0)
- No waypoint is inside any node (except source/target borders)

The SVG marker system handles arrowhead rendering. The path endpoint
is where the arrow tip goes. No manual gap or offset is needed.
