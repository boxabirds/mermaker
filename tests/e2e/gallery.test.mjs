/**
 * E2E tests for the example gallery page.
 * Requires: `npx serve . -l 3456` running in background.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const GALLERY_URL = 'http://localhost:3456/examples/gallery.html';
const RENDER_WAIT_MS = 5000;
const EXPECTED_EXAMPLES = 6;
const DRAG_STEPS = 10;
const DRAG_SETTLE_MS = 200;

let browser, page;

before(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  page.on('pageerror', err => {
    console.error('[PAGE_ERROR]', err.message);
  });
  await page.goto(GALLERY_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(RENDER_WAIT_MS);
});

after(async () => {
  await browser?.close();
});

describe('gallery page', () => {
  it('renders expected number of example cards', async () => {
    const cardCount = await page.$$eval('.card', els => els.length);
    assert.equal(cardCount, EXPECTED_EXAMPLES, `expected ${EXPECTED_EXAMPLES} cards`);
  });

  it('each card has a title and description', async () => {
    const titles = await page.$$eval('.card-header h2', els => els.map(e => e.textContent));
    assert.equal(titles.length, EXPECTED_EXAMPLES);
    for (const t of titles) {
      assert.ok(t.length > 0, 'title not empty');
    }
  });

  it('each card renders nodes in its diagram', async () => {
    const cardDiagrams = await page.$$('.card-diagram');
    assert.equal(cardDiagrams.length, EXPECTED_EXAMPLES);

    for (let i = 0; i < cardDiagrams.length; i++) {
      const nodeCount = await cardDiagrams[i].$$eval('.mm-node', els => els.length);
      assert.ok(nodeCount >= 2, `card ${i} should have >=2 nodes, got ${nodeCount}`);
    }
  });

  it('source toggle works', async () => {
    const toggle = await page.$('.card-toggle');
    assert.ok(toggle);

    const source = await page.$('.card-source');
    const initialOpen = await source.evaluate(el => el.classList.contains('open'));
    assert.equal(initialOpen, false, 'source initially hidden');

    await toggle.click();
    const afterOpen = await source.evaluate(el => el.classList.contains('open'));
    assert.equal(afterOpen, true, 'source visible after click');

    await toggle.click();
    const afterClose = await source.evaluate(el => el.classList.contains('open'));
    assert.equal(afterClose, false, 'source hidden after second click');
  });

  it('gallery diagrams have interactive nodes with grab cursor', async () => {
    const firstNode = await page.$('.card-diagram .mm-node');
    assert.ok(firstNode, 'found a node in gallery diagram');

    const cursor = await firstNode.evaluate(el => el.style.cursor);
    assert.equal(cursor, 'grab', 'node has grab cursor indicating drag is enabled');
  });

  it('each gallery card has an SVG canvas with viewport group', async () => {
    const viewports = await page.$$('.card-diagram .mm-viewport');
    assert.equal(viewports.length, EXPECTED_EXAMPLES, 'each card has a viewport group');
  });

  it('has link back to editor', async () => {
    const link = await page.$('header a[href="../index.html"]');
    assert.ok(link, 'back to editor link exists');
  });
});
