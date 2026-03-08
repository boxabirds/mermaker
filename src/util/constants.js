/** Spacing between connected nodes in layout units */
export const IDEAL_EDGE_LENGTH = 80;

/** Padding around label text within node shapes (px) */
export const NODE_PADDING_X = 16;
export const NODE_PADDING_Y = 10;

/** Padding between subgraph boundary and contained nodes (px) */
export const SUBGRAPH_MARGIN = 20;

/** Default node dimensions when text measurement unavailable */
export const DEFAULT_NODE_WIDTH = 120;
export const DEFAULT_NODE_HEIGHT = 40;

/** Minimum node dimensions */
export const MIN_NODE_WIDTH = 40;
export const MIN_NODE_HEIGHT = 30;

/** HOLA tree growth direction constants */
export const TREE_GROWTH = Object.freeze({
  NORTH: 0,
  SOUTH: 1,
  EAST: 2,
  WEST: 3,
});

/** Mermaid direction to HOLA tree growth mapping */
export const DIRECTION_TO_GROWTH = Object.freeze({
  TB: TREE_GROWTH.SOUTH,
  TD: TREE_GROWTH.SOUTH,
  BT: TREE_GROWTH.NORTH,
  LR: TREE_GROWTH.EAST,
  RL: TREE_GROWTH.WEST,
});

/** Shape type constants */
export const SHAPES = Object.freeze({
  RECT: 'rect',
  ROUNDED_RECT: 'rounded_rect',
  DIAMOND: 'diamond',
  CIRCLE: 'circle',
  HEXAGON: 'hexagon',
  STADIUM: 'stadium',
});

/** SVG namespace */
export const SVG_NS = 'http://www.w3.org/2000/svg';

/** CSS class prefix */
export const CSS_PREFIX = 'mm';

/** Debounce delay for text input (ms) */
export const PARSE_DEBOUNCE_MS = 300;

/** Zoom limits */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.1;

/** Arrowhead marker dimensions */
export const ARROW_SIZE = 8;

/** Gap between arrowhead tip and node border (px) */
export const ARROW_TIP_GAP = 6;

/** Corner radius for rounded rectangles */
export const ROUNDED_CORNER_RADIUS = 8;

/** Font used for label measurement */
export const LABEL_FONT_FAMILY = 'sans-serif';
export const LABEL_FONT_SIZE = 14;

/** Edge label background padding (px) */
export const EDGE_LABEL_PAD_X = 4;
export const EDGE_LABEL_PAD_Y = 2;

/** Padding around diagram content in the SVG viewBox (px) */
export const VIEWBOX_PADDING = 30;

/** Minimum spacing between distributed connection points on a node side (px) */
export const MIN_PORT_SPACING = 4;

/** Side constants for port assignment */
export const SIDE = Object.freeze({
  TOP: 'top',
  BOTTOM: 'bottom',
  LEFT: 'left',
  RIGHT: 'right',
});
