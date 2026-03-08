import { CSS_PREFIX, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '../util/constants.js';
import { clipToNodeBorder } from '../util/geometry.js';
import { computeGroupBounds } from '../layout/layout-engine.js';
import { reassignPorts } from '../layout/port-assigner.js';
import { moveObstacleAndReroute } from '../layout/edge-router.js';

/**
 * Attach drag and viewport interaction to an SVG renderer.
 * Returns a cleanup function that removes all event listeners.
 *
 * @param {import('./svg-renderer.js').SvgRenderer} renderer
 * @param {object} layoutEngine - { moveNode, releaseNode, initTopology }
 * @param {import('../layout/layout-engine.js').PositionMap} positions
 * @param {import('../layout/graph-builder.js').HolaGraphSpec} spec
 * @param {import('../layout/edge-router.js').RouterState|null} instanceRouterState
 * @returns {() => void} cleanup function
 */
export function enableInteraction(renderer, layoutEngine, positions, spec, instanceRouterState) {
  const svg = renderer.svg;
  const viewport = renderer.viewport;
  const ac = new AbortController();
  const opts = { signal: ac.signal };

  let dragging = null;
  let draggingGroup = null;
  let panState = null;

  let viewTranslateX = 0;
  let viewTranslateY = 0;
  let viewScale = 1;

  // viewBox on the SVG handles initial centering and fit.
  // Pan/zoom uses translate+scale on the viewport group for interactive movement.

  function updateViewportTransform() {
    viewport.setAttribute(
      'transform',
      `translate(${viewTranslateX}, ${viewTranslateY}) scale(${viewScale})`
    );
  }

  function screenToSvg(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewTranslateX) / viewScale,
      y: (clientY - rect.top - viewTranslateY) / viewScale,
    };
  }

  /**
   * Recompute edge routes for edges connected to any node in the given set.
   */
  function recomputeEdgesForNodes(nodeIds, currentPositions) {
    for (const edge of currentPositions.edges) {
      if (nodeIds.has(edge.source) || nodeIds.has(edge.target)) {
        const srcPos = currentPositions.nodes.get(edge.source);
        const tgtPos = currentPositions.nodes.get(edge.target);
        if (srcPos && tgtPos) {
          const srcExit = clipToNodeBorder(srcPos, tgtPos.x, tgtPos.y);
          const tgtEntry = clipToNodeBorder(tgtPos, srcPos.x, srcPos.y);
          edge.waypoints = [srcExit, tgtEntry];
        }
      }
    }
  }

  svg.addEventListener('pointerdown', (e) => {
    // Check for node drag first (nodes are on top of groups)
    const nodeEl = e.target.closest(`.${CSS_PREFIX}-node`);

    if (nodeEl) {
      const nodeId = nodeEl.dataset.nodeId;
      const pos = positions.nodes.get(nodeId);
      if (!pos) return;

      const svgPt = screenToSvg(e.clientX, e.clientY);
      dragging = {
        nodeId,
        offsetX: svgPt.x - pos.x,
        offsetY: svgPt.y - pos.y,
      };

      nodeEl.style.cursor = 'grabbing';
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();

      layoutEngine.initTopology(positions, spec);
      return;
    }

    // Check for subgraph group drag
    const groupEl = e.target.closest(`.${CSS_PREFIX}-group`);
    if (groupEl) {
      const groupId = groupEl.dataset.groupId;
      const childIds = spec.subgraphChildren?.get(groupId);
      if (!childIds || childIds.length === 0) return;

      const svgPt = screenToSvg(e.clientX, e.clientY);
      draggingGroup = {
        groupId,
        childIds,
        lastX: svgPt.x,
        lastY: svgPt.y,
      };

      svg.setPointerCapture(e.pointerId);
      svg.style.cursor = 'move';
      e.preventDefault();
      return;
    }

    // Pan on background
    if (e.target === svg || e.target.closest(`.${CSS_PREFIX}-viewport`)) {
      panState = {
        startX: e.clientX,
        startY: e.clientY,
        startTranslateX: viewTranslateX,
        startTranslateY: viewTranslateY,
      };
      svg.setPointerCapture(e.pointerId);
      svg.style.cursor = 'move';
      e.preventDefault();
    }
  }, opts);

  svg.addEventListener('pointermove', (e) => {
    if (dragging) {
      const svgPt = screenToSvg(e.clientX, e.clientY);
      const newX = svgPt.x - dragging.offsetX;
      const newY = svgPt.y - dragging.offsetY;

      // Try libavoid obstacle-aware re-routing; fall back to straight-line
      if (instanceRouterState && moveObstacleAndReroute(dragging.nodeId, newX, newY, positions, instanceRouterState)) {
        // Router handled edge re-routing and node position update
      } else {
        // Fall back to straight-line edge recalculation
        layoutEngine.moveNode(dragging.nodeId, newX, newY, positions);
      }

      reassignPorts(dragging.nodeId, positions, spec);
      renderer.updatePositions(positions);
    } else if (draggingGroup) {
      const svgPt = screenToSvg(e.clientX, e.clientY);
      const dx = svgPt.x - draggingGroup.lastX;
      const dy = svgPt.y - draggingGroup.lastY;
      draggingGroup.lastX = svgPt.x;
      draggingGroup.lastY = svgPt.y;

      // Move all child nodes by delta
      const affectedNodeIds = new Set(draggingGroup.childIds);
      for (const childId of draggingGroup.childIds) {
        const pos = positions.nodes.get(childId);
        if (pos) {
          pos.x += dx;
          pos.y += dy;
        }
      }

      // Recompute group bounds
      computeGroupBounds(positions, spec.subgraphChildren);

      // Recompute edge routes for affected edges
      recomputeEdgesForNodes(affectedNodeIds, positions);

      // Redistribute connection points for affected nodes and their neighbors
      for (const childId of draggingGroup.childIds) {
        reassignPorts(childId, positions, spec);
      }

      renderer.updatePositions(positions);
    } else if (panState) {
      const dx = e.clientX - panState.startX;
      const dy = e.clientY - panState.startY;
      viewTranslateX = panState.startTranslateX + dx;
      viewTranslateY = panState.startTranslateY + dy;
      updateViewportTransform();
    }
  }, opts);

  svg.addEventListener('pointerup', (e) => {
    if (dragging) {
      const nodeEl = renderer._nodeElements.get(dragging.nodeId);
      if (nodeEl) nodeEl.style.cursor = 'grab';
      layoutEngine.releaseNode();
      dragging = null;
    }
    if (draggingGroup) {
      draggingGroup = null;
      svg.style.cursor = '';
    }
    if (panState) {
      panState = null;
      svg.style.cursor = '';
    }
    svg.releasePointerCapture(e.pointerId);
  }, opts);

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewScale + delta));

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleFactor = newScale / viewScale;
    viewTranslateX = mouseX - scaleFactor * (mouseX - viewTranslateX);
    viewTranslateY = mouseY - scaleFactor * (mouseY - viewTranslateY);
    viewScale = newScale;

    updateViewportTransform();
  }, { ...opts, passive: false });

  updateViewportTransform();

  return () => ac.abort();
}

/**
 * Center the diagram in the SVG viewport.
 */
function centerDiagram(positions, svg, setTranslate) {
  if (positions.nodes.size === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pos of positions.nodes.values()) {
    minX = Math.min(minX, pos.x - pos.width / 2);
    minY = Math.min(minY, pos.y - pos.height / 2);
    maxX = Math.max(maxX, pos.x + pos.width / 2);
    maxY = Math.max(maxY, pos.y + pos.height / 2);
  }

  const diagramCenterX = (minX + maxX) / 2;
  const diagramCenterY = (minY + maxY) / 2;

  const svgRect = svg.getBoundingClientRect();
  setTranslate(
    svgRect.width / 2 - diagramCenterX,
    svgRect.height / 2 - diagramCenterY
  );
}
