import {test,expect} from '@playwright/test';
for(const height of [600,560])test(`power controls and warnings fit 1024x${height}`,async({page})=>{
 await page.setViewportSize({width:1024,height});let field=false;
 await page.route('**/api/power**',async r=>{if(r.request().method()==='POST')field=r.request().postDataJSON().enabled;await r.fulfill({json:{field,percent:14,voltage:3.65,warning:'critical',reserveMinutes:0,guard:{valid:true,shutdownSeconds:null}}});});
 await page.goto('/');await expect(page.getByRole('alert').filter({hasText:'Very low battery'})).toBeVisible();
 await page.getByRole('button',{name:'Field mode: Off',exact:true}).click();
 await expect(page.getByRole('button',{name:'Field mode: On',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('html')).toHaveClass(/field-mode/);
 for(const section of ['01 Home','03 Shackleton','07 Paint','12 System']){
 await page.getByRole('button',{name:section,exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await expect(page.getByRole('button',{name:'Field mode: On',exact:true})).toBeVisible();
 }
});
