import {test,expect} from "@playwright/test";
import {navigate} from "./navigation";

test("an old power poll cannot undo a successful dim change",async({page})=>{
 await page.clock.install();
 let polls=0,release:()=>void=()=>{};
 const held=new Promise<void>(resolve=>release=resolve);
 let delayed=false;
 await page.route("**/api/power**",async r=>{
   const changing=r.request().method()==="POST";
   if(!changing && ++polls===2){delayed=true;await held;}
   await r.fulfill({json:{field:false,dim:changing,percent:70,voltage:3.9,warning:null,reserveMinutes:120,guard:{valid:true,shutdownSeconds:null}}});
 });
 await page.goto("/");
 await page.getByRole("button",{name:/^Power ·/}).click();
 await page.clock.fastForward(10001);
 await expect.poll(()=>delayed).toBe(true);
 await page.getByRole("switch",{name:"Dim screen",exact:true}).click();
 await expect(page.locator("html")).toHaveClass(/field-mode/);
 const response=page.waitForResponse(r=>r.url().endsWith("/api/power") && r.request().method()==="GET");
 release();
 await response;
 await expect(page.locator("html")).toHaveClass(/field-mode/);
});

for (const fail of [false,true]) test("Paint saves before leaving when recovery storage is full; server failure="+fail,async({page})=>{
 await page.addInitScript(()=>{
   const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){
     if(key==="klinekraft.paint.draft") throw new DOMException("Quota exceeded","QuotaExceededError");
     return original.call(this,key,value);
   };
 });
 let saved:any=null;
 await page.route("**/api/organizer**",r=>{
   if(r.request().method()==="GET") return r.fulfill({json:saved?[saved]:[]});
   if(fail)return r.fulfill({status:503,json:{detail:"Storage unavailable"}});
   saved={...r.request().postDataJSON(),revision:1};
   return r.fulfill({json:saved});
 });
 await page.goto("/");await navigate(page,"Paint");
 const canvas=page.getByLabel("Drawing canvas",{exact:true});
 await expect(page.getByLabel("Drawing name",{exact:true})).toBeEnabled();
 // Freeze autosave so leaving the page, rather than its timer, must save.
 await page.clock.install();
 await page.clock.pauseAt(new Date(Date.now()+1000));
 const box=(await canvas.boundingBox())!;
 await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();
 await page.mouse.move(box.x+60,box.y+60);await page.mouse.up();
 await navigate(page,"Home");
 if(fail){
   await expect(page.getByRole("region",{name:"Paint workspace"})).toBeVisible();
   await expect(page.getByText(/Storage unavailable/)).toBeVisible();
 }else{
   await expect(page.getByRole("button",{name:"Brief me",exact:true})).toBeVisible();
   expect(saved.body).toMatch(/^data:image\/png;base64,/);
 }
});

test("an active event ticker cannot block Return to desktop",async({page})=>{
 const now=Date.now()/1000;
 await page.setViewportSize({width:1024,height:600});
 await page.route("**/api/briefing",r=>r.fulfill({json:{settings:{enabled:true,ticker:true,location:"Tulsa"},acknowledged:[],feeds:{},checkedAt:now,events:[{id:"test",title:"Test weather alert",kind:"Weather",severity:"Severe",text:"Test only",issued:now,expires:now+3600,stale:false}]}}));
 await page.goto("/");
 await expect(page.locator(".event-ticker")).toBeVisible();
 await page.getByRole("button",{name:"Open navigation",exact:true}).click();
 await page.getByRole("button",{name:"Return to desktop",exact:true}).click();
 await expect(page.getByRole("dialog")).toContainText("Alt + F4");
});

test("Paint waits for an in-flight save and saves newer strokes before leaving",async({page})=>{
 let release:()=>void=()=>{};
 const held=new Promise<void>(resolve=>release=resolve);
 const writes:any[]=[];
 await page.route("**/api/organizer**",async r=>{
   if(r.request().method()==="GET")return r.fulfill({json:[]});
   const item=r.request().postDataJSON();writes.push(item);
   if(writes.length===1)await held;
   await r.fulfill({json:{...item,revision:item.revision+1}});
 });
 await page.goto("/");await navigate(page,"Paint");
 await expect(page.getByLabel("Drawing name",{exact:true})).toBeEnabled();
 const canvas=page.getByLabel("Drawing canvas",{exact:true});
 const box=(await canvas.boundingBox())!;
 async function stroke(offset:number){
   await page.mouse.move(box.x+offset,box.y+30);await page.mouse.down();
   await page.mouse.move(box.x+offset+25,box.y+60);await page.mouse.up();
 }
 await stroke(30);
 await expect.poll(()=>writes.length).toBe(1);
 await stroke(90);
 const latest=await canvas.evaluate((el:HTMLCanvasElement)=>el.toDataURL("image/png"));
 await navigate(page,"Home");
 await expect(canvas).toBeVisible();
 release();
 await expect(page.getByRole("button",{name:"Brief me",exact:true})).toBeVisible();
 expect(writes).toHaveLength(2);
 expect(writes[1].revision).toBe(1);
 expect(writes[1].body).toBe(latest);
});
