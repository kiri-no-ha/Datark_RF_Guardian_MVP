"""Engineering summaries for the Datark RF Guardian simulation.

These are illustrative planning aids, NOT real EMI certification or verified RF measurements.
"""
from datetime import datetime, timezone
import math

from coverage import calculate, THRESHOLDS

ROOMS_TOTAL_M2 = 124.7
MODE_NAMES = {'cellular': 'LTE / DAS (один репитер, распределённые панели)',
              'wifi': 'Wi-Fi / VoWiFi (точки доступа)'}
SCENARIO_NAMES = {'two': '2 точки', 'three': '3 точки', 'custom': 'Пользовательский'}


def analyze(layout, technology, scenario):
    antennas = layout['positions'][technology][scenario]
    coverage = calculate(antennas, layout, technology)
    summary = coverage['summary']
    areas = coverage['areas']
    weak_areas = [a for a in areas if a['covered_pct'] < 90]
    warnings = []
    advice = []

    if weak_areas:
        names = ', '.join(a['name'] for a in weak_areas)
        warnings.append({'level': 'warning', 'title': 'Зоны недостаточного покрытия',
                         'text': f'В модели менее 90% расчётной сетки покрыто в зонах: {names}.'})
        advice.append('Проверить расположение точек возле слабых зон и повторить моделирование.')
    else:
        advice.append('Проверить карту натурными замерами: расчётный процент не равен гарантированному покрытию.')

    if technology == 'cellular':
        n = len(antennas)
        gain = float(layout['gain'])
        donor = float(layout['donor_dbm'])
        feeder = float(layout['feed_loss'])
        # This follows the same illustrative parameters as coverage.py.
        branch_eirp = donor + 9 - feeder + gain + 5 - 10 * math.log10(n)
        budget = [
            {'name': 'Донорный сигнал (входное допущение)', 'value': donor, 'unit': 'dBm'},
            {'name': 'Усиление донорной антенны (допущение)', 'value': 9, 'unit': 'dBi'},
            {'name': 'Потери кабельного тракта (ввод)', 'value': feeder, 'unit': 'dB'},
            {'name': 'Усиление репитера (модель)', 'value': gain, 'unit': 'dB'},
            {'name': 'Усиление внутренней антенны (допущение)', 'value': 5, 'unit': 'dBi'},
            {'name': 'Равномерное деление между панелями', 'value': round(10 * math.log10(n), 2), 'unit': 'dB'},
            {'name': 'Модельный EIRP на ветвь', 'value': round(branch_eirp, 1), 'unit': 'dBm'},
        ]
        warnings.extend([
            {'level': 'unknown', 'title': 'Совместимость с GSM/SMS не подтверждена',
             'text': 'Существующий GSM-тракт проектно независим, но развязка и работоспособность SMS при включённой системе не измерены.'},
            {'level': 'unknown', 'title': 'PIM / IMD и фильтрация не испытаны',
             'text': 'Номинальная модельная частота 2600 МГц не попадает в полосы GSM 900/1800, но внеполосное излучение и интермодуляция не оценены измерениями.'},
            {'level': 'unknown', 'title': 'Устойчивость репитера не проверена',
             'text': 'Нет данных об измеренной развязке донорной и внутренних антенн, выходной мощности, UL/DL и параметрах AGC/ALC.'},
        ])
        if gain >= 60:
            warnings.append({'level': 'warning', 'title': 'Высокое заданное усиление',
                             'text': 'Без измеренной изоляции нельзя утверждать, что репитер устойчив при выбранном усилении.'})
        if n > 3:
            warnings.append({'level': 'info', 'title': 'Много внутренних панелей',
                             'text': 'Понадобится уточнить число выходов, делители, дополнительные потери, развязку и мощность в ветвях.'})
        advice.extend([
            'Измерить базовый уровень сигнала оператора снаружи и внутри МЦОД.',
            'Выбрать направленную донорную антенну по реальным частотам и направлению БС.',
            'Подобрать сертифицированный репитер, полосовые фильтры, дуплексер и низко-PIM компоненты по фактическим диапазонам.',
            'Измерить развязку, спектр, PIM/IMD, качество DL/UL и выполнить тестовую отправку аварийных SMS до/после монтажа.',
        ])
    else:
        budget = [{'name': 'EIRP точки доступа (допущение)', 'value': layout['wifi_eirp_dbm'], 'unit': 'dBm'},
                  {'name': 'Частота расчётной модели', 'value': 2400, 'unit': 'МГц'}]
        warnings.append({'level': 'unknown', 'title': 'VoWiFi и SMS через Wi-Fi не гарантированы',
                         'text': 'Зависят от оператора, телефонов, доступа в интернет и настроек VoWiFi.'})
        warnings.append({'level': 'unknown', 'title': 'ЭМС не испытана',
                         'text': 'Хотя используется иной радиодиапазон, физические помехи не исключены без проверки.'})
        advice.extend([
            'Выбрать точку доступа и спланировать питание PoE, LAN и резервирование интернет-канала.',
            'Проверить поддержку Wi-Fi Calling у используемых операторов и телефонов.',
            'Не изменять существующую GSM/SMS-линию.',
        ])

    return {
        'object': {'id': layout['id'], 'name': layout['name'], 'plan': layout.get('plan', '/plan.png'),
                   'total_area_m2': ROOMS_TOTAL_M2},
        'technology': technology, 'technology_name': MODE_NAMES[technology],
        'scenario': scenario, 'scenario_name': SCENARIO_NAMES[scenario],
        'model': coverage['model'], 'source': 'simulation',
        'frequency_mhz': THRESHOLDS[technology]['frequency_mhz'],
        'thresholds': coverage['thresholds'], 'summary': summary, 'areas': areas,
        'antennas': antennas, 'budget': budget,
        'warnings': warnings, 'recommendations': advice,
        'sms': {'status': 'не проверено', 'architecture': 'отдельный неизменяемый GSM-тракт'},
        'readiness': 'Проектный расчёт; допуск к эксплуатации и ЭМС не подтверждены',
    }


def render_txt_report(report):
    obj = report['object']
    fmt = lambda v: '—' if v is None else f'{v:.1f}' if isinstance(v, (float, int)) else str(v)
    lines = [
        'DATARK RF GUARDIAN — ИНЖЕНЕРНЫЙ ОТЧЁТ (МОДЕЛЬ)',
        '=' * 64,
        f'Дата формирования: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}',
        f'Объект: {obj["name"]}',
        f'ID объекта: {obj["id"]}',
        f'Площадь объекта: {fmt(obj["total_area_m2"])} м²',
        f'Основа планировки: {obj["plan"]}',
        '', '1. ВЫБРАННАЯ КОНФИГУРАЦИЯ',
        '-' * 64,
        f'Технология: {report["technology_name"]}',
        f'Сценарий: {report["scenario_name"]}',
        f'Количество внутренних точек: {len(report["antennas"])}',
        f'Модельная частота: {report["frequency_mhz"]} МГц',
        f'Расчётный порог приемлемого сигнала: {report["thresholds"]["ok"]} dBm',
        '', '2. РЕЗУЛЬТАТ РАСЧЁТА ПОКРЫТИЯ',
        '-' * 64,
        f'Покрытие выше порога: {fmt(report["summary"]["covered_pct"])} %',
        f'Хорошее покрытие: {fmt(report["summary"]["good_pct"])} %',
        f'Слабое покрытие: {fmt(report["summary"]["weak_pct"])} %',
        f'Точек расчётной сетки: {report["summary"]["sampled_cells"]}',
        'Помещения:',
    ]
    for a in report['areas']:
        lines.append(f'  • {a["name"]} ({fmt(a["area_m2"])} м²): '
                     f'средний {fmt(a["avg_dbm"])} dBm; минимум {fmt(a["min_dbm"])} dBm; '
                     f'выше порога {fmt(a["covered_pct"])} %')
    lines.extend(['', '3. РАСПОЛОЖЕНИЕ ВНУТРЕННИХ ТОЧЕК', '-' * 64,
                  'Позиции заданы в процентах от размера исходной PNG-подложки.'])
    for a in report['antennas']:
        lines.append(f'  • {a["id"]} — {a["name"]}: x={fmt(a["x"])}%, y={fmt(a["y"])}%')
    lines.extend(['', '4. ПАРАМЕТРЫ УПРОЩЁННОЙ МОДЕЛИ', '-' * 64])
    for p in report['budget']:
        lines.append(f'  • {p["name"]}: {fmt(p["value"])} {p["unit"]}')
    lines.extend(['', '5. АППАРАТНАЯ КОНЦЕПЦИЯ', '-' * 64,
                  'Внешняя направленная донорная антенна -> частотная селекция / защита ->',
                  'сертифицированный репитер с AGC/ALC и диагностикой -> делитель/ответвитель ->',
                  'внутренние панельные антенны DAS; требуется поддержка DL и UL.',
                  'Wi-Fi: ЛВС / интернет -> PoE-коммутатор -> точки доступа -> устройства.',
                  'Критический независимый тракт: действующая GSM-антенна -> GSM-модем -> SMS.',
                  'Действующую GSM-антенну и настройки GSM-модема не менять.',
                  'Условия к подбору: реальные частотные диапазоны, усиление, выходная мощность,',
                  'потери кабелей/делителей, PIM и линейность, развязка, наличие документации.',
                  'Конкретная модель оборудования не выбрана; совместимость не подтверждена.',
                  '', '6. ПРЕДУПРЕЖДЕНИЯ И НЕОБХОДИМЫЕ ПРОВЕРКИ', '-' * 64])
    for w in report['warnings']:
        lines.append(f'  • [{w["level"]}] {w["title"]}: {w["text"]}')
    lines.extend(['', '7. РЕКОМЕНДАЦИИ', '-' * 64])
    for i, rec in enumerate(report['recommendations'], 1):
        lines.append(f'  {i}. {rec}')
    lines.extend(['', '8. ОГРАНИЧЕНИЯ / СТАТУС ДОКАЗАТЕЛЬНОСТИ', '-' * 64,
                  'Это предварительная цифровая модель по PNG-планировке 14 × 9 м.',
                  'Проценты покрытия и уровни dBm не основаны на натурных измерениях.',
                  'В модели нет полноценного расчёта uplink/downlink и шума приёмника.',
                  'Реальные материалы стен, RF-изоляция, характеристики фильтров, PIM/IMD',
                  'и устойчивость усилителя не подтверждены.',
                  'Доставляемость SMS и работоспособность Wi-Fi Calling не проверены.',
                  'Документ НЕ является заключением ЭМС или разрешением на ввод в эксплуатацию.',
                  '', f'СТАТУС: {report["readiness"]}', ''])
    return '\n'.join(lines)
