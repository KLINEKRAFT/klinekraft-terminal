#!/usr/bin/env python3
"""Download a curated personal emergency reference library and import bounded sections."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import urllib.request
from bs4 import BeautifulSoup

REPO = Path(__file__).resolve().parents[1]

def slug(text):
    return re.sub(r'[^\w .()-]', '-', text).strip()[:160]

def pieces(text, limit=24000):
    while text:
        head = text.encode('utf-8')[:limit].decode('utf-8', errors='ignore')
        if len(head) < len(text):
            cut = head.rfind('\n')
            if cut > len(head)//2: head = head[:cut+1]
        yield head
        text = text[len(head):]

def download(source, root, date):
    title, category = source['title'], source['category']
    originals = root/'Originals'/category
    sections = root/'Searchable'/category
    originals.mkdir(parents=True, exist_ok=True)
    sections.mkdir(parents=True, exist_ok=True)
    name = slug(title)
    published_sections = sections
    record = {k:v for k,v in source.items() if not k.startswith('_')}
    record['downloaded_on'] = date
    try:
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            sections = temporary/'sections'
            sections.mkdir()
            raw = temporary/'download'
            if source.get('_cached_original'):
                shutil.copy2(source['_cached_original'],raw)
                content_type, final_url = 'application/pdf', source['url']
            else:
                dns_args = ['--doh-url','https://dns.google/dns-query'] if source.get('https_dns') else []
                report = subprocess.run(['curl',*dns_args,'--http1.1','-fL','--retry','1','--connect-timeout','20','--max-time','180','--max-filesize','100000000','-sS','-o',str(raw),'-w','%{content_type}\n%{url_effective}',source['url']],check=True,capture_output=True,text=True)
                content_type, final_url = report.stdout.split('\n',1)
            body = raw.read_bytes()
            record.update(final_url=final_url, sha256=hashlib.sha256(body).hexdigest(),bytes=len(body))
            paths = []
            if body.startswith(b'%PDF-'):
                original = originals/(name+'.pdf')
                original.write_bytes(body)
                info = subprocess.check_output(['pdfinfo',str(original)],text=True)
                count = int(re.search(r'^Pages:\s+(\d+)',info,re.M).group(1))
                record['pages'] = count
                # Small PDF sections preserve diagrams/tables and avoid import truncation.
                def section(first,last):
                    target = sections/f'{name} (PDF pages {first:03d}-{last:03d}).pdf'
                    subprocess.run(['gs','-q','-dSAFER','-dBATCH','-dNOPAUSE','-sDEVICE=pdfwrite',
                                    f'-dFirstPage={first}',f'-dLastPage={last}',
                                    '-sOutputFile='+str(target),str(original)],check=True,
                                   stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=90)
                    text = subprocess.check_output(['pdftotext','-q',str(target),'-'],timeout=20)
                    if target.stat().st_size > 8*1024*1024 or len(text)>30000:
                        target.unlink()
                        if first == last: raise ValueError(f'Page {first} exceeds safe import bounds')
                        middle=(first+last)//2
                        section(first,middle);section(middle+1,last)
                    else:
                        if not text.strip(): record.setdefault('image_only_ranges', []).append([first,last])
                        paths.append(target.name)
                for first in range(1,count+1,4):section(first,min(first+3,count))
            else:
                if 'html' not in content_type: raise ValueError('Unexpected document type')
                original = originals/(name+'.html')
                original.write_bytes(body)
                soup = BeautifulSoup(body,'html.parser')
                for element in soup.select('script,style,nav,header,footer,form,aside,noscript'):element.decompose()
                article = soup.select_one('.cdc-dfe-body') or soup.select_one('article') or soup.select_one('main') or soup.select_one('#content') or soup.body
                if article is None: raise ValueError('No readable article body')
                # Preserve row/column separation in source tables.
                for row in article.select('tr'):
                    row.replace_with(' | '.join(cell.get_text(' ',strip=True) for cell in row.select('th,td'))+'\n')
                text = article.get_text('\n',strip=True)
                if len(text)<500 or 'Access Denied' in text[:200]:raise ValueError('Missing or blocked article text')
                prefix=f'{title}\nSource: {source["url"]}\nRetrieved: {date}\nOffline text snapshot; links, live alerts and external images are not downloaded.\n\n'
                for part,chunk in enumerate(pieces(text),1):
                    target=sections/f'{name} (part {part:02d}).txt'
                    target.write_text(prefix+chunk)
                    paths.append(target.name)
            # Publish only complete source sections; failures never import partial manuals.
            for old in published_sections.glob(name+' (*'):
                old.unlink()
            for filename in paths:
                shutil.copy2(sections/filename,published_sections/filename)
            record.update(original=str(original.relative_to(root)),sections=[str((published_sections/f).relative_to(root)) for f in paths],status='downloaded')
    except Exception as error:
        detail = getattr(error, 'stderr', '') or str(error)
        if isinstance(detail, bytes): detail=detail.decode(errors='replace')
        record.update(status='failed',error=detail[-500:])
    return record

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--date',required=True,help='Local retrieval date, YYYY-MM-DD')
    parser.add_argument('--import-local',action='store_true')
    parser.add_argument('--offline',action='store_true',help='Reuse local sections without external downloads')
    args=parser.parse_args()
    root=Path.home()/'Documents/Emergency Library'
    root.mkdir(parents=True,exist_ok=True)
    sources=json.loads((REPO/'assets/emergency/sources.json').read_text())
    previous = json.loads((root/'manifest.json').read_text()) if (root/'manifest.json').exists() else []
    cached = {r['url']: r for r in previous if r.get('status') == 'downloaded' and all((root/p).is_file() for p in r.get('sections',[]))}
    for source in sources:
        old = next((r for r in previous if r['url'] == source['url']), {})
        original = root/'Originals'/source['category']/(slug(source['title'])+'.pdf')
        if original.is_file() and hashlib.sha256(original.read_bytes()).hexdigest() == old.get('sha256'):
            source['_cached_original'] = str(original)
    def obtain(source):
        if source['url'] in cached: return cached[source['url']]
        if args.offline:
            return {**{k:v for k,v in source.items() if not k.startswith('_')}, 'status':'failed', 'error':next((r.get('error') for r in previous if r['url'] == source['url']), None) or 'Not available locally; retry without --offline'}
        return download(source,root,args.date)
    records=[]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for record in pool.map(obtain,sources):
            records.append(record)
            print(record['status'],record['title'],len(record.get('sections',[])),record.get('error',''),flush=True)
            pending = root/'manifest.json.tmp'
            pending.write_text(json.dumps(records,indent=2)+'\n')
            pending.replace(root/'manifest.json')
    if args.import_local:
        for folder in sorted((root/'Searchable').iterdir()):
            if not folder.is_dir():continue
            reports=[]
            while True:
                body=json.dumps({'collection':'Emergency - '+folder.name,'root':'documents','path':str(folder.relative_to(Path.home()/'Documents'))}).encode()
                request=urllib.request.Request('http://127.0.0.1:8000/api/research/import',data=body,headers={'Content-Type':'application/json','X-Klinekraft-Client':'local-ui'})
                with urllib.request.urlopen(request,timeout=180) as response:report=json.load(response)
                reports.append(report)
                if not report['limited']:break
                if not report['imported']:raise RuntimeError('Import made no progress')
            print('Imported',folder.name,reports,flush=True)
    complete = [r for r in records if r['status'] == 'downloaded']
    lines = ['# Klinekraft Emergency Library', '',
             f"{len(complete)} downloaded references; {sum(len(r.get('sections', [])) for r in complete)} searchable/viewable sections.", '',
             'Open Terminal → Library → Research and choose an Emergency collection. Search by a topic such as fallout, water, shelter, burns, or canning. In AI, enable research-library references.', '',
             'Documents and local text search work without internet. The current AI model still needs internet; these downloads do not install or train an offline model.', '',
             'Open original PDFs for complete tables, diagrams, surrounding instructions, and edition dates. Section filenames identify ORIGINAL PDF page ranges; citation page numbers refer to pages WITHIN that section. Printed page numbers may differ.', '',
             'Field medicine manuals are references for trained responders and clinicians. They include procedures requiring training and equipment. Older editions are retained as dated references; a download date does not mean the guidance was updated that day. Check original sources and current local emergency instructions.', '',
             'HTML text snapshots do not include external images, linked pages, videos, or live alerts. Image-only PDF pages are viewable but not text-searchable. The manifest lists these gaps. Original files are unchanged; searchable PDF sections are regenerated copies.', '',
             '## Downloaded sources', '']
    from urllib.parse import quote
    for category in sorted({r['category'] for r in complete}):
        lines.extend(['### '+category, ''])
        for r in complete:
            if r['category'] != category: continue
            note = ' — includes image-only pages' if r.get('image_only_ranges') else ''
            lines.append(f"- [{r['title']}]({quote(r['original'])}) — [publisher]({r['url']}); retrieved {r['downloaded_on']}{note}")
        lines.append('')
    lines.extend(['## Not downloaded', ''])
    for r in records:
        if r['status'] != 'downloaded': lines.append(f"- {r['title']}: {r.get('error', 'unavailable').strip()}")
    (root/'START HERE.md').write_text('\n'.join(lines)+'\n')
    print('Manifest:',root/'manifest.json',flush=True)

if __name__=='__main__':main()
