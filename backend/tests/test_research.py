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


def test_historical_guides_are_opt_in_for_ai_but_visible_in_library(tmp_path, monkeypatch):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR', str(tmp_path))
    with database() as c:
        research.init(c)
        insert(c,'Current water guide','Water storage guidance')
        c.execute("INSERT INTO research_files(collection,name,mime,digest,extracted) VALUES(?,?,?,?,?)", ('Historical - Cold War civil defense','HISTORICAL 1961 water','text/plain','old','Water storage dated claims'))
    assert all('HISTORICAL' not in row['title'] for row in research.relevant_passages('water storage'))
    assert any('HISTORICAL' in row['title'] for row in research.relevant_passages('historical 1961 water'))
    assert any('HISTORICAL' in row['name'] for row in research.search('water','')['files'])


def test_conversational_words_do_not_outweigh_drinking_water(tmp_path, monkeypatch):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR', str(tmp_path))
    with database() as c:
        research.init(c)
        insert(c, 'Dental manual', 'What should I do? My current teeth are safe during an emergency. Say what to do.')
        insert(c, 'Drinking water safety', 'Making drinking water safe: boil clear water for one minute.')
    question='What do my current saved references say about making drinking water safe during an emergency?'
    assert research.relevant_passages(question)[0]['title']=='Drinking water safety'
