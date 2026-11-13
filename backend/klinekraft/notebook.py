"""Local project notebook."""
import hashlib
import sqlite3
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field

from .conversations import Turn, database
from .local_content import local_request

router = APIRouter(prefix="/api/notebook", dependencies=[Depends(local_request)])


class Entry(BaseModel):
    project: str = Field(min_length=1, max_length=80, pattern=r"\S")
    note: str = Field(default="", max_length=4000)
    turn: Turn


def init(connection):
    connection.execute("CREATE TABLE IF NOT EXISTS notebook (id INTEGER PRIMARY KEY, payload TEXT NOT NULL UNIQUE)")

    connection.execute("CREATE TABLE IF NOT EXISTS notebook_trash (id INTEGER PRIMARY KEY REFERENCES notebook(id))")


@router.post("")
def save(entry: Entry):
    entry.project = entry.project.strip()
    with database() as connection:
        init(connection)
        connection.execute("INSERT OR IGNORE INTO notebook (payload) VALUES (?)", (entry.model_dump_json(),))
    return {"saved": True}


@router.get("")
def entries(before: int | None = Query(default=None, ge=1), q: str = Query(default="", max_length=200), trash: bool = False):
    with database() as connection:
        init(connection)
        return [
            {"id": row["id"], "revision": hashlib.sha256(row["payload"].encode()).hexdigest(), **Entry.model_validate_json(row["payload"]).model_dump()}
            for row in connection.execute(
                """SELECT id, payload FROM notebook WHERE (? IS NULL OR id < ?) AND (id IN (SELECT id FROM notebook_trash)) = ?
                AND (instr(lower(json_extract(payload, '$.project')), lower(?)) > 0
                  OR instr(lower(json_extract(payload, '$.note')), lower(?)) > 0
                  OR instr(lower(json_extract(payload, '$.turn.question')), lower(?)) > 0
                  OR instr(lower(json_extract(payload, '$.turn.answer')), lower(?)) > 0)
                ORDER BY id DESC LIMIT 200""", (before, before, trash, q, q, q, q)
            )
        ]



class Edit(BaseModel):
    revision: str = Field(pattern=r"^[a-f0-9]{64}$")
    project: str = Field(min_length=1, max_length=80, pattern=r"\S")
    note: str = Field(max_length=4000)


@router.put("/{entry_id}")
def edit(entry_id: int, body: Edit):
    with database() as connection:
        init(connection)
        row = connection.execute("SELECT payload FROM notebook WHERE id=?", (entry_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Notebook entry not found.")
        if hashlib.sha256(row["payload"].encode()).hexdigest() != body.revision:
            raise HTTPException(409, "This entry changed in another tab. Reload before editing.")
        entry = Entry.model_validate_json(row["payload"])
        entry.project, entry.note = body.project.strip(), body.note
        payload = entry.model_dump_json()
        try:
            changed = connection.execute("UPDATE notebook SET payload=? WHERE id=? AND payload=?",
                                         (payload, entry_id, row["payload"])).rowcount
        except sqlite3.IntegrityError:
            raise HTTPException(409, "An identical notebook entry already exists.")
        if not changed:
            raise HTTPException(409, "This entry changed in another tab. Reload before editing.")
    return {"id": entry_id, "revision": hashlib.sha256(payload.encode()).hexdigest(), **entry.model_dump()}


@router.post("/{entry_id}/trash")
def move(entry_id: int, trash: bool = True):
    with database() as connection:
        init(connection)
        if connection.execute("SELECT 1 FROM notebook WHERE id=?", (entry_id,)).fetchone() is None:
            raise HTTPException(404, "Notebook entry not found.")
        if trash:
            connection.execute("INSERT OR IGNORE INTO notebook_trash(id) VALUES (?)", (entry_id,))
        else:
            connection.execute("DELETE FROM notebook_trash WHERE id=?", (entry_id,))
    return {"trashed": trash}
