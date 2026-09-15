export async function startSolo(page) {
  await page.locator('#solo').click();
  await page.locator('#prepare-game').click();
  await page.locator('#start-campaign:not([disabled])').waitFor();
  await page.locator('#start-campaign').click();
}
