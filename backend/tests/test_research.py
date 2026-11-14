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


def test_ranked_search_words_pages_and_updates(tmp_path, monkeypatch):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR', str(tmp_path))
    with database() as connection:
        research.init(connection)
        insert(connection,'other','water')
        connection.execute("INSERT INTO research_files(collection,name,mime,digest,extracted) VALUES(?,?,?,?,?)", ('Field','Water manual','application/pdf','pdf','Introduction\fBoiling drinking water guidance'))
    result = research.search('drinking water','')
    assert result['files'][0]['name'] == 'Water manual'
    assert result['files'][0]['page'] == 2
    assert 'Boiling' in result['files'][0]['snippet']
    with database() as connection:
        connection.execute("UPDATE research_files SET extracted='Replacement content' WHERE name='Water manual'")
    assert not research.search('boiling','')['files']
    with database() as connection:
        connection.execute("DELETE FROM research_files WHERE name='Water manual'")
    assert not research.search('replacement','')['files']


def test_search_syntax_is_plain_text(tmp_path, monkeypatch):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR', str(tmp_path))
    assert research.search('" OR (NOT *)','')['files'] == []
