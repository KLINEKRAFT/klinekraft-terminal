import { test, expect } from '@playwright/test';
const initial = {phase:'muted',text:'',answer:'',error:'',level:0,installed:true,nativeOverlay:false,preferences:{enabled:false,style:'hologram',online:true,followup:7},recognition:'Local recognition',chatId:'demo',event:null,timers:[]};
test('voice preferences, fine hologram, mute and interruption work on the small screen', async ({page}) => {
  await page.setViewportSize({width:1024,height:600});
  let state={...initial,preferences:{...initial.preferences}};
  await page.route('**/api/voice**',async route=>{
    const url=new URL(route.request().url());
    const body=route.request().method()==='GET'?{}:route.request().postDataJSON();
    if(url.pathname.endsWith('/settings')) state={...state,preferences:body};
    if(url.pathname.endsWith('/control')) {
      if(body.action==='unmute')state={...state,phase:'idle',preferences:{...state.preferences,enabled:true}};
      if(body.action==='mute')state={...state,phase:'muted',preferences:{...state.preferences,enabled:false}};
      if(body.action==='listen')state={...state,phase:'listening',text:'What is the weather today?'};
      if(body.action==='stop')state={...state,phase:'idle'};
    }
    await route.fulfill({json:state});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Enable Shackleton microphone',exact:true}).click();
  await expect(page.getByRole('button',{name:'Mute Shackleton microphone',exact:true})).toBeVisible();
  // Exercise the guarded control endpoint without depending on navigation layout.
  await page.evaluate(async()=>{await fetch('/api/voice/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'listen'})});});
  await expect(page.getByRole('img',{name:'Shackleton listening · fine particle hologram'})).toBeVisible();
  await expect(page.getByText('What is the weather today?',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Stop Shackleton',exact:true}).click();
  await expect(page.getByRole('img',{name:'Shackleton listening · fine particle hologram'})).not.toBeVisible();
  await page.getByRole('button',{name:'Mute Shackleton microphone',exact:true}).click();
  await expect(page.getByRole('button',{name:'Enable Shackleton microphone',exact:true})).toBeVisible();
});

test('native overlay suppresses duplicate browser overlay', async ({page})=>{
  await page.route('**/api/voice**',route=>route.fulfill({json:{...initial,phase:'speaking',nativeOverlay:true,text:'hello',answer:'Hello.',preferences:{...initial.preferences,enabled:true}}}));
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Mute Shackleton microphone',exact:true})).toBeVisible();
  await expect(page.locator('.voice-hud')).not.toBeVisible();
});
