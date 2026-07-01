import { expect, test } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.post('/api/test-reset-room');
});

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
  await page.getByRole('button', { name: 'Start Local Game' }).click();

  await expect(page.locator('.settings-panel .button-icon')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Game Setup' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Designer' })).toBeVisible();
});

test('setup page contains match, player, and future slot setup', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Tanks!' })).toBeVisible();
  await expect(page.locator('#matchRoundsInput')).toBeVisible();
  await expect(page.locator('#landscapeInput')).toBeVisible();
  await expect(page.locator('#waterEnabledInput')).toBeVisible();
  await expect(page.locator('#waterLevelInput')).toBeVisible();
  await expect(page.locator('#waterRiseInput')).toBeVisible();
  await expect(page.locator('#playerOneNameInput')).toBeVisible();
  await expect(page.locator('#playerTwoTankInput')).toBeVisible();
  await expect(page.locator('#localPlayerSlotsInput')).toHaveValue('2');
  await expect(page.locator('#localAiSlotsInput')).toHaveValue('0');
  await page.getByRole('button', { name: /Host LAN/ }).click();
  await expect(page.locator('#multiplayerPlayerSlotsInput')).toBeVisible();
  await expect(page.locator('#multiplayerPlayerSlotsInput')).toHaveAttribute('max', '6');
  await expect(page.locator('#multiplayerAiSlotsInput')).toHaveAttribute('max', '4');
  await expect(page.getByRole('button', { name: 'Start LAN Game' })).toBeVisible();
});

test('LAN room actions live on the relevant slot rows', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Host LAN/ }).click();
  await expect(page.locator('#createRoomButton')).toBeHidden();
  await expect(page.locator('#joinRoomButton')).toBeHidden();

  const mySlot = page.locator('.multiplayer-slot-row.is-me').first();
  await expect(mySlot.getByRole('button', { name: /Ready/ })).toHaveCount(0);
  await expect(mySlot.getByRole('button', { name: 'Leave' })).toBeVisible();
  await expect(page.locator('#multiplayerSlotList').getByRole('button', { name: 'Join' })).toHaveCount(0);
  await expect(page.locator('#multiplayerRoomHint')).toContainText('Waiting for player 2');

  await page.locator('.multiplayer-slot-row.is-me').getByRole('button', { name: 'Leave' }).click();
});

test('LAN joiners receive the host tank designer library', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const joinContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const joinPage = await joinContext.newPage();

  await hostPage.goto('/');
  await hostPage.getByRole('button', { name: 'Designer' }).click();
  await hostPage.getByRole('button', { name: 'Tanks & Turrets' }).click();
  await hostPage.locator('#tankNameInput').fill('LAN Rhino');
  await hostPage.locator('#tankNameInput').dispatchEvent('input');
  await hostPage.getByRole('button', { name: 'Close' }).click();
  await hostPage.getByRole('button', { name: /Host LAN/ }).click();

  await joinPage.goto('/');
  await joinPage.getByRole('button', { name: /Join LAN/ }).click();

  await expect(joinPage.locator('#multiplayerTankInput')).toContainText('LAN Rhino');

  await hostContext.close();
  await joinContext.close();
});

test('multiple clients can host independent LAN rooms', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const joinContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const secondPage = await secondContext.newPage();
  const joinPage = await joinContext.newPage();

  await hostPage.goto('/');
  await hostPage.getByRole('button', { name: /Host LAN/ }).click();
  await hostPage.locator('#multiplayerNameInput').fill('Daniel Host');
  await expect(hostPage.locator('.multiplayer-slot-row.is-me')).toContainText('Host');

  await secondPage.goto('/');
  await secondPage.getByRole('button', { name: /Host LAN/ }).click();
  await secondPage.locator('#multiplayerNameInput').fill('Eli Host');
  await expect(secondPage.locator('.multiplayer-slot-row.is-me')).toContainText('Host');
  await expect(hostPage.locator('.multiplayer-slot-row.is-me')).toContainText('Daniel Host');
  await expect(hostPage.locator('.multiplayer-slot-row.is-me')).toContainText('Host');

  await joinPage.goto('/');
  await joinPage.getByRole('button', { name: /Join LAN/ }).click();
  await expect(joinPage.locator('.multiplayer-room-card')).toHaveCount(2);
  await expect(joinPage.locator('#multiplayerSlotList')).toContainText("Daniel Host's Game");
  await expect(joinPage.locator('#multiplayerSlotList')).toContainText("Eli Host's Game");
  await expect(joinPage.locator('#multiplayerSlotList').getByRole('button', { name: 'Join' }).first()).toBeVisible();

  await hostContext.close();
  await secondContext.close();
  await joinContext.close();
});

test('LAN game starts after a guest joins and marks ready', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const joinContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const joinPage = await joinContext.newPage();

  await hostPage.goto('/');
  await hostPage.getByRole('button', { name: /Host LAN/ }).click();
  await expect(hostPage.locator('#multiplayerRoomHint')).toContainText('Waiting for player 2');

  await joinPage.goto('/');
  await joinPage.getByRole('button', { name: /Join LAN/ }).click();
  await joinPage.locator('#multiplayerSlotList').getByRole('button', { name: 'Join' }).first().click();
  await joinPage.locator('.multiplayer-slot-row.is-me').getByRole('button', { name: 'Ready' }).click();

  await expect(hostPage.locator('#multiplayerRoomHint')).toContainText('Ready to start');
  await expect(hostPage.getByRole('button', { name: 'Start LAN Game' })).toBeEnabled();
  await hostPage.getByRole('button', { name: 'Start LAN Game' }).click();

  await expect(hostPage.locator('#gameView')).toBeVisible();
  await expect(joinPage.locator('#gameView')).toBeVisible();
  await expect(hostPage.locator('#multiplayerRoomHint')).toContainText('LAN game in progress');

  await hostContext.close();
  await joinContext.close();
});

test('LAN guest can control player 2 on their turn', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const joinContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const joinPage = await joinContext.newPage();

  await hostPage.goto('/');
  await hostPage.getByRole('button', { name: /Host LAN/ }).click();
  await joinPage.goto('/');
  await joinPage.getByRole('button', { name: /Join LAN/ }).click();
  await joinPage.locator('#multiplayerSlotList').getByRole('button', { name: 'Join' }).first().click();
  await joinPage.locator('.multiplayer-slot-row.is-me').getByRole('button', { name: 'Ready' }).click();
  await hostPage.getByRole('button', { name: 'Start LAN Game' }).click();
  await expect(joinPage.locator('#gameView')).toBeVisible();

  await hostPage.keyboard.press('Space');
  await expect.poll(
    () => joinPage.evaluate(() => window.scorchedGame.currentPlayerIndex),
    { timeout: 15000 }
  ).toBe(1);
  await expect.poll(() => joinPage.evaluate(() => window.scorchedGame.inputEnabled)).toBe(true);

  const angleBefore = await hostPage.evaluate(() => window.scorchedGame.players[1].angle);
  await joinPage.keyboard.down('ArrowLeft');
  await joinPage.waitForTimeout(250);
  await hostPage.evaluate(() => {
    window.scorchedGame.update(0.25);
  });
  await joinPage.keyboard.up('ArrowLeft');

  await expect.poll(() => hostPage.evaluate(() => window.scorchedGame.players[1].angle)).not.toBe(angleBefore);
  await joinPage.keyboard.press('Space');
  await expect.poll(() => hostPage.evaluate(() => Boolean(window.scorchedGame.projectile))).toBe(true);

  await hostContext.close();
  await joinContext.close();
});

test('LAN guest refresh reclaims the same active game slot', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const joinContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const joinPage = await joinContext.newPage();

  await hostPage.goto('/');
  await hostPage.getByRole('button', { name: /Host LAN/ }).click();
  await joinPage.goto('/');
  await joinPage.getByRole('button', { name: /Join LAN/ }).click();
  await joinPage.locator('#multiplayerSlotList').getByRole('button', { name: 'Join' }).first().click();
  await joinPage.locator('.multiplayer-slot-row.is-me').getByRole('button', { name: 'Ready' }).click();
  await hostPage.getByRole('button', { name: 'Start LAN Game' }).click();
  await expect(joinPage.locator('#gameView')).toBeVisible();

  await joinPage.reload();

  await expect(joinPage.locator('#gameView')).toBeVisible();
  await expect.poll(() => joinPage.evaluate(() => window.scorchedGame.snapshotOnly)).toBe(true);
  await expect.poll(() => hostPage.locator('#multiplayerRoomHint').textContent()).toContain('LAN game in progress');

  await hostContext.close();
  await joinContext.close();
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
