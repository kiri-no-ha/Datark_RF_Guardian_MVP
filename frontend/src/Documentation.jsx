import {Antenna, ArrowDownToLine, BookOpen, Cable, CircleHelp, Filter, Radio, ShieldCheck, Wifi} from 'lucide-react'

const steps = [
  {Icon:Antenna, title:'Внешняя направленная антенна', text:'Принимает сигнал согласованного оператора вне экранированного корпуса. Направление, усиление и частота выбираются по измерениям.'},
  {Icon:Filter, title:'Частотная селекция и защита', text:'Полосовые фильтры, дуплексеры / диплексеры, ограничение уровня и контроль нелинейностей в соответствии с реальными полосами.'},
  {Icon:Radio, title:'Репитер + внутренняя DAS-сеть', text:'Управляемый репитер с AGC/ALC, распределители, низко-PIM кабели и панельные антенны. Нужны оба направления: UL и DL.'},
  {Icon:Wifi, title:'Независимый Wi-Fi-сегмент', text:'ЛВС/интернет → PoE-коммутатор → Wi-Fi AP. Wi-Fi Calling работает только при поддержке телефоном и оператором.'},
  {Icon:ShieldCheck, title:'Существующая GSM/SMS-система', text:'Старая антенна → действующий GSM-модем → аварийные SMS. Никаких электрических изменений, демонтажа и перенастройки.'},
]

export default function Documentation({layout}) {
  return <div className="doc-page">
    <div className="heading"><div><h2>Документация по системе</h2><p>Обоснование архитектуры и чек-лист верификации для технического жюри</p></div><span className="pill info">Проектный уровень</span></div>
    <div className="doc-hero panel"><div><BookOpen size={24}/><h3>Датарк · организация связи в модульном ЦОД</h3><p>Для объекта «{layout?.name}» рассматривается отдельный тракт мобильной связи персонала, дополнительный Wi-Fi и неизменяемая аварийная GSM/SMS-система.</p></div><a className="doc-download" href="/hardware-architecture.drawio" download="hardware-architecture.drawio"><ArrowDownToLine size={17}/> Скачать блок-схему draw.io</a></div>

    <div className="analysis-columns">
      <section className="panel"><h3>Аппаратная архитектура</h3><div className="doc-steps">{steps.map(({Icon,title,text},i) => <div className="doc-step" key={title}><div className="doc-index"><Icon size={20}/></div><div><b>{i+1}. {title}</b><p>{text}</p></div></div>)}</div></section>
      <section className="panel"><h3>Параметры оборудования для подбора</h3><table className="analysis-table"><tbody>
        <tr><th>Компонент</th><th>Критерии выбора</th></tr>
        <tr><td>Донорная антенна</td><td>Направленность, нужные частоты, усиление, место крепления</td></tr>
        <tr><td>Репитер</td><td>Полосы UL/DL, AGC/ALC, допустимая мощность, защита от самовозбуждения, эксплуатационный допуск</td></tr>
        <tr><td>Фильтры и дуплексеры</td><td>Полосы пропускания, затухание, потери внесения, линейность</td></tr>
        <tr><td>DAS и панели</td><td>Количество портов, потери делителей, импеданс, PIM, монтажные точки</td></tr>
        <tr><td>Wi-Fi AP</td><td>PoE, стандарты 802.11, LAN, стабильность покрытия и VoWiFi</td></tr>
      </tbody></table><div className="analysis-note"><Cable size={15}/> Конкретные модели выбираются после частотного обследования и проверки доступности; универсальность программы не отменяет совместимость аппаратуры.</div></section>
    </div>
    <section className="panel"><h3>Что требуется проверить до внедрения</h3><div className="doc-checks">
      {['Замер внешнего сигнала операторов и фактических рабочих частот', 'Проверка downlink и uplink в худших точках', 'Измерение развязки донорной и внутренних антенн', 'Измерения PIM/IMD и внеполосных излучений', 'Тест штатного GSM-модема и доставки SMS до/после монтажа', 'Подтверждение полномочий оператора и параметров используемых частот', 'Выбор оборудования и оформление инструкции эксплуатации'].map((x,i)=><div key={x}><span className="doc-unchecked">{i+1}</span>{x}</div>)}
    </div></section>
    <div className="notice"><CircleHelp size={17}/> На данный момент расчёты основаны на PNG-плане 14×9 м и примерных потерях; эта документация не подтверждает законность эксплуатации репитера или отсутствие интерференции.</div>
  </div>
}
