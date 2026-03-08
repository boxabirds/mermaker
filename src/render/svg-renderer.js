import { SVG_NS, CSS_PREFIX, ARROW_SIZE, LABEL_FONT_SIZE, LABEL_FONT_FAMILY, EDGE_LABEL_PAD_X, EDGE_LABEL_PAD_Y, VIEWBOX_PADDING } from '../util/constants.js';
import { createShape } from './flowchart-shapes.js';

/**
 * Renders a DiagramModel + PositionMap into an SVG container.
 */
export class SvgRenderer {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this.container = container;
    this.svg = null;
    this.viewport = null;
    this.nodesGroup = null;
    this.edgesGroup = null;
    this.groupsGroup = null;
    this.errorEl = null;

    this._nodeElements = new Map();
    this._edgeElements = new Map();
    this._groupElements = new Map();

    this._createSvg();
  }

  _createSvg() {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.classList.add(`${CSS_PREFIX}-canvas`);
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';

    // Defs for arrowhead markers
    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.appendChild(this._createArrowMarker('arrow-normal'));
    this.svg.appendChild(defs);

    // Viewport group for pan/zoom
    this.viewport = document.createElementNS(SVG_NS, 'g');
    this.viewport.classList.add(`${CSS_PREFIX}-viewport`);

    this.groupsGroup = document.createElementNS(SVG_NS, 'g');
    this.groupsGroup.classList.add(`${CSS_PREFIX}-groups`);
    this.viewport.appendChild(this.groupsGroup);

    this.edgesGroup = document.createElementNS(SVG_NS, 'g');
    this.edgesGroup.classList.add(`${CSS_PREFIX}-edges`);
    this.viewport.appendChild(this.edgesGroup);

    this.nodesGroup = document.createElementNS(SVG_NS, 'g');
    this.nodesGroup.classList.add(`${CSS_PREFIX}-nodes`);
    this.viewport.appendChild(this.nodesGroup);

    this.svg.appendChild(this.viewport);
    this.container.appendChild(this.svg);
  }

  _createArrowMarker(id) {
    const marker = document.createElementNS(SVG_NS, 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('viewBox', `0 0 ${ARROW_SIZE} ${ARROW_SIZE}`);
    marker.setAttribute('refX', String(ARROW_SIZE));
    marker.setAttribute('refY', String(ARROW_SIZE / 2));
    marker.setAttribute('markerWidth', String(ARROW_SIZE));
    marker.setAttribute('markerHeight', String(ARROW_SIZE));
    marker.setAttribute('orient', 'auto-start-reverse');

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M 0 0 L ${ARROW_SIZE} ${ARROW_SIZE / 2} L 0 ${ARROW_SIZE} Z`);
    path.setAttribute('fill', '#333');
    marker.appendChild(path);

    return marker;
  }

  /**
   * Render the full diagram.
   * @param {import('../model/diagram-model.js').DiagramModel} model
   * @param {import('../layout/layout-engine.js').PositionMap} positions
   */
  renderDiagram(model, positions) {
    this.clear();

    // Render groups (subgraphs) as background
    for (const [groupId, group] of model.groups) {
      const bounds = positions.groups.get(groupId);
      if (!bounds) continue;
      this._renderGroup(groupId, group.label, bounds);
    }

    // Render edges
    for (const edgeRoute of positions.edges) {
      this._renderEdge(edgeRoute, model);
    }

    // Render nodes
    for (const [nodeId, node] of model.nodes) {
      const pos = positions.nodes.get(nodeId);
      if (!pos) continue;
      this._renderNode(nodeId, node, pos);
    }

    this._fitViewBox(positions);
    this.clearError();
  }

  /**
   * Compute bounding box of all content and set SVG viewBox so everything is visible.
   */
  _fitViewBox(positions) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const [, pos] of positions.nodes) {
      const halfW = pos.width / 2;
      const halfH = pos.height / 2;
      minX = Math.min(minX, pos.x - halfW);
      minY = Math.min(minY, pos.y - halfH);
      maxX = Math.max(maxX, pos.x + halfW);
      maxY = Math.max(maxY, pos.y + halfH);
    }

    for (const edge of positions.edges) {
      for (const [x, y] of edge.waypoints) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (positions.groups) {
      for (const [, g] of positions.groups) {
        minX = Math.min(minX, g.x);
        minY = Math.min(minY, g.y);
        maxX = Math.max(maxX, g.x + g.width);
        maxY = Math.max(maxY, g.y + g.height);
      }
    }

    if (!isFinite(minX)) return;

    const pad = VIEWBOX_PADDING;
    this.svg.setAttribute('viewBox',
      `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`);
  }

  _renderNode(nodeId, node, pos) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add(`${CSS_PREFIX}-node`);
    g.dataset.nodeId = nodeId;
    g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    g.style.cursor = 'grab';

    const shape = createShape(node.shape, pos.width, pos.height);
    shape.classList.add(`${CSS_PREFIX}-shape`);
    shape.setAttribute('fill', '#e8f4fd');
    shape.setAttribute('stroke', '#4a90d9');
    shape.setAttribute('stroke-width', '1.5');
    g.appendChild(shape);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-family', LABEL_FONT_FAMILY);
    text.setAttribute('font-size', String(LABEL_FONT_SIZE));
    text.setAttribute('fill', '#333');
    text.textContent = node.label;
    g.appendChild(text);

    this.nodesGroup.appendChild(g);
    this._nodeElements.set(nodeId, g);
  }

  _renderEdge(edgeRoute, model) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add(`${CSS_PREFIX}-edge`);
    g.dataset.edgeSource = edgeRoute.source;
    g.dataset.edgeTarget = edgeRoute.target;

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', this._waypointsToPath(edgeRoute.waypoints));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#666');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('marker-end', 'url(#arrow-normal)');
    g.appendChild(path);

    // Edge label
    const edgeModel = model.edges.find(
      e => e.source === edgeRoute.source && e.target === edgeRoute.target
    );
    if (edgeModel?.label) {
      const midpoint = this._getRouteMidpoint(edgeRoute.waypoints);

      // Background rect for readability (sized after text is in DOM)
      const bg = document.createElementNS(SVG_NS, 'rect');
      bg.setAttribute('fill', '#fff');
      bg.setAttribute('rx', '2');
      bg.classList.add(`${CSS_PREFIX}-edge-label-bg`);
      g.appendChild(bg);

      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', String(midpoint[0]));
      text.setAttribute('y', String(midpoint[1]));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-family', LABEL_FONT_FAMILY);
      text.setAttribute('font-size', String(LABEL_FONT_SIZE - 2));
      text.setAttribute('fill', '#666');
      text.textContent = edgeModel.label;
      g.appendChild(text);

      // Size background to text after insertion
      requestAnimationFrame(() => {
        const bbox = text.getBBox();
        bg.setAttribute('x', String(bbox.x - EDGE_LABEL_PAD_X));
        bg.setAttribute('y', String(bbox.y - EDGE_LABEL_PAD_Y));
        bg.setAttribute('width', String(bbox.width + EDGE_LABEL_PAD_X * 2));
        bg.setAttribute('height', String(bbox.height + EDGE_LABEL_PAD_Y * 2));
      });
    }

    this.edgesGroup.appendChild(g);
    const key = `${edgeRoute.source}->${edgeRoute.target}`;
    const labelEl = g.querySelector(`text`);
    const labelBg = g.querySelector(`.${CSS_PREFIX}-edge-label-bg`);
    this._edgeElements.set(key, { g, path, label: labelEl, labelBg });
  }

  _renderGroup(groupId, label, bounds) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add(`${CSS_PREFIX}-group`);
    g.dataset.groupId = groupId;

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(bounds.x));
    rect.setAttribute('y', String(bounds.y));
    rect.setAttribute('width', String(bounds.width));
    rect.setAttribute('height', String(bounds.height));
    rect.setAttribute('rx', '4');
    rect.setAttribute('fill', 'rgba(200, 220, 240, 0.15)');
    rect.style.cursor = 'move';
    rect.setAttribute('stroke', '#aac');
    rect.setAttribute('stroke-width', '1');
    rect.setAttribute('stroke-dasharray', '4 2');
    g.appendChild(rect);

    if (label) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', String(bounds.x + 8));
      text.setAttribute('y', String(bounds.y + 16));
      text.setAttribute('font-family', LABEL_FONT_FAMILY);
      text.setAttribute('font-size', String(LABEL_FONT_SIZE - 2));
      text.setAttribute('fill', '#668');
      text.textContent = label;
      g.appendChild(text);
    }

    this.groupsGroup.appendChild(g);
    const titleEl = g.querySelector('text');
    this._groupElements.set(groupId, { g, rect, title: titleEl });
  }

  /**
   * Update positions without recreating DOM elements.
   * @param {import('../layout/layout-engine.js').PositionMap} positions
   */
  updatePositions(positions) {
    for (const [nodeId, pos] of positions.nodes) {
      const el = this._nodeElements.get(nodeId);
      if (el) {
        el.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
      }
    }

    for (const edge of positions.edges) {
      const key = `${edge.source}->${edge.target}`;
      const els = this._edgeElements.get(key);
      if (els) {
        els.path.setAttribute('d', this._waypointsToPath(edge.waypoints));
        if (els.label) {
          const midpoint = this._getRouteMidpoint(edge.waypoints);
          els.label.setAttribute('x', String(midpoint[0]));
          els.label.setAttribute('y', String(midpoint[1]));
          if (els.labelBg) {
            const bbox = els.label.getBBox();
            els.labelBg.setAttribute('x', String(bbox.x - EDGE_LABEL_PAD_X));
            els.labelBg.setAttribute('y', String(bbox.y - EDGE_LABEL_PAD_Y));
            els.labelBg.setAttribute('width', String(bbox.width + EDGE_LABEL_PAD_X * 2));
            els.labelBg.setAttribute('height', String(bbox.height + EDGE_LABEL_PAD_Y * 2));
          }
        }
      }
    }

    for (const [groupId, bounds] of positions.groups) {
      const els = this._groupElements.get(groupId);
      if (els) {
        els.rect.setAttribute('x', String(bounds.x));
        els.rect.setAttribute('y', String(bounds.y));
        els.rect.setAttribute('width', String(bounds.width));
        els.rect.setAttribute('height', String(bounds.height));
        if (els.title) {
          els.title.setAttribute('x', String(bounds.x + 8));
          els.title.setAttribute('y', String(bounds.y + 16));
        }
      }
    }
  }

  /**
   * Show a parse error indicator.
   * @param {import('../model/diagram-model.js').ParseError} error
   */
  showError(error) {
    this.clearError();
    this.errorEl = document.createElement('div');
    this.errorEl.classList.add(`${CSS_PREFIX}-error`);

    let msg = error.message;
    if (error.line != null) {
      msg = `Line ${error.line}: ${msg}`;
    }

    this.errorEl.textContent = msg;
    this.container.appendChild(this.errorEl);
  }

  clearError() {
    if (this.errorEl) {
      this.errorEl.remove();
      this.errorEl = null;
    }
  }

  clear() {
    this.nodesGroup.innerHTML = '';
    this.edgesGroup.innerHTML = '';
    this.groupsGroup.innerHTML = '';
    this._nodeElements.clear();
    this._edgeElements.clear();
    this._groupElements.clear();
  }

  _waypointsToPath(waypoints) {
    if (!waypoints || waypoints.length === 0) return '';
    const [first, ...rest] = waypoints;
    let d = `M ${first[0]} ${first[1]}`;
    for (const pt of rest) {
      d += ` L ${pt[0]} ${pt[1]}`;
    }
    return d;
  }

  _getRouteMidpoint(waypoints) {
    if (!waypoints || waypoints.length === 0) return [0, 0];
    if (waypoints.length === 1) return waypoints[0];
    const mid = Math.floor(waypoints.length / 2);
    if (waypoints.length % 2 === 1) return waypoints[mid];
    const a = waypoints[mid - 1];
    const b = waypoints[mid];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }
}
