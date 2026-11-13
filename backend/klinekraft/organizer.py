"""Local notes and calendar events with revision-checked saves."""
import json
from datetime import date
from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from .conversations import database
from .local_content import local_request

router = APIRouter(prefix="/api/organizer", dependencies=[Depends(local_request)])


class Item(BaseModel):
    id: UUID
    kind: Literal["note", "event", "drawing"]
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=4000000)
    day: date | None = None
    time: str = Field(default="", pattern=r"^(|([01][0-9]|2[0-3]):[0-5][0-9])$")
    revision: int = Field(ge=0)
    archived: bool = False

    @model_validator(mode="after")
    def check_day(self):
        if self.kind != "drawing" and len(self.body) > 100000:
            raise ValueError("Text is too long.")
        if self.kind == "drawing" and self.body:
            import base64
            import io
            from PIL import Image
            prefix = "data:image/png;base64,"
            if not self.body.startswith(prefix):
                raise ValueError("Drawings must be PNG images.")
            try:
                raw = base64.b64decode(self.body[len(prefix):], validate=True)
                with Image.open(io.BytesIO(raw)) as image:
                    if image.format != "PNG" or image.width > 1600 or image.height > 1200:
                        raise ValueError("Drawing dimensions exceed the limit.")
                    image.verify()
            except (OSError, ValueError):
                raise ValueError("Invalid drawing.")
        if not self.title.strip():
            raise ValueError("Enter a title.")
        if self.kind == "event" and self.day is None:
            raise ValueError("Choose an event date.")
        return self


def init(connection):
    connection.execute("""CREATE TABLE IF NOT EXISTS organizer (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL
    )""")


@router.get("")
def items(kind: Literal["note", "event", "drawing"]):
    with database() as connection:
        init(connection)
        return [json.loads(row[0]) for row in connection.execute(
            "SELECT payload FROM organizer WHERE kind=? ORDER BY rowid DESC", (kind,))]


@router.put("/{item_id}")
def save(item_id: UUID, item: Item):
    if item_id != item.id:
        raise HTTPException(400, "Item ID does not match.")
    with database() as connection:
        init(connection)
        connection.execute("BEGIN IMMEDIATE")
        old = connection.execute("SELECT revision, kind FROM organizer WHERE id=?", (str(item_id),)).fetchone()
        if (old is None and item.revision != 0) or (old is not None and (old["revision"] != item.revision or old["kind"] != item.kind)):
            raise HTTPException(409, "This item changed elsewhere. Reload the saved version before editing.")
        item.revision += 1
        connection.execute(
            "INSERT INTO organizer VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, revision=excluded.revision",
            (str(item_id), item.kind, item.model_dump_json(), item.revision),
        )
    return item
