import {test,expect} from '@playwright/test';

test('offline Shackleton stays local and includes research by default',async({page})=>{
  await page.route('**/api/conversations**',r=>r.fulfill({json:r.request().method()==='PUT'?{id:r.request().url().split('/').at(-1),revision:1,updated:new Date().toISOString()}:{chats:[]}}));
  await page.route('**/api/ai/status',r=>r.fulfill({json:{configured:true,model:'cloud',local:{configured:true,model:'local-test'},cloud:{configured:true,model:'cloud'}}}));
  await page.route('**/api/ai/ask',r=>{
    expect(r.request().postDataJSON().provider).toBe('local');
    expect(r.request().postDataJSON().reference_only).toBe(true);
    expect(r.request().postDataJSON().use_research).toBe(true);
    return r.fulfill({json:{answer:'Local reference answer.',sources:[],images:[],notice:'Offline model; processing stays on this Pi.'}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'03 Shackleton',exact:true}).click();
  await page.getByLabel('Chat settings').click();
  await expect(page.getByLabel('Answer engine')).toHaveValue('local');
  await expect(page.getByText(/No automatic cloud fallback/)).toBeVisible();
  await page.getByLabel('Chat settings').click();
  await page.getByLabel('Your question').fill('Find a saved reference');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(page.locator('.ai-answer')).toContainText('Local reference answer.');
});

test('emergency topics search references and radio send stays disabled without hardware',async({page})=>{
  await page.setViewportSize({width:1024,height:600});
  await page.route('**/api/emergency/status',r=>r.fulfill({json:{library:{documents:10,searchable:9},maps:true,localAI:true,model:'local-test'}}));
  await page.route('**/api/research?*',r=>r.fulfill({json:{files:[{id:1,name:'Water guide',collection:'Emergency - Water',mime:'text/plain',snippet:'Stored water reference.',searchable:true}],collections:['Emergency - Water'],limited:false}}));
  await page.route('**/api/hotspot',r=>r.fulfill({json:{configured:false,active:false}}));
  await page.route('**/api/mesh',r=>r.fulfill({json:{connected:false,ports:[],nodes:[],messages:[],notice:'Radio required.'}}));
  await page.goto('/');
  await page.getByRole('button',{name:'14 Emergency',exact:true}).click();
  await page.getByRole('button',{name:'Water & sanitation',exact:true}).click();
  await expect(page.getByRole('searchbox',{name:'Search files'})).toHaveValue('water sanitation');
  await expect(page.getByText('Stored water reference.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'11 Network',exact:true}).click();
  await page.getByText('Off-grid messages · No radio connected',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Send over radio'})).toBeDisabled();
  await expect(page.getByText(/built-in Wi-Fi and Bluetooth cannot/)).toBeVisible();
});
