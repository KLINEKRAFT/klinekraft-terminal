import {test,expect} from "@playwright/test";
import {navigate} from "./navigation";
test("saved stations and radio playback persist across app navigation, Stop unloads stream",async({page})=>{
 let stations=[{id:"kexp",name:"KEXP",url:"https://kexp.streamguys1.com/kexp160.aac"}];
 await page.route("**/api/radio/stations**",async r=>{
  if(r.request().method()==="POST"){const s={id:"extra",...r.request().postDataJSON()};stations.push(s);return r.fulfill({json:s});}
  if(r.request().method()==="DELETE"){stations=stations.filter(s=>s.id!=="extra");return r.fulfill({json:{removed:true}});}
  return r.fulfill({json:stations});
 });
 await page.addInitScript(()=>{
  HTMLMediaElement.prototype.play=function(){this.dispatchEvent(new Event("playing"));return Promise.resolve();};
  HTMLMediaElement.prototype.load=function(){};
  HTMLMediaElement.prototype.pause=function(){};
 });
 await page.route("https://kexp.streamguys1.com/**",r=>r.abort());
 await page.setViewportSize({width:1024,height:600});
 await page.goto("/");
 const radio=page.getByLabel("Internet radio",{exact:true});
 await radio.click();
 await expect(page.getByLabel("Radio",{exact:false}).filter({has:page.locator("option")})).toHaveCount(1);
 await page.getByRole("button",{name:"Play radio",exact:true}).click();
 await expect(page.locator(".radio-popover")).toContainText("Live");
 await page.keyboard.press("Escape");
 await navigate(page,"Notes");
 await radio.click();
 await expect(page.getByRole("button",{name:"Stop radio",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Stop radio",exact:true}).click();
 await expect(page.locator(".radio-control audio")).not.toHaveAttribute("src",/.+/);
 await page.getByText("Add station",{exact:true}).click();
 await page.getByLabel("Station name",{exact:true}).fill("Another station");
 await page.getByLabel("Station stream URL",{exact:true}).fill("https://example.org/live.mp3");
 await page.getByRole("button",{name:"Save station",exact:true}).click();
 await expect(page.locator("#radio-station option")).toHaveCount(2);
 await page.reload();
 await radio.click();
 await expect(page.locator("#radio-station option")).toHaveCount(2);
 await page.screenshot({path:"test-results/radio-player.png"});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(1024);
});
