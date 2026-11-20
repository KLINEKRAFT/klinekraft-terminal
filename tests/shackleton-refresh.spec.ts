import {test,expect} from "@playwright/test";
import {navigate} from "./navigation";
test("Shackleton opens fresh, preserves history and reads answers on demand",async({page})=>{
 await page.setViewportSize({width:1024,height:600});
 const old={id:"old",title:"Saved expedition",revision:1,updated:new Date().toISOString(),context:null,turns:[{question:"Saved question",answer:"## Heading\nA **clear answer** with a short list.\n\n- First item\n- Second item",notice:"Local reference details.",sources:[],images:[]}]};
 await page.addInitScript(()=>{localStorage.setItem("klinekraft.lastChat.v1","old");HTMLMediaElement.prototype.play=function(){return Promise.resolve();};});
 await page.route("**/api/ai/status",r=>r.fulfill({json:{configured:true,model:"test",local:{configured:true,model:"test"},cloud:{configured:true,model:"test"}}}));
 await page.route("**/api/conversations**",r=>r.fulfill({json:r.request().url().endsWith("/old")?old:{chats:[old]}}));
 const wav=Buffer.alloc(1644);wav.write("RIFF",0);wav.writeUInt32LE(1636,4);wav.write("WAVEfmt ",8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write("data",36);wav.writeUInt32LE(1600,40);
 await page.route("**/api/speech",r=>r.request().method()==="POST"?r.fulfill({body:wav,contentType:"audio/wav"}):r.fulfill({json:{configured:false,provider:"local",voice:"JBFqnCBsd6RMkjVDRZzb",offline:true}}));
 await page.goto("/");await navigate(page,"Shackleton");
 await expect(page.getByText("What would you like to explore?",{exact:true})).toBeVisible();
 await expect(page.getByText("Saved question",{exact:true})).toHaveCount(0);
 await page.screenshot({path:"test-results/shack-welcome.png"});
 await page.getByRole("button",{name:"History",exact:true}).click();
 const history=page.getByRole("dialog",{name:"Saved conversations"});
 await expect(history).toBeVisible();
 await history.getByRole("button",{name:/Saved expedition/}).click();
 await expect(history).not.toBeVisible();
 await expect(page.locator(".ai-answer h2")).toHaveText("Heading");
 await page.getByRole("button",{name:"Read aloud",exact:true}).click();
 await expect(page.getByRole("button",{name:"Stop reading",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Stop reading",exact:true}).click();
 await page.screenshot({path:"test-results/shack-answer.png"});
 await navigate(page,"Home");await navigate(page,"Shackleton");
 await expect(page.getByText("What would you like to explore?",{exact:true})).toBeVisible();
 await page.getByLabel("Chat settings").click();
 await expect(page.getByText("Read-aloud voice",{exact:true})).toHaveCount(0);
 await navigate(page,"Settings");
 await page.getByText("Read-aloud voice",{exact:true}).click();
 await page.getByRole("combobox",{name:"Speech engine",exact:true}).selectOption("elevenlabs");
 await expect(page.getByLabel("ElevenLabs API key",{exact:true})).toHaveAttribute("type","password");
 const voice = page.getByRole("combobox", {name:"Voice",exact:true});
 await expect(voice.locator("option")).toHaveCount(5);
 await expect(voice).toHaveValue("JBFqnCBsd6RMkjVDRZzb");
 let savedVoice = "";
 await page.route("**/api/speech", async r => {
   if (r.request().method() === "PUT") {
     const body = r.request().postDataJSON();
     savedVoice = body.voice;
     await r.fulfill({json:{configured:true,provider:body.provider,voice:body.voice,offline:true}});
   } else await r.fulfill({json:{configured:true,provider:"elevenlabs",voice:savedVoice,offline:true}});
 });
 for (const id of ["WdZjiN0nNcik2LBjOHiv","onwK4e9ZLuTAKqWW03F9","pNInz6obpgDQGcFmaJgB","JBFqnCBsd6RMkjVDRZzb"]) {
   await voice.selectOption(id);
   await page.getByRole("button",{name:"Save voice settings",exact:true}).click();
   await expect.poll(()=>savedVoice).toBe(id);
   await expect(voice).toHaveValue(id);
 }
 await voice.selectOption("custom");
 await page.getByLabel("Custom voice ID",{exact:true}).fill("my_custom_voice");
 await page.getByRole("button",{name:"Save voice settings",exact:true}).click();
 await expect.poll(()=>savedVoice).toBe("my_custom_voice");
 await expect(page.getByLabel("Custom voice ID",{exact:true})).toHaveValue("my_custom_voice");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(1024);
});
