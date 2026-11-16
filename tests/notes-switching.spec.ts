import { test, expect } from '@playwright/test';

for (const fail of [false, true]) test(`notes switch preserves edits; save failure=${fail}`, async ({page}) => {
  const notes = [
    {id:'a',kind:'note',title:'Alpha',body:'First',day:null,time:'',revision:1,archived:false},
    {id:'b',kind:'note',title:'Beta',body:'Second',day:null,time:'',revision:1,archived:false},
  ];
  let writes=0;
  await page.route('**/api/organizer**',async route=>{
    if(route.request().method()==='GET') return route.fulfill({json:notes});
    writes++;
    if(fail) return route.fulfill({status:409,json:{detail:'Revision conflict. Reload before saving.'}});
    const item=route.request().postDataJSON();item.revision++;
    notes[notes.findIndex(n=>n.id===item.id)]=item;
    return route.fulfill({json:item});
  });
  await page.goto('/');await page.getByRole('button',{name:'06 Notes',exact:true}).click();
  await page.getByRole('button',{name:'Alpha First',exact:true}).click();
  await page.getByRole('textbox',{name:'Note',exact:true}).fill('Keep this edit');
  await page.getByRole('button',{name:'Beta Second',exact:true}).click();
  if(fail){
    await expect(page.getByRole('textbox',{name:'Title',exact:true})).toHaveValue('Alpha');
    await expect(page.getByRole('textbox',{name:'Note',exact:true})).toHaveValue('Keep this edit');
    await expect(page.getByRole('status')).toContainText('Not saved');
  }else{
    await expect(page.getByRole('textbox',{name:'Title',exact:true})).toHaveValue('Beta');
    await page.getByRole('button',{name:'Alpha Keep this edit',exact:true}).click();
    await expect(page.getByRole('textbox',{name:'Note',exact:true})).toHaveValue('Keep this edit');
    expect(writes).toBe(1);
    await page.getByRole('button',{name:'New note',exact:true}).click();
    await expect(page.getByRole('textbox',{name:'Title',exact:true})).toHaveValue('');
  }
});
