"""Local project notebook."""
from fastapi import APIRouter, Depends, Query
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


@router.post("")
def save(entry: Entry):
    entry.project = entry.project.strip()
    with database() as connection:
        init(connection)
        connection.execute("INSERT OR IGNORE INTO notebook (payload) VALUES (?)", (entry.model_dump_json(),))
    return {"saved": True}


@router.get("")
def entries(before: int | None = Query(default=None, ge=1), q: str = Query(default="", max_length=200)):
    with database() as connection:
        init(connection)
        return [
            {"id": row["id"], **Entry.model_validate_json(row["payload"]).model_dump()}
            for row in connection.execute(
                """SELECT id, payload FROM notebook WHERE (? IS NULL OR id < ?)
                AND (instr(lower(json_extract(payload, '$.project')), lower(?)) > 0
                  OR instr(lower(json_extract(payload, '$.note')), lower(?)) > 0
                  OR instr(lower(json_extract(payload, '$.turn.question')), lower(?)) > 0
                  OR instr(lower(json_extract(payload, '$.turn.answer')), lower(?)) > 0)
                ORDER BY id DESC LIMIT 200""", (before, before, q, q, q, q)
            )
        ]
