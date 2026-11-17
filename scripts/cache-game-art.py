#!/usr/bin/env python3
"""Cache matching Libretro covers locally. Never downloads ROMs or changes game IDs."""
import concurrent.futures,html,json,re,urllib.request,urllib.parse,io
from pathlib import Path
from PIL import Image
ROOT=Path.home()/'Games/Klinekraft';OUT=ROOT/'artwork';OUT.mkdir(exist_ok=True)
SYSTEMS={'n64':'Nintendo - Nintendo 64','nes':'Nintendo - Nintendo Entertainment System','snes':'Nintendo - Super Nintendo Entertainment System','megadrive':'Sega - Mega Drive - Genesis'}
def key(s):return re.sub(r'[^a-z0-9]','',s.lower())
lookup={}
for system,name in SYSTEMS.items():
 base='https://thumbnails.libretro.com/'+urllib.parse.quote(name)+'/Named_Boxarts/'
 try:
  page=urllib.request.urlopen(base,timeout=25).read(3000000).decode()
  lookup[system]={key(Path(urllib.parse.unquote(html.unescape(path))).stem):urllib.parse.urljoin(base,html.unescape(path)) for path in re.findall(r'href="([^"]+\.png)"',page,re.I)}
 except Exception as e:print(system,type(e).__name__,flush=True);lookup[system]={}
games=json.loads((ROOT/'catalog.json').read_text())['games']
def fetch(game):
 path=OUT/(game['id']+'.jpg')
 if path.exists():return 'cached'
 title=game['title'];candidates=[title]
 if 'GoldenEye' in title:candidates+=['007 - GoldenEye (USA)','GoldenEye 007 (USA)']
 url=next((lookup.get(game['system'],{}).get(key(x)) for x in candidates if lookup.get(game['system'],{}).get(key(x))),None)
 if not url:return 'unmatched'
 try:
  data=urllib.request.urlopen(url,timeout=12).read(4000001)
  if len(data)>4000000:return 'failed'
  with Image.open(io.BytesIO(data)) as image:
   image.thumbnail((360,480));image.convert('RGB').save(path,'JPEG',quality=83)
  return 'saved'
 except Exception:return 'failed'
counts={}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for i,result in enumerate(pool.map(fetch,games)):
  counts[result]=counts.get(result,0)+1
  if i%100==0:print(i,counts,flush=True)
report={'source':'https://github.com/libretro-thumbnails/libretro-thumbnails','counts':counts,'matchPolicy':'Exact normalized title; GoldenEye alias. Missing covers retain title fallback.'}
(OUT/'provenance.json').write_text(json.dumps(report,indent=2));print(report,flush=True)
