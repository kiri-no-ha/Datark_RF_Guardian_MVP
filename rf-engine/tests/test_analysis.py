import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_analysis_in_both_technologies():
    for mode in ('cellular', 'wifi'):
        response = client.get('/api/layouts/mcod-1/analysis', params={'technology': mode, 'scenario': 'two'})
        assert response.status_code == 200
        data = response.json()
        assert len(data['areas']) == 3
        assert data['source'] == 'simulation'
        assert data['sms']['status'] == 'не проверено'


def test_report_txt_utf8_and_object():
    response = client.get('/api/layouts/mcod-1/report')
    assert response.status_code == 200
    assert response.content.startswith(b'\xef\xbb\xbf')
    assert 'Аппаратный зал' in response.text
    assert 'ЭМС' in response.text
    assert 'DATARK' in response.text


def test_unsaved_custom_and_bad_site():
    assert client.get('/api/layouts/mcod-1/report?scenario=custom').status_code in (200, 404)
    assert client.get('/api/layouts/not-exists/analysis').status_code == 404
