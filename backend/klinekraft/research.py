"""Local research collections with bounded text extraction."""
import hashlib
import os
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
def search(q: str = Query(default="", max_length=200), collection: str = Query(default="", max_length=80)):
    with database() as connection:
        init(connection)
        collections = [row[0] for row in connection.execute(
            "SELECT DISTINCT collection FROM research_files ORDER BY collection"
        )]
        rows = connection.execute(
            """SELECT id, collection, name, mime FROM research_files
            WHERE (? = '' OR collection = ?) AND
            (instr(lower(name), lower(?)) > 0 OR instr(lower(extracted), lower(?)) > 0)
            ORDER BY name COLLATE NOCASE, id LIMIT 101""",
            (collection, collection, q, q),
        ).fetchall()
    return {"files": [dict(row) for row in rows[:100]], "collections": collections, "limited": len(rows) > 100}


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
    """Return a few local excerpts with their original PDF page numbers."""
    import re

    stop = set("what where when which who why how does from about this that with have find explain please".split())
    terms = [term for term in dict.fromkeys(re.findall(r"[^\W_]{3,}", question.lower())) if term not in stop][:8]
    if not terms:
        return []
    clause = " OR ".join("instr(lower(name || ' ' || extracted), ?) > 0" for _ in terms)
    relevance = " + ".join("(instr(lower(name || ' ' || extracted), ?) > 0)" for _ in terms)
    with database() as connection:
        init(connection)
        rows = connection.execute(
            f"SELECT id, collection, name, mime, extracted FROM research_files WHERE {clause} ORDER BY ({relevance}) DESC, id DESC LIMIT 100",
            terms + terms,
        ).fetchall()
    matches = []
    for row in rows:
        pdf = row["mime"] == "application/pdf"
        pages = row["extracted"].split("\f") if pdf else [row["extracted"]]
        for number, page in enumerate(pages, 1):
            lower = page.lower()
            positions = [match.start() for term in terms for match in re.finditer(re.escape(term), lower)]
            if not positions:
                continue
            # Score the actual excerpt, not matches elsewhere on a long page.
            starts = {max(0, position - 250) for position in positions}
            start = max(sorted(starts), key=lambda offset: sum(term in lower[offset:offset + 1800] for term in terms))
            snippet = page[start:start + 1800].strip()
            score = sum(term in snippet.lower() for term in terms) + 2 * sum(term in row["name"].lower() for term in terms)
            matches.append((score, {
                "fileId": row["id"],
                "title": row["name"],
                "page": number if pdf else None,
                "text": f"Collection: {row['collection']}\n" + snippet,
            }))
    matches.sort(key=lambda item: item[0], reverse=True)
    return [passage for _, passage in matches[:4]]
