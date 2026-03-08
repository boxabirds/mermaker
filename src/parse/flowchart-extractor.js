import { DiagramModel, ParseError } from '../model/diagram-model.js';
import { SHAPES } from '../util/constants.js';

/**
 * Maps mermaid's internal shape names to our shape constants.
 */
const SHAPE_MAP = Object.freeze({
  round: SHAPES.ROUNDED_RECT,
  square: SHAPES.RECT,
  diamond: SHAPES.DIAMOND,
  question: SHAPES.DIAMOND,
  circle: SHAPES.CIRCLE,
  hexagon: SHAPES.HEXAGON,
  stadium: SHAPES.STADIUM,
  odd: SHAPES.ROUNDED_RECT,
  lean_right: SHAPES.RECT,
  lean_left: SHAPES.RECT,
  trapezoid: SHAPES.RECT,
  inv_trapezoid: SHAPES.RECT,
  rect_left_inv_arrow: SHAPES.RECT,
  cylinder: SHAPES.RECT,
  subroutine: SHAPES.RECT,
  doublecircle: SHAPES.CIRCLE,
});

/**
 * Extract a DiagramModel from a mermaid flowchart diagram object.
 * @param {object} db - mermaid's flowchart db (from getDiagramFromText)
 * @param {string} diagramType - the detected diagram type
 * @returns {DiagramModel}
 */
export function extractFlowchart(db, diagramType) {
  if (!diagramType.startsWith('flowchart')) {
    throw new ParseError(
      `Unsupported diagram type: "${diagramType}". Only flowcharts are supported.`,
      null, null, 'unsupported-type'
    );
  }

  const model = new DiagramModel();
  model.type = 'flowchart';

  // Extract direction
  const direction = db.getDirection?.() ?? 'TB';
  model.direction = direction;

  // Extract vertices (nodes)
  const vertices = db.getVertices?.() ?? new Map();
  for (const [id, vertex] of vertices) {
    const label = extractLabel(vertex);
    const shape = SHAPE_MAP[vertex.type] ?? SHAPES.RECT;
    model.addNode(id, label, shape);
  }

  // Extract edges
  const edges = db.getEdges?.() ?? [];
  for (const edge of edges) {
    const label = edge.text ?? '';
    model.addEdge(
      edge.start,
      edge.end,
      label,
      edge.type ?? 'normal',
      edge.stroke ?? 'normal'
    );
  }

  // Extract subgraphs (groups)
  const subGraphs = db.getSubGraphs?.() ?? [];
  for (const sg of subGraphs) {
    const nodeIds = sg.nodes ?? [];
    model.addGroup(sg.id, sg.title ?? sg.id, nodeIds);
  }

  return model;
}

/**
 * Pull label text from a mermaid vertex, handling various formats.
 */
function extractLabel(vertex) {
  if (typeof vertex.text === 'string') return vertex.text;
  if (typeof vertex.labelText === 'string') return vertex.labelText;
  if (vertex.text?.text) return vertex.text.text;
  return vertex.id ?? '';
}
