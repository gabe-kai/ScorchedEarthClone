import { expect, test } from '@playwright/test';

test('designer tabs attach the selected tab to the active panel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Designer' }).click();

  const selectedTab = page.getByRole('button', { name: 'Ammunition' });
  const activePanel = page.locator('#ammoDesignerPanel');

  await expect(selectedTab).toHaveClass(/is-selected/);
  await expect(activePanel).toBeVisible();

  const tabAndPanel = await selectedTab.evaluate((tab) => {
    const panel = document.querySelector('#ammoDesignerPanel');
    const tabStyles = getComputedStyle(tab);
    const panelStyles = getComputedStyle(panel);
    const tabRect = tab.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    return {
      tabBackground: tabStyles.backgroundColor,
      tabBorderBottom: tabStyles.borderBottomColor,
      panelBackground: panelStyles.backgroundColor,
      panelBorderTop: panelStyles.borderTopColor,
      tabBottom: tabRect.bottom,
      panelTop: panelRect.top
    };
  });

  expect(tabAndPanel.tabBackground).toBe(tabAndPanel.panelBackground);
  expect(tabAndPanel.tabBorderBottom).toBe(tabAndPanel.panelBackground);
  expect(tabAndPanel.tabBottom).toBeGreaterThanOrEqual(tabAndPanel.panelTop - 1);
  expect(tabAndPanel.panelBorderTop).not.toBe(tabAndPanel.panelBackground);
});

test('settings actions are click-only and no longer show hotkey badges', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.settings-panel .button-icon')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New Game' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Designer' })).toBeVisible();
});

test('new game modal contains match and player setup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Game' }).click();

  await expect(page.getByRole('heading', { name: 'New Game' })).toBeVisible();
  await expect(page.locator('#matchRoundsInput')).toBeVisible();
  await expect(page.locator('#playerOneNameInput')).toBeVisible();
  await expect(page.locator('#playerTwoTankInput')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start New Game' })).toBeVisible();
});

test('tank preview draws a pivot-centered protractor', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Designer' }).click();
  await page.getByRole('button', { name: 'Tanks & Turrets' }).click();

  const canvasStats = await page.locator('#tankDesignerPreview').evaluate((canvas) => {
    const context = canvas.getContext('2d');
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let brightPixels = 0;
    let warmArcPixels = 0;

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];

      if (red + green + blue > 180) {
        brightPixels += 1;
      }

      if (red > 120 && green > 85 && green < 190 && blue < 100) {
        warmArcPixels += 1;
      }
    }

    return { brightPixels, warmArcPixels };
  });

  expect(canvasStats.brightPixels).toBeGreaterThan(500);
  expect(canvasStats.warmArcPixels).toBeGreaterThan(20);
});

test('tank preview shows the allowed angle arc in the correct quadrant', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Designer' }).click();
  await page.getByRole('button', { name: 'Tanks & Turrets' }).click();

  await page.locator('#tankMinAngleInput').fill('0');
  await page.locator('#tankMaxAngleInput').fill('85');
  await page.locator('#tankMaxAngleInput').dispatchEvent('input');

  const canvasStats = await page.locator('#tankDesignerPreview').evaluate((canvas) => {
    const context = canvas.getContext('2d');
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const origin = { x: canvas.width / 2, y: canvas.height - 46 };
    const pivotX = origin.x + Number(document.querySelector('#tankPivotXInput').value) * 4;
    const pivotY = origin.y + Number(document.querySelector('#tankPivotYInput').value) * 4;
    const edgeDistance = Math.min(pivotX, canvas.width - pivotX, pivotY, canvas.height - pivotY);
    const protractorRadius = Math.min(96, Math.max(58, edgeDistance - 12));
    let allowedUpperRight = 0;
    let allowedLowerLeft = 0;

    for (let index = 0; index < data.length; index += 4) {
      const pixel = index / 4;
      const x = pixel % canvas.width;
      const y = Math.floor(pixel / canvas.width);
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const isAllowedArc = red > 120 && green > 105 && green < 190 && blue < 110 && red - green < 80;
      const distanceFromPivot = Math.hypot(x - pivotX, y - pivotY);
      const isOnProtractorRing = Math.abs(distanceFromPivot - protractorRadius) < 8;

      if (!isAllowedArc || !isOnProtractorRing) {
        continue;
      }

      if (x > pivotX && y < pivotY) {
        allowedUpperRight += 1;
      }

      if (x < pivotX && y > pivotY) {
        allowedLowerLeft += 1;
      }
    }

    return { allowedUpperRight, allowedLowerLeft };
  });

  expect(canvasStats.allowedUpperRight).toBeGreaterThan(20);
  expect(canvasStats.allowedLowerLeft).toBeLessThan(canvasStats.allowedUpperRight / 4);
});
