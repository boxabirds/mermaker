import mermaid from 'mermaid';
import { ParseError } from '../model/diagram-model.js';
import { extractFlowchart } from './flowchart-extractor.js';

let initialized = false;

/**
 * Parse mermaid text into a DiagramModel.
 * @param {string} text - Raw mermaid text
 * @returns {Promise<import('../model/diagram-model.js').DiagramModel>}
 * @throws {ParseError}
 */
export async function parse(text) {
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      suppressErrors: true,
      suppressErrorRendering: true,
    });
    initialized = true;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new ParseError('Empty diagram text', null, null, 'syntax');
  }

  let diagram;
  try {
    diagram = await mermaid.mermaidAPI.getDiagramFromText(trimmed);
  } catch (err) {
    const { line, column } = extractErrorLocation(err);
    throw new ParseError(
      err.message || 'Failed to parse mermaid text',
      line,
      column,
      'syntax'
    );
  }

  const db = diagram.db;
  const diagramType = diagram.type ?? '';

  return extractFlowchart(db, diagramType);
}

/**
 * Try to extract line/column from a mermaid parse error.
 */
function extractErrorLocation(err) {
  const msg = err.message ?? '';
  // Mermaid errors sometimes include "Parse error on line N"
  const lineMatch = msg.match(/line\s+(\d+)/i);
  const colMatch = msg.match(/col(?:umn)?\s+(\d+)/i);
  return {
    line: lineMatch ? parseInt(lineMatch[1], 10) : null,
    column: colMatch ? parseInt(colMatch[1], 10) : null,
  };
}
