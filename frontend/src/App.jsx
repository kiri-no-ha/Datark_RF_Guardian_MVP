import {useEffect,useMemo,useRef,useState} from 'react'
import { Activity, Antenna, ArrowDownToLine, BarChart3, BookOpen, FileDown, CheckCircle2, ChevronDown, CircleHelp, ClipboardList, Cpu, Database, Gauge, Map, Network, Radio, RotateCcw, Save, Settings2, ShieldCheck, Signal, Wifi, WifiOff, Zap } from 'lucide-react'
import {api,usePoll} from './api'
import Heatmap from './Heatmap'
import Graph from './Graph'
import Analysis from './Analysis'
import Documentation from './Documentation'
import './analysis.css'

const defaultNav=[{id:'overview',label:'Обзор',Icon:Activity},{id:'coverage',label:'Карта покрытия',Icon:Map},{id:'analysis',label:'Анализ',Icon:BarChart3},{id:'docs',label:'Документация',Icon:BookOpen},{id:'history',label:'События и настройки',Icon:ClipboardList}]
const fmt=v=>Number.isFinite(v)?v.toFixed(1):'—'
function Pill({children,tone='neutral'}){return <span className={'pill '+tone}>{children}</span>}
function Stat({label,value,unit='',Icon=Activity,sub,tone=''}){return <div className="stat"><div className="stat-head"><span>{label}</span><Icon size={17}/></div><div className="stat-val">{value}<small>{unit}</small></div>{sub&&<div className={'stat-sub '+tone}>{sub}</div>}</div>}
function Heading({title,desc,right}){return <div className="heading"><div><h2>{title}</h2><p>{desc}</p></div>{right}</div>}
function downloadJson(name,body){const data=new Blob([JSON.stringify(body,null,2)],{type:'application/json'});const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}

function Overview({lid,onMap}){
 const [tel,error]=usePoll(lid?`/layouts/${lid}/telemetry`:null,5000)
 const [s]=usePoll(lid?`/layouts/${lid}/series?metric=rsrp&minutes=60&step=60`:null,9000)
 const [cov]=usePoll(lid?`/layouts/${lid}/coverage?technology=cellular&scenario=two`:null,30000)
 const [health]=usePoll('/health',10000)
 return <>
  <Heading title="Состояние МЦОД" desc="Демонстрационный мониторинг • все показания RF моделируются" right={<Pill tone={health?.status==='ok'?'good':'warn'}><span className="status-dot"/> {health?.status==='ok'?'API доступно':'Подключение…'}</Pill>}/>
  {error&&<div className="notice bad">Нет ответа от API: {error}</div>}
  <div className="stat-grid">
   <Stat label="RSRP · модель" value={tel?fmt(tel.rsrp):'—'} unit="dBm" Icon={Signal} sub="Внешний сигнал · синтетический"/>
   <Stat label="RSSI · модель" value={tel?fmt(tel.rssi):'—'} unit="dBm" Icon={Activity} sub="Измерения пока не подключены"/>
   <Stat label="Усиление" value={tel?fmt(tel.gain):'—'} unit="dB" Icon={Gauge} sub="Расчётный профиль RF"/>
   <Stat label="SINR · модель" value={tel?fmt(tel.sinr):'—'} unit="dB" Icon={Radio} sub="Оценка качества связи"/>
  </div>
  <div className="overview-grid">
   <section className="panel"><div className="panel-title"><h3>Динамика сигнала</h3><Pill>60 минут · эмуляция</Pill></div><Graph series={s||[]}/><div className="chart-foot">Источник: симулятор · не является замером LTE RSRP</div></section>
   <section className="panel"><div className="panel-title"><h3>Контуры системы</h3></div>
     <div className="system-card"><div className="system-icon green"><ShieldCheck size={21}/></div><div><b>Аварийная GSM / SMS</b><small>Независимый существующий тракт</small></div><Pill tone="warn">Нет телеметрии</Pill></div>
     <div className="system-card"><div className="system-icon blue"><Antenna size={21}/></div><div><b>Repeater + DAS</b><small>Один репитер → 2–3 панели</small></div><Pill tone="info">Проект</Pill></div>
     <div className="system-card"><div className="system-icon purple"><Wifi size={21}/></div><div><b>Wi‑Fi / VoWiFi</b><small>Точки доступа + интернет</small></div><Pill tone="info">Проект</Pill></div>
     <button className="primary full" onClick={onMap}>Перейти к карте покрытия <span>→</span></button>
   </section>
  </div>
  <div className="info-row"><section className="panel"><h3>Площадь объекта</h3><div className="big-inline">124,7 <span>м²</span></div><p className="muted">84,8 м² аппаратный зал · 29,8 м² энергомодуль · 10,1 м² тамбур</p></section>
   <section className="panel"><h3>Предварительное покрытие</h3><div className="big-inline">{cov?fmt(cov.summary.covered_pct):'—'} <span>%</span></div><p className="muted">Расчётная доля сетки выше {cov?.thresholds.ok ?? -98} dBm · вариант 2 панели</p></section></div>
 </>
}
function Coverage({lid,layout,reload,initialMode,onModeChange}){
 const [technology,setTechnology]=useState(initialMode?.technology || 'cellular')
 const [scenario,setScenario]=useState(initialMode?.scenario || 'two')
 useEffect(()=>{onModeChange({technology,scenario})},[technology,scenario,onModeChange])
 const customDraft=useRef(null)
 const [positions,setPositions]=useState([])
 const [opacity,setOpacity]=useState(.36)
 const [showHeat,setShowHeat]=useState(true)
 const [showStructure,setShowStructure]=useState(false)
 const [showLabels,setShowLabels]=useState(false)
 const [zoom,setZoom]=useState(100)
 const [dirty,setDirty]=useState(false)
 const [saving,setSaving]=useState(false)
 const [toast,setToast]=useState('')
 const [revision,setRevision]=useState(0)
 const [editSettings,setEditSettings]=useState(null)
 const [savingParams,setSavingParams]=useState(false)
 const [storedCoverage,error]=usePoll(lid?`/layouts/${lid}/coverage?technology=${technology}&scenario=${scenario==='custom'&&!layout?.positions?.[technology]?.custom?'two':scenario}`+`&r=${revision}`:null,60000)
 const [preview,setPreview]=useState(null)
 const coverage=dirty&&preview?preview:storedCoverage
 useEffect(()=>{
   setPreview(null)
   if(!dirty||!positions.length)return
   let active=true
   const timer=setTimeout(()=>{
     api(`/layouts/${lid}/coverage/preview`,{method:'POST',body:{technology,scenario,antennas:positions}})
       .then(v=>{if(active)setPreview(v)}).catch(()=>{})
   },250)
   return ()=>{active=false;clearTimeout(timer)}
 },[lid,technology,scenario,positions,dirty])
 const [comparison]=usePoll(lid?`/layouts/${lid}/compare?technology=${technology}&r=${revision}`:null,60000)
 useEffect(()=>{
   const pending=customDraft.current
   if(scenario==='custom' && pending){
     customDraft.current=null
     setPositions(pending)
     setDirty(true)
   } else {
     setPositions(layout?.positions?.[technology]?.[scenario]||[])
     setDirty(false)
   }
   setPreview(null)
   setToast('')
 },[lid,technology,scenario,layout])
 useEffect(()=>{setEditSettings(layout?{gain:layout.gain,donor_dbm:layout.donor_dbm,feed_loss:layout.feed_loss,clutter:layout.clutter,wifi_eirp_dbm:layout.wifi_eirp_dbm}:null)},[layout?.id])
 const sync=()=>setRevision(v=>v+1)
 const save=async()=>{setSaving(true);setToast('');try{await api(`/layouts/${lid}/positions`,{method:'PUT',body:{technology,scenario,antennas:positions}});await reload();setDirty(false);sync();setToast('Позиции сохранены, покрытие пересчитано')}catch(e){setToast('Ошибка: '+e.message)}finally{setSaving(false)}}
 const saveParams=async()=>{setSavingParams(true);setToast('');try{await api(`/layouts/${lid}`,{method:'PUT',body:Object.fromEntries(Object.entries(editSettings).map(([k,v])=>[k,Number(v)]))});await reload();sync();setToast('Параметры модели сохранены')}catch(e){setToast('Ошибка: '+e.message)}finally{setSavingParams(false)}}
 const reset=()=>{setPositions(layout?.positions?.[technology]?.[scenario]||[]);setDirty(false);setPreview(null);setToast('Позиции восстановлены из сохранённого сценария')}
 const setNew=p=>{setPositions(p);setDirty(true)}
 const chooseCustom=()=>{
   const raw=window.prompt('Количество точек от 1 до 12:',String(positions.length||3))
   if(raw===null)return
   const count=Number(raw.trim())
   if(!Number.isInteger(count)||count<1||count>12){
     setToast('Ошибка: введите целое число от 1 до 12')
     return
   }
   const base=positions.length?positions:(layout?.positions?.[technology]?.three||[])
   const saved=layout?.positions?.[technology]?.custom||[]
   const seed=[
     [20,60],[44,60],[66,60],[31,19],[64,19],[19,80],
     [43,80],[66,80],[20,48],[46,48],[32,28],[71,23]
   ]
   const prefix=technology==='wifi'?'W':'C'
   const label=technology==='wifi'?'Wi-Fi AP':'Панель'
   const next=Array.from({length:count},(_,i)=>({
     id:`${prefix}${i+1}`,
     name:`${label} ${i+1}`,
     x:saved[i]?.x??base[i]?.x??seed[i][0],
     y:saved[i]?.y??base[i]?.y??seed[i][1]
   }))
   customDraft.current=next
   setPositions(next)
   setDirty(true)
   setPreview(null)
   setToast('')
   setScenario('custom')
 }
 const stat=coverage?.summary
 return <>
  <Heading title="Конструктор радиопокрытия" desc="Перетащи антенны по чертежу, выбери число точек и сохрани конфигурацию" right={<Pill tone="info"><Radio size={12}/> RF Digital Twin</Pill>}/>
  <div className="notice"><CircleHelp size={17}/> Показано <b>моделирование</b>, а не реальные измерения. Позиции, материалы и потери требуют проверки на объекте. GSM/SMS не перенастраивается.</div>
  <div className="coverage-controls">
    <div className="control-set"><small>Технология</small><div className="segmented"><button className={technology==='cellular'?'active':''} onClick={()=>setTechnology('cellular')}><Antenna size={15}/> LTE / DAS</button><button className={technology==='wifi'?'active':''} onClick={()=>setTechnology('wifi')}><Wifi size={15}/> Wi‑Fi</button></div></div>
    <div className="control-set"><small>Сценарий</small><div className="segmented"><button className={scenario==='two'?'active':''} onClick={()=>setScenario('two')}>2 {technology==='wifi'?'AP':'панели'}</button><button className={scenario==='three'?'active':''} onClick={()=>setScenario('three')}>3 {technology==='wifi'?'AP':'панели'}</button><button className={scenario==='custom'?'active':''} onClick={chooseCustom}>+ Своё количество</button></div></div>
    <div className="control-set"><small>Прозрачность карты</small><input aria-label="Прозрачность тепловой карты" type="range" min=".12" max=".8" step=".04" value={opacity} onChange={e=>setOpacity(+e.target.value)}/></div>
    <div className="spacer"/>
    <button className="secondary" onClick={reset}><RotateCcw size={15}/> Сброс</button>
    <button className="primary" onClick={save} disabled={!dirty||saving}><Save size={16}/> {saving?'Сохраняем…':'Сохранить позиции'}</button>
  </div>
  {toast&&<div className={'notice '+(toast.startsWith('Ошибка')?'bad':'success')}>{toast}</div>}
  {error&&<div className="notice bad">Не удалось рассчитать: {error}</div>}
  <div className="coverage-layout"><section className="panel map-panel"><div className="panel-title"><h3>Распределение сигнала · план МЦОД</h3><span className="muted xs">Исходный чертёж • 14 × 9 м</span></div>
     <div className="map-scroll"><div className="map-scaler" style={{width:`${zoom}%`}}><Heatmap coverage={coverage} positions={positions} onChange={setNew} opacity={opacity} showHeat={showHeat} showStructure={showStructure} showLabels={showLabels}/></div></div>
     <div className="map-options"><label><input type="checkbox" checked={showHeat} onChange={e=>setShowHeat(e.target.checked)}/> Тепловая карта</label><label><input type="checkbox" checked={showStructure} onChange={e=>setShowStructure(e.target.checked)}/> Стойки и стены (схематично)</label><label><input type="checkbox" checked={showLabels} onChange={e=>setShowLabels(e.target.checked)}/> Названия зон</label><label className="zoom-label">Масштаб <select value={zoom} onChange={e=>setZoom(+e.target.value)}><option value="100">100%</option><option value="125">125%</option><option value="150">150%</option><option value="200">200%</option></select></label></div>
     <div className="legend"><span><i className="key green"/> Хорошо ≥ {coverage?.thresholds.good??'…'} dBm</span><span><i className="key yellow"/> Приемлемо ≥ {coverage?.thresholds.ok??'…'} dBm</span><span><i className="key red"/> Слабый сигнал</span><span><i className="key dot"/> {technology==='wifi'?'Точки Wi‑Fi':'Внутренние антенны'}</span></div>
  </section>
  <aside className="aside-stack">
   <section className="panel tight"><div className="panel-title"><h3>Итоги расчёта</h3><Pill tone="info">{technology==='wifi'?'Wi‑Fi 2.4':'LTE 2600'}</Pill></div>
     <div className="big-percent">{stat?fmt(stat.covered_pct):'—'}<span>%</span></div><div className="muted">Площадь сетки с приемлемым сигналом</div>
     <div className="quality-strip"><span style={{width:`${stat?.good_pct??0}%`,background:'#20b486'}}/><span style={{width:`${Math.max(0,(stat?.covered_pct??0)-(stat?.good_pct??0))}%`,background:'#f5b64c'}}/><span style={{width:`${stat?.weak_pct??0}%`,background:'#e95b6f'}}/></div>
     <div className="mini-stats"><span>Хороший</span><b>{stat?fmt(stat.good_pct):'—'}%</b><span>Слабый</span><b>{stat?fmt(stat.weak_pct):'—'}%</b></div>
   </section>
   <section className="panel tight"><div className="panel-title"><h3>Размещение</h3><Pill>{positions.length} шт.</Pill></div><div className="antenna-list">{positions.map(p=><div className="antenna-item" key={p.id}><div className="antenna-symbol"><Radio size={15}/></div><div><b>{p.name}</b><small>X {fmt(p.x)}% · Y {fmt(p.y)}%</small></div><span className="muted">↔</span></div>)}</div><p className="muted xs">Перетаскивай круглые маркеры на плане. Позиции запоминаются после сохранения.</p></section>
   <section className="panel tight"><div className="panel-title"><h3>Сравнение сценариев</h3></div>{comparison?.map(c=><div className={'compare-line '+(scenario===c.scenario?'selected':'')} key={c.scenario}><span>{c.antennas} {technology==='wifi'?'Wi‑Fi AP':'панели DAS'}</span><b>{fmt(c.summary.covered_pct)}%</b></div>)}<p className="muted xs">Для сотового варианта: один репитер и несколько распределённых панельных антенн, а не несколько независимых усилителей.</p></section>
  </aside></div>
  <div className="under-map"><section className="panel"><div className="panel-title"><h3>Зоны покрытия</h3><span className="muted xs">По расчётной сетке, без натурных замеров</span></div><div className="table-scroll"><table><thead><tr><th>Помещение</th><th>Площадь</th><th>Средний уровень</th><th>Приемлемое покрытие</th></tr></thead><tbody>{(coverage?.areas||[]).map(a=><tr key={a.id}><td>{a.name}</td><td>{a.area_m2} м²</td><td>{a.avg_dbm===null?'—':fmt(a.avg_dbm)+' dBm'}</td><td><strong>{fmt(a.covered_pct)}%</strong></td></tr>)}</tbody></table></div></section>
   <section className="panel"><div className="panel-title"><h3>Параметры модели</h3></div>{editSettings&&<div className="settings-grid">{(technology==='cellular'?[['donor_dbm','Внешний сигнал, dBm'],['gain','Усиление репитера, dB'],['feed_loss','Потери линии, dB'],['clutter','Поправка на стойки, dB']]:[['wifi_eirp_dbm','EIRP Wi‑Fi AP, dBm']]).map(([k,label])=><label key={k}>{label}<input type="number" step="1" value={editSettings[k]} onChange={e=>setEditSettings({...editSettings,[k]:e.target.value})}/></label>)}<button className="primary" onClick={saveParams} disabled={savingParams}>Применить</button></div>}<div className="actions"><button className="secondary" disabled={!coverage} onClick={()=>downloadJson(`coverage-${lid}-${technology}-${scenario}.json`,{plan:'/plan.png',settings:editSettings,...coverage})}><ArrowDownToLine size={16}/> Экспорт JSON расчёта</button></div></section></div>
 </>
}
function History({lid}){
 const [all,setAll]=useState(true)
 const [history,error]=usePoll(`/history?limit=100${all?'':'&layout='+lid}`,6000)
 const [cfg]=usePoll('/config',30000)
 const [settings,setSettings]=useState(null)
 const [status,setStatus]=useState('')
 useEffect(()=>{if(cfg&&!settings)setSettings(cfg)},[cfg])
 const save=async()=>{try{await api('/config',{method:'PUT',body:{threshold_dbm:+settings.threshold_dbm,refresh_s:+settings.refresh_s}});setStatus('Настройки сохранены')}catch(e){setStatus(e.message)}}
 return <><Heading title="История и эксплуатация" desc="Изменения конфигурации, источники данных и эксплуатационные оговорки"/>
 <div className="history-layout"><section className="panel"><div className="panel-title"><h3>Журнал событий</h3><label className="inline-checkbox"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> Все макеты</label></div>{error&&<div className="notice bad">{error}</div>}{!history?.length?<div className="empty">Пока нет изменений. Сдвинь антенну на карте и сохрани её положение.</div>:<table><thead><tr><th>Время</th><th>Событие</th></tr></thead><tbody>{history.map((e,i)=><tr key={e.t+'-'+i}><td>{new Date(e.t*1000).toLocaleString('ru-RU')}</td><td>{e.action}{e.changes?.length>0&&<details><summary>Подробнее</summary><pre>{JSON.stringify(e.changes,null,2)}</pre></details>}</td></tr>)}</tbody></table>}</section>
 <aside className="aside-stack"><section className="panel"><h3>Общая конфигурация</h3>{settings&&<><label>Порог внешнего сигнала, dBm<input type="number" value={settings.threshold_dbm} onChange={e=>setSettings({...settings,threshold_dbm:e.target.value})}/></label><label>Интервал мониторинга, сек<input type="number" value={settings.refresh_s} onChange={e=>setSettings({...settings,refresh_s:e.target.value})}/></label><button className="primary" onClick={save}>Сохранить</button>{status&&<p className="muted">{status}</p>}</>}</section><section className="panel"><h3>Режим эксплуатации</h3><div className="system-card"><div className="system-icon purple"><Database size={19}/></div><div><b>Источник: Simulation</b><small>Спектр, уровни и распределение — модель</small></div></div><div className="system-card"><div className="system-icon green"><ShieldCheck size={19}/></div><div><b>GSM/SMS вне управления</b><small>Статус без подключённого модема неизвестен</small></div></div><p className="muted xs">Для реальной системы потребуются согласование оператором, обследование трасс, выбор частот, измерения downlink/uplink и ЭМС.</p></section></aside></div></>
}
function App(){
 const [page,setPage]=useState('coverage')
 const [layouts,setLayouts]=useState([])
 const [lid,setLid]=useState('mcod-1')
 const [layout,setLayout]=useState(null)
 const [error,setError]=useState('')
 const [theme,setTheme]=useState(localStorage.getItem('rf-theme')||'dark')
 const [newName,setNewName]=useState('')
 const [mode,setMode]=useState({technology:'cellular',scenario:'two'})
 const [reportBusy,setReportBusy]=useState(false)
 const [reportStatus,setReportStatus]=useState('')
 const reload=async()=>{try{const [all,one]=await Promise.all([api('/layouts'),api(`/layouts/${lid}`)]);setLayouts(all);setLayout(one);setError('')}catch(e){setError(e.message)}}
 useEffect(()=>{reload()},[lid])
 useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('rf-theme',theme)},[theme])
 const switchLayout=(next)=>{setLid(next);setMode({technology:'cellular',scenario:'two'});setReportStatus('')}
 const downloadReport=async()=>{
   if(!layout || reportBusy)return
   setReportBusy(true);setReportStatus('')
   try{
     const query=new URLSearchParams({technology:mode.technology,scenario:mode.scenario})
     const response=await fetch(`/api/layouts/${encodeURIComponent(lid)}/report?${query}`)
     if(!response.ok){
       const detail=await response.json().catch(()=>null)
       throw new Error(detail?.detail || `HTTP ${response.status}`)
     }
     const blob=await response.blob()
     const url=URL.createObjectURL(blob)
     const a=document.createElement('a')
     a.href=url;a.download=`datark-report-${lid}.txt`
     document.body.appendChild(a);a.click();a.remove()
     setTimeout(()=>URL.revokeObjectURL(url),1500)
     setReportStatus('Отчёт скачан. Только сохранённый сценарий.')
   }catch(e){setReportStatus('Ошибка: '+e.message)}
   finally{setReportBusy(false)}
 }
 const makeLayout=async()=>{if(!newName.trim())return;try{const a=await api('/layouts',{method:'POST',body:{name:newName.trim(),copy_from:lid}});switchLayout(a.id);setNewName('')}catch(e){setError(e.message)}}
 return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brand-logo"><Radio size={22}/></div><div><strong>DATARK</strong><small>RF GUARDIAN</small></div></div>
   <div className="sidebar-section">РАБОЧАЯ ОБЛАСТЬ</div><nav>{defaultNav.map(({id,label,Icon})=><button key={id} className={'nav-link '+(page===id?'current':'')} onClick={()=>setPage(id)}><Icon size={19}/>{label}{page===id&&<span className="current-bar"/>}</button>)}</nav>
   <div className="sidebar-section section-gap">ОБЪЕКТ</div><div className="site-select" title="Выбрать объект"><span className="site-dot"/><select aria-label="Выбрать объект" value={lid} onChange={e=>switchLayout(e.target.value)}>{layouts.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select><ChevronDown size={15}/></div>
   <div className="add-site"><input aria-label="Название нового макета" placeholder="Новый макет…" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&makeLayout()}/><button onClick={makeLayout} title="Создать копию проекта">+</button></div><button className="sidebar-report" disabled={!layout||reportBusy} onClick={downloadReport}><FileDown size={18}/>{reportBusy?"Формируем…":"Сформировать отчёт TXT"}</button><div className="sidebar-report-note">Для выбранного объекта · {mode.technology === "wifi" ? "Wi-Fi" : "LTE/DAS"} · {mode.scenario === "two" ? "2 точки" : mode.scenario === "three" ? "3 точки" : "Свои точки"}</div>{reportStatus&&<div className="sidebar-report-status" role="status">{reportStatus}</div>}
   <div className="sidebar-bottom"><div className="simulation-box"><div className="simulation-heading"><span className="status-dot"/> DEMO MODE</div><p>Данные RF рассчитаны математической моделью.</p></div><div className="sidebar-version">v1.0 · Hackathon build</div></div>
 </aside><div className="workspace"><header className="topbar"><div><span className="breadcrumbs">Платформа мониторинга <span>/</span> {defaultNav.find(x=>x.id===page)?.label}</span><div className="header-title">Datark RF Guardian <span>•</span> МЦОД</div></div><div className="top-actions"><Pill tone="info">СИМУЛЯЦИЯ</Pill><button className="theme-btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')} title="Переключить тему">{theme==='dark'?'☀':'☾'}</button></div></header>
  <main className="content">{error&&<div className="notice bad">Ошибка загрузки: {error}. Запусти Python API на порту 8000.</div>}{!layout?<div className="loading">Соединяемся с сервером… <code>localhost:8000/docs</code></div>:page==='overview'?<Overview lid={lid} onMap={()=>setPage('coverage')}/>:page==='coverage'?<Coverage key={lid} lid={lid} layout={layout} reload={reload} initialMode={mode} onModeChange={setMode}/>:page==='analysis'?<Analysis lid={lid} layout={layout} mode={mode} setMode={setMode}/>:page==='docs'?<Documentation layout={layout}/>:<History lid={lid}/>}</main>
  <footer className="footer"><span>DATARK RF GUARDIAN · проектная оценка, не заключение по ЭМС</span><span>FastAPI + React · 2026</span></footer></div></div>
}
export default App
