"""Datark RF Guardian hackathon API. All RF coverage readings are simulated."""
import math
import time
from uuid import uuid4
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi.responses import PlainTextResponse
from analysis import analyze, render_txt_report
from coverage import calculate, zone_of
from storage import load_db, save_db, history

app = FastAPI(title='Datark RF Guardian', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173','http://127.0.0.1:5173'], allow_methods=['GET','POST','PUT'], allow_headers=['*'])

class Position(BaseModel):
    id: str
    name: str
    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)

class SavePositions(BaseModel):
    technology: str
    scenario: str
    antennas: list[Position]

class Settings(BaseModel):
    gain: float = Field(ge=0, le=65)
    donor_dbm: float = Field(ge=-120, le=-40)
    feed_loss: float = Field(ge=0, le=40)
    clutter: float = Field(ge=0, le=25)
    wifi_eirp_dbm: float = Field(ge=-10, le=25)

class CreateLayout(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    copy_from: str = 'mcod-1'

class Config(BaseModel):
    threshold_dbm: int = Field(ge=-125, le=-40)
    refresh_s: int = Field(ge=1, le=120)


def get_layout(db, lid):
    item = next((x for x in db['layouts'] if x['id'] == lid), None)
    if item is None:
        raise HTTPException(404, 'Макет не найден')
    return item


def check_scenario(technology, scenario):
    if technology not in ('cellular', 'wifi') or scenario not in ('two', 'three', 'custom'):
        raise HTTPException(422, 'Технология: cellular/wifi; вариант: two/three/custom')

def check_count(scenario, count):
    expected = {'two': 2, 'three': 3}
    if scenario in expected and count != expected[scenario]:
        raise HTTPException(422, 'Неверное число антенн для сценария')
    if scenario == 'custom' and not 1 <= count <= 12:
        raise HTTPException(422, 'Для custom допустимо от 1 до 12 точек')

@app.get('/api/health')
def health():
    return {'status': 'ok', 'mode': 'simulation', 'sms_line': 'unmonitored'}

@app.get('/api/layouts')
def layouts():
    return [{ 'id': x['id'], 'name': x['name']} for x in load_db()['layouts']]

@app.get('/api/layouts/{lid}')
def layout(lid: str):
    return get_layout(load_db(), lid)

@app.post('/api/layouts')
def create_layout(body: CreateLayout):
    from copy import deepcopy
    db = load_db()
    item = deepcopy(get_layout(db, body.copy_from))
    item['id'] = uuid4().hex[:8]
    item['name'] = body.name.strip()
    db['layouts'].append(item)
    history(db, item['id'], f'Создан макет «{item["name"]}»')
    save_db(db)
    return item

@app.put('/api/layouts/{lid}')
def update_layout(lid: str, body: Settings):
    db = load_db()
    item = get_layout(db, lid)
    changes = []
    for k, v in body.model_dump().items():
        if item.get(k) != v:
            changes.append({'field': k, 'old': item.get(k), 'new': v})
            item[k] = v
    if changes:
        history(db, lid, 'Изменены параметры модели', changes)
        save_db(db)
    return item

@app.put('/api/layouts/{lid}/positions')
def put_positions(lid: str, body: SavePositions):
    check_scenario(body.technology, body.scenario)
    check_count(body.scenario, len(body.antennas))
    if len(set(a.id for a in body.antennas)) != len(body.antennas):
        raise HTTPException(422, 'Повторяющиеся ID антенн')
    for a in body.antennas:
        if zone_of(a.x, a.y) is None:
            raise HTTPException(422, f'{a.name} расположена вне моделируемых помещений')
    db = load_db()
    item = get_layout(db, lid)
    item['positions'][body.technology][body.scenario] = [a.model_dump() for a in body.antennas]
    history(db, lid, f'Сохранено размещение: {body.technology}/{body.scenario}')
    save_db(db)
    return {'saved': True, 'antennas': item['positions'][body.technology][body.scenario]}

@app.get('/api/layouts/{lid}/coverage')
def coverage(lid: str, technology: str = 'cellular', scenario: str = 'two'):
    check_scenario(technology, scenario)
    item = get_layout(load_db(), lid)
    antennas = item['positions'][technology].get(scenario)
    if antennas is None:
        raise HTTPException(404, 'Сначала сохраните произвольный сценарий')
    result = calculate(antennas, item, technology)
    result['scenario'] = scenario
    result['plan'] = item['plan']
    return result

@app.post('/api/layouts/{lid}/coverage/preview')
def coverage_preview(lid: str, body: SavePositions):
    check_scenario(body.technology, body.scenario)
    check_count(body.scenario, len(body.antennas))
    if any(zone_of(a.x, a.y) is None for a in body.antennas):
        raise HTTPException(422, 'Антенна за пределами моделируемых помещений')
    item = get_layout(load_db(), lid)
    result = calculate([a.model_dump() for a in body.antennas], item, body.technology)
    result['scenario'] = body.scenario
    result['plan'] = item['plan']
    return result

@app.get('/api/layouts/{lid}/compare')
def compare(lid: str, technology: str = 'cellular'):
    if technology not in ('cellular', 'wifi'):
        raise HTTPException(422, 'Unsupported technology')
    item = get_layout(load_db(), lid)
    results = []
    for scenario in ('two', 'three', 'custom'):
        if scenario not in item['positions'][technology]:
            continue
        # grid geometry is identical, so the percentages are directly comparable
        v = calculate(item['positions'][technology][scenario], item, technology)
        results.append({'scenario': scenario, 'antennas': len(v['antennas']), 'summary': v['summary']})
    return results

@app.get('/api/layouts/{lid}/telemetry')
def telemetry(lid: str):
    item = get_layout(load_db(), lid)
    t = time.time()
    return {
        'source': 'simulator', 't': t,
        'rsrp': round(-90 + 3*math.sin(t/22), 1),
        'rssi': round(-70 + 4*math.cos(t/25), 1),
        'sinr': round(12 + 3*math.sin(t/37), 1),
        'gain': item['gain'],
        'sms': {'status': 'unmonitored', 'independent': True, 'description': 'Существующий GSM-модем не подключён к мониторингу'},
        'wifi': {'status': 'design', 'description': 'Wi‑Fi AP / VoWiFi — проектный вариант; оператор/телефон должны поддерживать услугу'},
    }

@app.get('/api/layouts/{lid}/series')
def series(lid: str, metric: str = 'rsrp', minutes: int = Query(60, ge=1, le=1440), step: int = Query(60, ge=1, le=1800)):
    get_layout(load_db(), lid)
    params = {'rsrp': (-90, 5), 'rssi': (-70, 6), 'sinr': (12, 4)}
    if metric not in params:
        raise HTTPException(422, 'Invalid metric')
    t = time.time()
    base, amp = params[metric]
    count = min(150, int(minutes*60/step)+1)
    return [{'t': round(t - (count-1-i)*step), 'v': round(base + amp*math.sin((t-(count-1-i)*step)/210 + len(lid)), 1)} for i in range(count)]

@app.get('/api/history')
def get_history(layout: str | None = None, limit: int = Query(100, ge=1, le=500)):
    events = load_db()['history']
    if layout:
        events = [event for event in events if event.get('layout_id') == layout]
    return events[:limit]

@app.get('/api/config')
def get_config():
    return load_db()['config']

@app.put('/api/config')
def set_config(body: Config):
    db = load_db()
    db['config'] = body.model_dump()
    history(db, '', 'Обновлена конфигурация мониторинга')
    save_db(db)
    return db['config']


@app.get('/api/layouts/{lid}/analysis')
def analysis(lid: str, technology: str = 'cellular', scenario: str = 'two'):
    check_scenario(technology, scenario)
    item = get_layout(load_db(), lid)
    if scenario not in item['positions'][technology]:
        raise HTTPException(404, 'Сначала сохраните пользовательский сценарий')
    return analyze(item, technology, scenario)


@app.get('/api/layouts/{lid}/report', response_class=PlainTextResponse)
def report(lid: str, technology: str = 'cellular', scenario: str = 'two'):
    check_scenario(technology, scenario)
    item = get_layout(load_db(), lid)
    if scenario not in item['positions'][technology]:
        raise HTTPException(404, 'Сначала сохраните пользовательский сценарий')
    data = analyze(item, technology, scenario)
    return PlainTextResponse(
        content='\ufeff' + render_txt_report(data),
        media_type='text/plain; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="datark-report-{lid}.txt"'},
    )
