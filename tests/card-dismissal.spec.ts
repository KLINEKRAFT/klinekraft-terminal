import {test,expect} from "@playwright/test";
import {navigate} from "./navigation";
test("cards close outside, stay open inside, and can reopen",async({page})=>{
 await page.setViewportSize({width:1024,height:600});
 await page.route("**/api/tools",r=>r.fulfill({json:{tools:[]}}));
 await page.goto("/");
 await page.getByRole("button",{name:"Tools",exact:true}).click();
 const tools=page.getByRole("dialog",{name:"Desktop tools"});
 await tools.getByRole("heading",{name:"Tools",exact:true}).click();
 await expect(tools).toBeVisible();
 const rect=await tools.boundingBox();
 await page.mouse.move(rect!.x+30,rect!.y+30);await page.mouse.down();await page.mouse.move(5,5);await page.mouse.up();
 await expect(tools).toBeVisible();
 await page.mouse.click(5,5);
 await expect(tools).toHaveCount(0);
 await page.getByRole("button",{name:"Tools",exact:true}).click();
 await expect(tools).toBeVisible();
 await page.keyboard.press("Escape");
 await navigate(page,"Shackleton");
 await page.getByLabel("Chat settings",{exact:true}).click();
 await expect(page.locator(".ai-options")).toHaveAttribute("open","");
 await page.mouse.click(500,30);
 await expect(page.locator(".ai-options")).not.toHaveAttribute("open","");
});
test("weather speech summarizes today with stale labeling",async({page})=>{
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Chicago"}).format(new Date());
 const wav=Buffer.alloc(1644);wav.write("RIFF",0);wav.writeUInt32LE(1636,4);wav.write("WAVEfmt ",8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write("data",36);wav.writeUInt32LE(1600,40);
 let speech: {text:string;save?:boolean}|undefined;
 await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){return Promise.resolve();};});
 await page.route("**/api/speech",r=>{
   if(r.request().method()==="POST") {speech=r.request().postDataJSON();return r.fulfill({body:wav,contentType:"audio/wav"});}
   return r.fulfill({json:{provider:"local",offline:true}});
 });
 await page.route("**/api/speech/saved",r=>r.fulfill({json:{recordings:[]}}));
 await page.route("**/api/briefing",r=>r.fulfill({json:{
   settings:{enabled:true,location:"Tulsa",ticker:false},events:[],acknowledged:[],
   feeds:{forecast:{stale:true,updated:1700000000,data:{timezone:"America/Chicago",
     daily:{time:[today],weather_code:[3],temperature_2m_max:[72],temperature_2m_min:[51],precipitation_probability_max:[40],wind_speed_10m_max:[15],sunset:[today+"T17:20"]}}}}
 }}));
 await page.goto("/");await navigate(page,"Field Briefing");
 await page.getByRole("button",{name:"Weather summary",exact:true}).click();
 await expect.poll(()=>speech?.text).toContain("Weather in Tulsa today.");
 expect(speech!.text).toContain("High 72, low 51 degrees Fahrenheit");
 expect(speech!.text).toContain("precipitation 40 percent");
 expect(speech!.text).toContain("Current weather could not be confirmed");
 expect(speech!.text).not.toContain(today);
 expect(speech!.text).not.toContain("Forecast saved");
 expect(speech!.save).toBeUndefined();
 await expect(page.getByRole("dialog")).toHaveCount(0);
 await page.getByRole("button",{name:"Stop reading",exact:true}).click();
 await expect(page.getByRole("button",{name:"Weather summary",exact:true})).toBeVisible();
});
