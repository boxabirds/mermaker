import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`));

await page.goto('http://localhost:3456/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Check rendering
const svgExists = await page.$('svg.mm-canvas');
const nodeCount = await page.$$eval('.mm-node', els => els.length);
const edgeCount = await page.$$eval('.mm-edge', els => els.length);

console.log('=== SMOKE TEST RESULTS ===');
console.log(`SVG canvas exists: ${!!svgExists}`);
console.log(`Nodes rendered: ${nodeCount}`);
console.log(`Edges rendered: ${edgeCount}`);

// Check node labels
const labels = await page.$$eval('.mm-node text', els => els.map(e => e.textContent));
console.log(`Node labels: ${labels.join(', ')}`);

// Check edge paths
const paths = await page.$$eval('.mm-edge path', els => els.map(e => e.getAttribute('d')));
console.log(`Edge paths: ${paths.length}`);

// Test drag: get initial position of first node, drag it, check position changed
const firstNode = await page.$('.mm-node');
const initialTransform = await firstNode.getAttribute('transform');
console.log(`Initial position: ${initialTransform}`);

const box = await firstNode.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const afterTransform = await firstNode.getAttribute('transform');
  console.log(`After drag: ${afterTransform}`);
  console.log(`Drag moved node: ${initialTransform !== afterTransform}`);
}

// Screenshot
await page.screenshot({ path: '/tmp/mermaker-smoke.png', fullPage: true });
console.log('Screenshot: /tmp/mermaker-smoke.png');

// Test text change
await page.fill('#mermaid-input', `flowchart LR
    X[Alpha] --> Y[Beta]
    Y --> Z[Gamma]`);
await page.waitForTimeout(1000);

const newNodeCount = await page.$$eval('.mm-node', els => els.length);
const newLabels = await page.$$eval('.mm-node text', els => els.map(e => e.textContent));
console.log(`\nAfter text change:`);
console.log(`Nodes: ${newNodeCount}, Labels: ${newLabels.join(', ')}`);

// Test error handling
await page.fill('#mermaid-input', 'this is not valid mermaid');
await page.waitForTimeout(1000);

const errorEl = await page.$('.mm-error');
console.log(`\nError display works: ${!!errorEl}`);
if (errorEl) {
  const errorText = await errorEl.textContent();
  console.log(`Error text: ${errorText.substring(0, 100)}...`);
}

await page.screenshot({ path: '/tmp/mermaker-smoke-final.png', fullPage: true });

if (logs.some(l => l.includes('PAGE_ERROR'))) {
  console.log('\n=== PAGE ERRORS ===');
  for (const l of logs.filter(l => l.includes('PAGE_ERROR'))) console.log(l);
}

const passed = nodeCount >= 5;
console.log(`\n=== ${passed ? 'ALL TESTS PASSED' : 'TESTS FAILED'} ===`);
process.exit(passed ? 0 : 1);

await browser.close();
