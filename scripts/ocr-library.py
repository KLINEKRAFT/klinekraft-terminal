#!/usr/bin/env python3
"""Add OCR text to image-only indexed PDF sections, preserving original file bytes."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from klinekraft import research
from klinekraft.conversations import database

def main():
    with database() as c:
        research.init(c)
        rows=c.execute("SELECT id,name,digest FROM research_files WHERE mime='application/pdf' AND length(trim(extracted))<10").fetchall()
    print('Image-only sections:',len(rows),flush=True)
    for row in rows:
        path=research.files_root()/row['digest']
        with tempfile.TemporaryDirectory() as temp:
            output=Path(temp)/'searchable.pdf'
            try:
                subprocess.run(['ocrmypdf','--skip-text','--jobs','1','--optimize','0','--output-type','pdf',str(path),str(output)],check=True,timeout=300,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
                text=research.extracted_text(output.read_bytes(),'application/pdf')
                if text.strip():
                    with database() as c:
                        research.init(c)
                        c.execute('UPDATE research_files SET extracted=? WHERE id=? AND digest=?',(text,row['id'],row['digest']))
                    print('Indexed OCR:',row['name'],len(text),flush=True)
                else:print('No text detected:',row['name'],flush=True)
            except (OSError,subprocess.SubprocessError) as e:print('OCR failed:',row['name'],type(e).__name__,flush=True)

if __name__=='__main__':main()
