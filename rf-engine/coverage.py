"""Preliminary indoor propagation model. Illustrative, NOT an RF site survey."""
from __future__ import annotations
import math

# Coordinates are percentages of the complete original plan.png image (1724 x 1017).
# Geometric estimates traced by eye; physical dimensions 14 x 9 m from drawing.
IMAGE_SIZE = (1724, 1017)
BUILDING = (7.5, 6.0, 77.5, 92.5)
AREAS = [
    dict(id='hall', name='Аппаратный зал', area=84.8, rect=(8.2, 36.1, 76.3, 90.2)),
    dict(id='power', name='Энергомодуль', area=29.8, rect=(8.2, 7.5, 58.0, 33.1)),
    dict(id='vestibule', name='Тех. тамбур', area=10.1, rect=(58.7, 7.5, 76.3, 33.1)),
]
# Approximate dividing walls and two rack rows; rectangles in percent of full plan.
WALLS = [((8, 35.2), (76.5, 35.2)), ((58.4, 7.2), (58.4, 33.5))]
RACK_ROWS = [(11.7, 44.5, 69.0, 54.5), (11.7, 68.0, 69.0, 79.4)]
THRESHOLDS = {
    'cellular': {'good': -82, 'ok': -98, 'frequency_mhz': 2600, 'label': 'Условный уровень LTE/DAS'},
    'wifi': {'good': -67, 'ok': -80, 'frequency_mhz': 2400, 'label': 'Оценка Wi‑Fi 2.4 ГГц'},
}


def zone_of(x, y):
    for area in AREAS:
        x1, y1, x2, y2 = area['rect']
        if x1 <= x <= x2 and y1 <= y <= y2:
            return area['id']
    return None


def intersects(a, b, c, d):
    """Inclusive segment intersection; fine for coarse attenuation model."""
    def cross(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    v1, v2, v3, v4 = cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b)
    return ((v1 <= 0 <= v2 or v2 <= 0 <= v1) and
            (v3 <= 0 <= v4 or v4 <= 0 <= v3))


def crosses_box(a, b, box):
    x1, y1, x2, y2 = box
    edges = [((x1, y1), (x2, y1)), ((x2, y1), (x2, y2)),
             ((x2, y2), (x1, y2)), ((x1, y2), (x1, y1))]
    return any(intersects(a, b, p, q) for p, q in edges)


def level_at(x, y, antennas, settings, technology):
    if not antennas:
        return -130.0
    settings = settings or {}
    freq = THRESHOLDS[technology]['frequency_mhz']
    wall_db = 17 if technology == 'wifi' else 10
    rack_db = 9 if technology == 'wifi' else 4
    # 14 x 9 m for physical scale within building bounds.
    mx_per_pct = 14 / (BUILDING[2] - BUILDING[0])
    my_per_pct = 9 / (BUILDING[3] - BUILDING[1])
    # dBm/antenna: illustrative link budget; not an LTE RSRP estimate.
    if technology == 'cellular':
        eirp = float(settings.get('donor_dbm', -86)) + 9 - float(settings.get('feed_loss', 6)) + float(settings.get('gain', 60)) + 5 - 10 * math.log10(max(len(antennas), 1))
        exponent = 2.25
    else:
        eirp = float(settings.get('wifi_eirp_dbm', 17))
        exponent = 3.15
    powers = []
    for antenna in antennas:
        ax, ay = float(antenna['x']), float(antenna['y'])
        distance = max(1, math.hypot((x-ax)*mx_per_pct, (y-ay)*my_per_pct))
        fspl_one_m = 32.44 + 20*math.log10(freq) - 60  # distance = 0.001 km
        loss = fspl_one_m + 10*exponent*math.log10(distance)
        a, b = (ax, ay), (x, y)
        loss += sum(wall_db for p, q in WALLS if intersects(a, b, p, q))
        loss += sum(rack_db for box in RACK_ROWS if crosses_box(a, b, box))
        # Treat cable clutter as attenuation on cellular feeder path only.
        if technology == 'cellular':
            loss += float(settings.get('clutter', 4))
        else:
            # Additional assumption for dense metal equipment and multipath.
            loss += 7
        powers.append(eirp - loss)
    # Cellular antenna feeds are not independent transmitters. To keep the
    # MVP conservative and avoid artificial combining gain, use strongest feed.
    # Wi-Fi APs normally choose strongest serving AP as well.
    return round(max(powers), 1)


def calculate(antennas, settings, technology='cellular', width=84, height=51):
    if technology not in THRESHOLDS:
        raise ValueError('Unsupported technology')
    thresholds = THRESHOLDS[technology]
    grid = []
    samples = {area['id']: [] for area in AREAS}
    good = ok = weak = total = 0
    for j in range(height):
        row = []
        y = 100*(j + 0.5)/height
        for i in range(width):
            x = 100*(i+0.5)/width
            area_id = zone_of(x, y)
            if not area_id:
                row.append(None)
                continue
            level = level_at(x, y, antennas, settings, technology)
            row.append(level)
            samples[area_id].append(level)
            total += 1
            if level >= thresholds['good']:
                good += 1
            elif level >= thresholds['ok']:
                ok += 1
            else:
                weak += 1
        grid.append(row)
    def pct(x, n): return round(100 * x / n, 1) if n else 0
    areas = []
    for area in AREAS:
        vals = samples[area['id']]
        areas.append({
            'id': area['id'], 'name': area['name'], 'area_m2': area['area'],
            'avg_dbm': round(sum(vals)/len(vals), 1) if vals else None,
            'min_dbm': min(vals) if vals else None,
            'good_pct': pct(sum(v >= thresholds['good'] for v in vals), len(vals)),
            'covered_pct': pct(sum(v >= thresholds['ok'] for v in vals), len(vals)),
        })
    return {
        'technology': technology,
        'model': 'illustrative_indoor_v1',
        'source': 'simulation',
        'description': thresholds['label'],
        'unit': 'dBm (модель)',
        'thresholds': {'good': thresholds['good'], 'ok': thresholds['ok']},
        'grid': grid, 'columns': width, 'rows': height,
        'antennas': antennas, 'areas': areas,
        'summary': {'good_pct': pct(good, total), 'covered_pct': pct(good+ok, total),
                    'weak_pct': pct(weak, total), 'sampled_cells': total},
    }
