"""Local research collections with bounded text extraction."""
import hashlib
import os
import re
from pathlib import Path
import subprocess
import tempfile

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .conversations import database, db_path
from .local_content import local_request, safe_path

router = APIRouter(prefix="/api/research", dependencies=[Depends(local_request)])
TYPES = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg",
         ".jpeg": "image/jpeg", ".webp": "image/webp", ".txt": "text/plain", ".md": "text/plain"}
MAX_BYTES = 8 * 1024 * 1024
MAX_TEXT = 32_000


class FolderImport(BaseModel):
    collection: str = Field(min_length=1, max_length=80, pattern=r"\S")
    root: str
    path: str = Field(default="", max_length=1024)


def files_root():
    return db_path().parent / "research-files"


def init(connection):
    connection.execute("""CREATE TABLE IF NOT EXISTS research_files (
        id INTEGER PRIMARY KEY,
        collection TEXT NOT NULL,
        name TEXT NOT NULL,
        mime TEXT NOT NULL,
        digest TEXT NOT NULL,
        extracted TEXT NOT NULL,
        UNIQUE(collection, name, digest)
    )""")

    # External-content FTS keeps the original records and stable document IDs.
    exists = connection.execute("SELECT 1 FROM sqlite_master WHERE name='research_fts'").fetchone()
    connection.execute("CREATE VIRTUAL TABLE IF NOT EXISTS research_fts USING fts5(name, extracted, content='research_files', content_rowid='id', tokenize='porter unicode61')")
    connection.execute("""CREATE TRIGGER IF NOT EXISTS research_fts_insert AFTER INSERT ON research_files BEGIN
        INSERT INTO research_fts(rowid,name,extracted) VALUES(new.id,new.name,new.extracted); END""")
    connection.execute("""CREATE TRIGGER IF NOT EXISTS research_fts_delete AFTER DELETE ON research_files BEGIN
        INSERT INTO research_fts(research_fts,rowid,name,extracted) VALUES('delete',old.id,old.name,old.extracted); END""")
    connection.execute("""CREATE TRIGGER IF NOT EXISTS research_fts_update AFTER UPDATE ON research_files BEGIN
        INSERT INTO research_fts(research_fts,rowid,name,extracted) VALUES('delete',old.id,old.name,old.extracted);
        INSERT INTO research_fts(rowid,name,extracted) VALUES(new.id,new.name,new.extracted); END""")
    if not exists:
        connection.execute("INSERT INTO research_fts(research_fts) VALUES('rebuild')")


def query_terms(query):
    stop = set("what where when which who why how does from about this that with have find explain please and the for are can you your guide guides research answer briefly using saved reference references source sources cite according tell give need information help do did my our us me of in on at to is it as be by or an a say says current during should would could will get use".split())
    return [t for t in dict.fromkeys(re.findall(r"[^\W_]{2,}", query.lower())) if t not in stop][:12]


def ranked_rows(connection, query, collection="", limit=101, exclude_historical=False, mime=""):
    terms = query_terms(query)
    if not terms:
        if query.strip():
            return []
        return connection.execute("SELECT * FROM research_files WHERE (?='' OR collection=?) AND (?=0 OR collection NOT LIKE 'Historical%') AND (?='' OR mime=?) ORDER BY CASE WHEN mime='application/pdf' THEN 0 ELSE 1 END,name COLLATE NOCASE,id LIMIT ?", (collection,collection,exclude_historical,mime,mime,limit)).fetchall()
    expression = ' OR '.join('"' + term + '"' for term in terms)
    return connection.execute("""SELECT f.* FROM research_fts JOIN research_files f ON f.id=research_fts.rowid
        WHERE research_fts MATCH ? AND (?='' OR f.collection=?) AND (?=0 OR f.collection NOT LIKE 'Historical%') AND (?='' OR f.mime=?)
        ORDER BY bm25(research_fts,4.0,1.0), f.id LIMIT ?""", (expression,collection,collection,exclude_historical,mime,mime,limit)).fetchall()


def best_excerpt(row, terms, length=450):
    pages = row['extracted'].split('\f') if row['mime'] == 'application/pdf' else [row['extracted']]
    candidates = []
    for number, page in enumerate(pages,1):
        lower = page.lower()
        positions = [m.start() for term in terms for m in re.finditer(re.escape(term),lower)]
        starts = {max(0,pos-100) for pos in positions} or {0}
        for start in starts:
            if start:
                boundary=page.find(' ',start,min(len(page),start+60))
                if boundary >= 0:start=boundary+1
            end=min(len(page),start+length)
            if end<len(page):
                boundary=page.rfind(' ',start,end)
                if boundary>start:end=boundary
            snippet = ('…' if start else '')+page[start:end].strip()+('…' if end<len(page) else '')
            candidates.append((sum(term in snippet.lower() for term in terms), -number, -start, snippet))
    best = max(candidates) if candidates else (0,-1,0,'')
    return {'snippet':best[3], 'page':-best[1] if row['mime']=='application/pdf' else None}


def extracted_text(data, mime):
    if mime == "text/plain":
        return data[:MAX_TEXT].decode("utf-8", errors="replace")
    if mime != "application/pdf":
        return ""
    try:
        with tempfile.TemporaryFile() as output:
            subprocess.run(
                ["pdftotext", "-q", "-f", "1", "-l", "50", "-", "-"],
                input=data, stdout=output, stderr=subprocess.DEVNULL, timeout=3, check=True,
            )
            output.seek(0)
            return output.read(MAX_TEXT).decode("utf-8", errors="replace")
    except (OSError, subprocess.SubprocessError):
        return ""


@router.post("/import")
def import_folder(body: FolderImport):
    folder = safe_path(body.root, body.path)
    if not folder.is_dir():
        raise HTTPException(400, "Choose a folder.")
    collection = body.collection.strip()
    files_root().mkdir(mode=0o700, parents=True, exist_ok=True)
    imported = skipped = examined = visited = 0
    for current, folders, names in os.walk(folder):
        visited += 1
        if visited > 1000:
            return {"imported": imported, "skipped": skipped, "limited": True}
        folders[:] = sorted(name for name in folders if not name.startswith(".") and not (Path(current) / name).is_symlink())
        for name in sorted(names):
            path = Path(current) / name
            mime = TYPES.get(path.suffix.lower())
            if name.startswith(".") or not mime or path.is_symlink():
                continue
            if imported >= 50:
                return {"imported": imported, "skipped": skipped, "limited": True}
            try:
                if not path.is_file() or path.stat().st_size > MAX_BYTES:
                    skipped += 1
                    continue
                with path.open("rb") as source:
                    data = source.read(MAX_BYTES + 1)
            except OSError:
                skipped += 1
                continue
            if not data or len(data) > MAX_BYTES:
                skipped += 1
                continue
            digest = hashlib.sha256(data).hexdigest()
            with database() as connection:
                init(connection)
                exists = connection.execute(
                    "SELECT 1 FROM research_files WHERE collection=? AND name=? AND digest=?",
                    (collection, str(path.relative_to(folder)), digest),
                ).fetchone()
            if exists:
                skipped += 1
                continue
            examined += 1
            if examined > 50:
                return {"imported": imported, "skipped": skipped, "limited": True}
            destination = files_root() / digest
            if not destination.exists():
                with tempfile.NamedTemporaryFile(dir=files_root(), delete=False) as stream:
                    stream.write(data)
                Path(stream.name).replace(destination)
            with database() as connection:
                init(connection)
                cursor = connection.execute(
                    "INSERT OR IGNORE INTO research_files (collection, name, mime, digest, extracted) VALUES (?, ?, ?, ?, ?)",
                    (collection, str(path.relative_to(folder)), mime, digest, extracted_text(data, mime)),
                )
                imported += cursor.rowcount
                skipped += 1 - cursor.rowcount
    return {"imported": imported, "skipped": skipped, "limited": False}


@router.get("")
def search(q: str = Query(default="", max_length=200), collection: str = Query(default="", max_length=80), mime: str = ""):
    with database() as connection:
        init(connection)
        collections = [row[0] for row in connection.execute(
            "SELECT DISTINCT collection FROM research_files ORDER BY collection"
        )]
        rows = ranked_rows(connection, q, collection, mime=mime)
        total = connection.execute("SELECT count(*) FROM research_files WHERE (?='' OR collection=?)", (collection,collection)).fetchone()[0]
    files = [{**{key:row[key] for key in ('id','collection','name','mime')},
              **best_excerpt(row,query_terms(q)), 'searchable':bool(row['extracted'].strip())} for row in rows[:100]]
    return {"files":files, "collections":collections, "limited":len(rows)>100, "total":total}



@router.get("/{file_id}")
def read_file(file_id: int):
    with database() as connection:
        init(connection)
        row = connection.execute("SELECT * FROM research_files WHERE id = ?", (file_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Research file not found.")
    return FileResponse(files_root() / row["digest"], media_type=row["mime"],
                        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


def relevant_passages(question):
    """Use the same ranked index as Library, preserving local document page links."""
    with database() as connection:
        init(connection)
        historical = bool(re.search(r'\b(historic(?:al)?|history|vintage|cold[ -]war|19[45678]\d)\b', question, re.I))
        rows = ranked_rows(connection, question, limit=20, exclude_historical=not historical)
    passages, seen = [], set()
    for row in rows:
        # Avoid filling the context with adjacent chunks of the same manual.
        identity = re.sub(r" \(PDF pages .*| \(part .*", "", row['name'])
        if identity in seen or not row['extracted'].strip():
            continue
        excerpt = best_excerpt(row, query_terms(question),1800)
        if not excerpt['snippet']:
            continue
        seen.add(identity)
        passages.append({'fileId':row['id'], 'title':row['name'], 'page':excerpt['page'],
                         'text':f"Collection: {row['collection']}\n"+excerpt['snippet']})
        if len(passages)==4:
            break
    return passages


_preview_lock = __import__('threading').Semaphore(2)

@router.get("/{file_id}/thumbnail")
def thumbnail(file_id: int):
    from PIL import Image
    with database() as connection:
        init(connection)
        row=connection.execute("SELECT digest,mime FROM research_files WHERE id=?",(file_id,)).fetchone()
    if row is None: raise HTTPException(404,"Document not found")
    if row['mime']!='application/pdf' and not row['mime'].startswith('image/'):
        raise HTTPException(404,"No image preview")
    source=files_root()/row['digest']
    cache=files_root().parent/'research-previews';cache.mkdir(exist_ok=True)
    target=cache/(row['digest']+'.jpg')
    if not target.exists():
        with _preview_lock:
            if not target.exists():
                try:
                    with tempfile.TemporaryDirectory(dir=cache) as temp:
                        output=Path(temp)/'preview'
                        if row['mime']=='application/pdf':
                            subprocess.run(['pdftoppm','-f','1','-singlefile','-scale-to','420','-jpeg',str(source),str(output)],check=True,timeout=15,capture_output=True)
                        else:
                            with Image.open(source) as image:
                                image.thumbnail((420,420));image.convert('RGB').save(str(output)+'.jpg')
                        Path(str(output)+'.jpg').replace(target)
                except (OSError,ValueError,subprocess.SubprocessError): raise HTTPException(422,"Preview unavailable")
    return FileResponse(target,media_type='image/jpeg',headers={'Cache-Control':'private, max-age=86400'})
