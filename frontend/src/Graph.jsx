export default function Graph({series=[],metric='rsrp'}){
  if(!series?.length)return <div className="muted">Ожидание телеметрии…</div>
  const width=680,height=190,top=16,bottom=height-27,left=36,right=width-12
  const vals=series.map(x=>x.v)
  const min=Math.min(...vals)-4,max=Math.max(...vals)+4
  const X=i=>left+i*(right-left)/Math.max(1,series.length-1)
  const Y=v=>bottom-(v-min)/(max-min)*(bottom-top)
  const poly=series.map((v,i)=>`${X(i)},${Y(v.v)}`).join(' ')
  return <svg viewBox={`0 0 ${width} ${height}`} className="signal-chart" role="img" aria-label={`Временной график ${metric}`}>
    {[0,.25,.5,.75,1].map((t,i)=><g key={i}><line x1={left} x2={right} y1={top+(bottom-top)*t} y2={top+(bottom-top)*t} stroke="currentColor" strokeOpacity=".12" strokeDasharray="4 5"/><text x={left-7} y={top+(bottom-top)*t+3} fill="currentColor" fontSize="10" textAnchor="end">{(max-(max-min)*t).toFixed(0)}</text></g>)}
    <polyline points={poly} stroke="#4d91ff" strokeWidth="2.6" fill="none" strokeLinejoin="round"/>
    <circle cx={X(series.length-1)} cy={Y(series.at(-1).v)} r="4" fill="#4d91ff"/>
    <text x={left} y={height-5} fontSize="10" fill="currentColor">{new Date(series[0].t*1000).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</text>
    <text x={right} y={height-5} fontSize="10" textAnchor="end" fill="currentColor">{new Date(series.at(-1).t*1000).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</text>
  </svg>
}
