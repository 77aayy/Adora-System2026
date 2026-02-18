// @ts-check
import { test } from '@playwright/test';

test('open app and capture', async ({ page }) => {
  const logs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('Throttling') || text.includes('Error') || text.includes('permission')) {
      logs.push(text);
    }
  });
  await page.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'browser-test-result.png' });
  if (logs.length) console.log('Console issues:', logs);
});
