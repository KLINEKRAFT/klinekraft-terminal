"""Private, local chat storage. No model calls or credentials in this database."""
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from .local_content import local_request

router = APIRouter(prefix="/api/conversations", dependencies=[Depends(local_request)])


class Reference(BaseModel):
    path: str = Field(max_length=2048)
    title: str = Field(max_length=250)


class Source(Reference):
    id: int
    fileId: int | None = None
    page: int | None = None


class Image(BaseModel):
    path: str = Field(max_length=2048)
    caption: str = Field(max_length=600)
    articlePath: str = Field(max_length=2048)
    title: str = Field(max_length=250)
    sourceId: int


class Turn(BaseModel):
    question: str = Field(max_length=3000)
    attachmentName: str | None = Field(default=None, max_length=255)
    answer: str = Field(max_length=16000)
    notice: str = Field(default="", max_length=1000)
    sources: list[Source] = Field(default_factory=list, max_length=12)
    images: list[Image] = Field(default_factory=list, max_length=6)


class Chat(BaseModel):
    revision: int = Field(ge=0)
    title: str = Field(min_length=1, max_length=120)
    turns: list[Turn] = Field(max_length=200)
    context: Reference | None = None


def db_path():
    return Path(os.environ.get("KLINEKRAFT_DATA_DIR", str(Path.home() / ".local/share/klinekraft"))) / "conversations.sqlite3"


@contextmanager
def database():
    connection = None
    try:
        path = db_path()
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        if path.is_symlink():
            raise HTTPException(503, "Chat storage cannot be a symbolic link.")
        fd = os.open(path, os.O_CREAT | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
        os.fchmod(fd, 0o600)
        os.close(fd)
        connection = sqlite3.connect(path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("""CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, payload TEXT NOT NULL,
            revision INTEGER NOT NULL, updated TEXT NOT NULL)""")
        with connection:
            yield connection
    except (OSError, sqlite3.Error):
        raise HTTPException(503, "Chat storage is unavailable. Your answer is still on screen; retry saving or export it.")
    finally:
        if connection:
            connection.close()


def decoded(row):
    return {**json.loads(row["payload"]), "id": row["id"], "title": row["title"],
            "revision": row["revision"], "updated": row["updated"]}


@router.get("")
def listing(response: Response, q: str = Query(default="", max_length=200)):
    response.headers["Cache-Control"] = "no-store"
    with database() as db:
        rows = db.execute("SELECT id,title,revision,updated FROM chats WHERE instr(lower(title),lower(?)) > 0 OR instr(lower(payload),lower(?)) > 0 ORDER BY updated DESC LIMIT 200", (q, q)).fetchall()
    return {"chats": [dict(row) for row in rows]}


@router.get("/export")
def export_all():
    with database() as db:
        rows = db.execute("SELECT * FROM chats ORDER BY updated").fetchall()
    return Response(json.dumps({"format": "klinekraft-chats-v1", "chats": [decoded(r) for r in rows]}),
                    media_type="application/json", headers={"Cache-Control": "no-store",
                    "Content-Disposition": 'attachment; filename="klinekraft-chats.json"'})


@router.get("/{chat_id}")
def read(chat_id: UUID, response: Response):
    response.headers["Cache-Control"] = "no-store"
    with database() as db:
        row = db.execute("SELECT * FROM chats WHERE id=?", (str(chat_id),)).fetchone()
    if not row:
        raise HTTPException(404, "Conversation not found.")
    return decoded(row)


@router.put("/{chat_id}")
def save(chat_id: UUID, body: Chat):
    payload = body.model_dump_json()
    if len(payload.encode()) > 4_000_000:
        raise HTTPException(413, "Conversation is too large. Export it and start a new chat.")
    updated = datetime.now(timezone.utc).isoformat()
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT revision FROM chats WHERE id=?", (str(chat_id),)).fetchone()
        if (row and row["revision"] != body.revision) or (not row and body.revision != 0):
            raise HTTPException(409, "This chat changed in another tab or was deleted. Save a separate copy to keep this answer.")
        revision = body.revision + 1
        db.execute("INSERT INTO chats VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,payload=excluded.payload,revision=excluded.revision,updated=excluded.updated",
                   (str(chat_id), body.title.strip() or "Untitled chat", payload, revision, updated))
    return {"id": str(chat_id), "revision": revision, "updated": updated}


@router.delete("/{chat_id}")
def delete(chat_id: UUID, revision: int = Query(ge=1)):
    with database() as db:
        result = db.execute("DELETE FROM chats WHERE id=? AND revision=?", (str(chat_id), revision))
        if result.rowcount != 1:
            raise HTTPException(409, "This chat changed or was already deleted. Refresh the conversation list.")
    return {"deleted": True}
