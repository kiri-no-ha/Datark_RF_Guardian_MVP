import json
from pathlib import Path
from threading import RLock
from copy import deepcopy

LOCK = RLock()
DATABASE = Path(__file__).with_name('data.json')

def default_db():
    return {
        'layouts': [{
            'id': 'mcod-1', 'name': 'МЦОД Екатеринбург', 'plan': '/plan.png',
            'gain': 60, 'donor_dbm': -86, 'feed_loss': 6, 'clutter': 4, 'wifi_eirp_dbm': 17,
            'positions': {
                'cellular': {
                    'two': [{'id': 'C1', 'name': 'Панель 1', 'x': 27, 'y': 60}, {'id': 'C2', 'name': 'Панель 2', 'x': 60, 'y': 60}],
                    'three': [{'id': 'C1', 'name': 'Панель 1', 'x': 27, 'y': 60}, {'id': 'C2', 'name': 'Панель 2', 'x': 60, 'y': 60}, {'id': 'C3', 'name': 'Панель 3', 'x': 37, 'y': 19}],
                },
                'wifi': {
                    'two': [{'id': 'W1', 'name': 'Wi‑Fi AP 1', 'x': 27, 'y': 60}, {'id': 'W2', 'name': 'Wi‑Fi AP 2', 'x': 62, 'y': 60}],
                    'three': [{'id': 'W1', 'name': 'Wi‑Fi AP 1', 'x': 27, 'y': 60}, {'id': 'W2', 'name': 'Wi‑Fi AP 2', 'x': 62, 'y': 60}, {'id': 'W3', 'name': 'Wi‑Fi AP 3', 'x': 43, 'y': 19}],
                },
            },
        }],
        'history': [],
        'config': {'threshold_dbm': -110, 'refresh_s': 5},
    }


def load_db():
    with LOCK:
        if not DATABASE.exists():
            save_db(default_db())
        return json.loads(DATABASE.read_text(encoding='utf-8'))


def save_db(data):
    with LOCK:
        tmp = DATABASE.with_name(DATABASE.name + '.tmp')
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        tmp.replace(DATABASE)


def history(db, layout_id, action, changes=None):
    from time import time
    db['history'].insert(0, {'t': time(), 'layout_id': layout_id, 'action': action, 'changes': changes or []})
    db['history'] = db['history'][:500]
