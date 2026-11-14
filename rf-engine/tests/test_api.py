import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from coverage import calculate, zone_of
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_health():
    r = client.get('/api/health')
    assert r.status_code == 200
    assert r.json()['mode'] == 'simulation'

def test_layouts():
    r = client.get('/api/layouts')
    assert r.status_code == 200 and r.json()

def test_coverage():
    r = client.get('/api/layouts/mcod-1/coverage?technology=cellular&scenario=two')
    assert r.status_code == 200
    d = r.json()
    assert len(d['antennas']) == 2
    assert len(d['grid']) == d['rows']
    assert len(d['grid'][0]) == d['columns']
    assert 0 <= d['summary']['covered_pct'] <= 100

def test_compare():
    r = client.get('/api/layouts/mcod-1/compare?technology=wifi')
    assert r.status_code == 200
    assert len(r.json()) == 2

def test_reject_outside():
    r = client.put('/api/layouts/mcod-1/positions', json={
        'technology':'cellular','scenario':'two',
        'antennas':[{'id':'C1','name':'x','x':99,'y':99},{'id':'C2','name':'y','x':25,'y':65}]})
    assert r.status_code == 422

def test_reject_excess_gain():
    r = client.put('/api/layouts/mcod-1', json={'gain':999,'donor_dbm':-85,'feed_loss':6,'clutter':4,'wifi_eirp_dbm':17})
    assert r.status_code == 422

def test_preview_is_nonpersistent():
    before = client.get('/api/layouts/mcod-1/coverage').json()['antennas']
    r = client.post('/api/layouts/mcod-1/coverage/preview', json={
        'technology':'cellular','scenario':'two',
        'antennas':[{'id':'C1','name':'Панель 1','x':35,'y':19},{'id':'C2','name':'Панель 2','x':60,'y':60}]})
    assert r.status_code == 200
    after = client.get('/api/layouts/mcod-1/coverage').json()['antennas']
    assert before == after
    assert r.json()['antennas'][0]['x'] == 35
