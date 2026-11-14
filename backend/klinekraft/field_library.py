"""Read-only hotspot library. Deliberately separate from the private Terminal API."""
import html
import sqlite3
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, FileResponse
from .conversations import db_path
from . import research

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
STYLE = 'body{font:16px system-ui;background:#15191d;color:#eee;margin:20px auto;padding:16px;max-width:850px}a{color:#72a2ff}input,button{font:inherit;padding:10px;background:#252b32;color:#eee;border:1px solid #555}li{margin:24px 0}small{color:#aab}p{line-height:1.6}input{max-width:90%}'

def connection():
    try:
        c=sqlite3.connect('file:'+str(db_path())+'?mode=ro', uri=True)
        c.row_factory=sqlite3.Row
        return c
    except sqlite3.Error: raise HTTPException(503,'Library not ready.')

@app.get('/', response_class=HTMLResponse)
def index(q: str=Query(default='',max_length=200)):
    c=connection()
    try:
        terms=research.query_terms(q)
        if terms:
            expression=' OR '.join('"'+t+'"' for t in terms)
            rows=c.execute("""SELECT f.* FROM research_fts JOIN research_files f ON f.id=research_fts.rowid
                WHERE research_fts MATCH ? AND f.collection LIKE 'Emergency - %'
                ORDER BY bm25(research_fts,4,1) LIMIT 100""",(expression,)).fetchall()
        else:
            rows=c.execute("SELECT * FROM research_files WHERE collection LIKE 'Emergency - %' ORDER BY name LIMIT 100").fetchall()
    finally: c.close()
    items=[]
    for row in rows:
        excerpt=research.best_excerpt(row,terms)
        items.append(f'<li><a href="/documents/{row["id"]}">{html.escape(row["name"])}</a><br><small>{html.escape(row["collection"])}</small><p>{html.escape(excerpt["snippet"])}</p></li>')
    return HTMLResponse(f'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Klinekraft Field Library</title><style>{STYLE}</style></head><body><h1>Klinekraft Field Library</h1><p>Saved emergency references. Works on this local network without internet. Personal notes, chats and controls are private.</p><form><label>Search references <input name="q" maxlength="200" value="{html.escape(q,quote=True)}"></label><button>Search</button></form><p>Up to 100 results. Refine your search for more.</p><ul>{"".join(items) or "No matching references."}</ul></body></html>',headers={'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'})

@app.get('/documents/{file_id}')
def document(file_id:int):
    c=connection()
    try: row=c.execute("SELECT * FROM research_files WHERE id=? AND collection LIKE 'Emergency - %'",(file_id,)).fetchone()
    finally:c.close()
    if row is None: raise HTTPException(404,'Document not shared.')
    path=research.files_root()/row['digest']
    if not path.is_file() or path.is_symlink(): raise HTTPException(404,'Document missing.')
    return FileResponse(path,media_type=row['mime'],headers={'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; sandbox"})
