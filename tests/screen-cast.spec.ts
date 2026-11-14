import { test, expect } from '@playwright/test';
test('screen cast starts explicitly, protects PIN and stops', async ({ page }) => {
  await page.setViewportSize({ width:1024, height:600 });
  let active = false;
  await page.route('**/api/casting**', async route => {
    if (route.request().url().endsWith('/start')) {
      expect(route.request().postDataJSON()).toEqual({fullscreen:true});
      active = true;
    } else if (route.request().url().endsWith('/stop')) active = false;
    await route.fulfill({json:{installed:true,active,state:active?'active':'inactive',name:'Klinekraft Deck',fullscreen:true,pin:active?'1234':''}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'11 Network',exact:true}).click();
  await page.getByRole('button',{name:'Start Screen Cast',exact:true}).click();
  await expect(page.getByRole('button',{name:'Stop Screen Cast',exact:true})).toBeVisible();
  await expect(page.getByText('1234',{exact:true})).not.toBeVisible();
  await page.getByText('Show pairing PIN',{exact:true}).click();
  await expect(page.getByText('1234',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Stop Screen Cast',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start Screen Cast',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
