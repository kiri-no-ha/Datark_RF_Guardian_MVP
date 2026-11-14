import {useEffect} from 'react'
import {Antenna, AlertTriangle, BarChart3, CircleHelp, Radio, ShieldAlert, ShieldCheck, Wifi} from 'lucide-react'
import {usePoll} from './api'

const round = (value, suffix = '') => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}${suffix}` : '—'

function Kpi({title, value, detail}) {
  return <div className="analysis-kpi"><span>{title}</span><strong>{value}</strong><small>{detail}</small></div>
}

export default function Analysis({lid, layout, mode, setMode}) {
  const technology = mode.technology
  const scenario = mode.scenario
  const saved = Boolean(layout?.positions?.[technology]?.[scenario])
  const query = saved && lid ? `/layouts/${lid}/analysis?technology=${technology}&scenario=${scenario}` : null
  const [data, error] = usePoll(query, 30000)
  // No report/analysis for an unsaved custom scenario: never silently substitute other positions.
  useEffect(() => { if (!layout?.positions?.[technology]?.[scenario] && scenario !== 'custom') setMode({technology, scenario: 'two'}) }, [layout, technology, scenario, setMode])

  return <div className="analysis-page">
    <div className="heading"><div><h2>Инженерный анализ</h2><p>Покрытие, расчётные параметры и риски электромагнитной совместимости</p></div><span className="pill info">Только моделирование</span></div>

    <div className="analysis-toolbar panel">
      <div><label>Технология</label><div className="segmented">
        <button className={technology === 'cellular' ? 'active' : ''} onClick={() => setMode({technology: 'cellular', scenario: 'two'})}><Antenna size={15}/> LTE / DAS</button>
        <button className={technology === 'wifi' ? 'active' : ''} onClick={() => setMode({technology: 'wifi', scenario: 'two'})}><Wifi size={15}/> Wi-Fi</button>
      </div></div>
      <div><label>Сохранённый сценарий</label><select value={scenario} onChange={e => setMode({technology, scenario: e.target.value})}>
        <option value="two">2 точки</option><option value="three">3 точки</option>
        {layout?.positions?.[technology]?.custom && <option value="custom">Свои точки ({layout.positions[technology].custom.length})</option>}
      </select></div>
      <div className="analysis-toolbar-note"><CircleHelp size={16}/> Для отчёта используются только сохранённые положения точек. Изменения на карте сначала сохрани.</div>
    </div>

    {!saved && <div className="notice bad"><AlertTriangle size={17}/> Этот сценарий ещё не сохранён на сервере. Вернись на карту и нажми «Сохранить позиции».</div>}
    {error && <div className="notice bad">Ошибка анализа: {error}</div>}
    {!data || !saved ? <div className="panel"><div className="empty">{saved ? 'Рассчитываем зоны…' : 'Нет сохранённой конфигурации'}</div></div> : <>
      <div className="analysis-kpis">
        <Kpi title="Покрытие выше порога" value={round(data.summary.covered_pct, '%')} detail={`≥ ${data.thresholds.ok} dBm · модель`}/>
        <Kpi title="Хороший сигнал" value={round(data.summary.good_pct, '%')} detail={`≥ ${data.thresholds.good} dBm`}/>
        <Kpi title="Слабая зона" value={round(data.summary.weak_pct, '%')} detail={`Ниже ${data.thresholds.ok} dBm`}/>
        <Kpi title="Внутренние точки" value={String(data.antennas.length)} detail={technology === 'cellular' ? 'Панельные DAS-антенны' : 'Wi-Fi точки доступа'}/>
      </div>

      <div className="analysis-columns">
        <section className="panel">
          <div className="panel-title"><h3><BarChart3 size={17}/> Покрытие по помещениям</h3><span className="muted xs">Доля расчётной сетки</span></div>
          <div className="analysis-bars">
            {data.areas.map(area => <div key={area.id} className="analysis-bar-row">
              <div className="analysis-bar-heading"><b>{area.name}</b><span>{round(area.covered_pct, '%')}</span></div>
              <div className="analysis-bar-bg"><div style={{width: `${area.covered_pct}%`, background: area.covered_pct < 70 ? '#df6175' : area.covered_pct < 90 ? '#e7ac51' : '#2ab993'}}/></div>
              <small>Средний уровень {round(area.avg_dbm, ' dBm')} · минимум {round(area.min_dbm, ' dBm')} · {round(area.area_m2, ' м²')}</small>
            </div>)}
          </div>
          <div className="analysis-note">Порог и цвет относятся к упрощённой модели. Это не измеренные RSRP и не гарантированный уровень связи на месте установки.</div>
        </section>
        <section className="panel">
          <div className="panel-title"><h3><Radio size={17}/> Расчётный тракт</h3><span className="pill info">{data.frequency_mhz} МГц</span></div>
          <table className="analysis-table"><tbody>{data.budget.map(row => <tr key={row.name}><td>{row.name}</td><td><b>{round(row.value)} {row.unit}</b></td></tr>)}</tbody></table>
          <div className="analysis-note">Это расчётная оценка по принятым параметрам. Uplink, шумовой коэффициент, реальная развязка и S-параметры фильтров не учтены.</div>
        </section>
      </div>

      <div className="analysis-columns analysis-safety-row">
        <section className="panel">
          <div className="panel-title"><h3><ShieldAlert size={17}/> Предупреждения и ЭМС</h3><span className="pill warn">Требует проверки</span></div>
          {data.warnings.map((w, index) => <div className={`analysis-alert ${w.level}`} key={`${index}-${w.title}`}>
            <div className="analysis-alert-icon">{w.level === 'warning' ? <AlertTriangle size={18}/> : <CircleHelp size={18}/>}</div>
            <div><b>{w.title}</b><p>{w.text}</p></div>
          </div>)}
          <div className="analysis-sms"><ShieldCheck size={19}/><span><b>Аварийные SMS: нет телеметрии</b><small>Существующая GSM-линия проектно независима и не перенастраивается. Тест доставки сообщений обязателен.</small></span></div>
        </section>
      </div>
      <div className="notice"><CircleHelp size={17}/> Нет измерений PIM/IMD, изоляции, фактических частот GSM и базового теста SMS. Система не выдаёт заключение об электромагнитной совместимости.</div>
    </>}
  </div>
}
