from klinekraft import research
from klinekraft.conversations import database


def insert(connection, name, text):
    connection.execute("INSERT INTO research_files(collection,name,mime,digest,extracted) VALUES(?,?,?,?,?)",
                       ("Emergency - trained responders", name, "text/plain", name, text))


def test_older_relevant_manual_is_not_hidden_by_recent_files(tmp_path, monkeypatch):
    monkeypatch.setenv("KLINEKRAFT_DATA_DIR", str(tmp_path))
    with database() as connection:
        research.init(connection)
        insert(connection, "water guide", "Boiling water cannot remove radioactive contamination.")
        for n in range(120):
            insert(connection, f"unrelated {n}", "water bottles")
    passages = research.relevant_passages("boiling water radioactive contamination")
    assert passages[0]["title"] == "water guide"


def test_excerpt_contains_matching_passage_late_in_document(tmp_path, monkeypatch):
    monkeypatch.setenv("KLINEKRAFT_DATA_DIR", str(tmp_path))
    with database() as connection:
        research.init(connection)
        insert(connection, "manual", "shelter overview " + "padding " * 400 +
               "fallout shelter decontamination procedure")
    passages = research.relevant_passages("fallout shelter decontamination")
    assert "fallout shelter decontamination procedure" in passages[0]["text"]
    assert "trained responders" in passages[0]["text"]
