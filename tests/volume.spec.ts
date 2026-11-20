import {test,expect} from "@playwright/test";
test("header controls whole-computer volume and mute without leaving Home",async({page})=>{
 await page.setViewportSize({width:1024,height:600});
 let state={volume:20,muted:false};
 await page.route("**/api/audio",async r=>{
  if(r.request().method()==="PUT")state={...state,...r.request().postDataJSON()};
  await r.fulfill({json:state});
 });
 await page.goto("/");
 await page.getByLabel("Computer volume",{exact:true}).first().click();
 const slider=page.getByRole("slider",{name:"Computer volume"});
 await expect(slider).toHaveValue("20");
 await slider.fill("37");
 await expect.poll(()=>state.volume).toBe(37);
 await page.getByRole("button",{name:"Mute",exact:true}).click();
 await expect.poll(()=>state.muted).toBe(true);
 await expect(page.getByRole("button",{name:"Unmute",exact:true})).toBeVisible();
 await page.screenshot({path:"test-results/volume-control.png"});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(1024);
 await page.keyboard.press("Escape");
 await expect(slider).not.toBeVisible();
});
