import { useEffect, useRef, useState } from 'react'

const AREA = [
  {id:'hall',label:'Аппаратный зал',top:36.1,left:8.2,width:68.1,height:54.1},
  {id:'power',label:'Энергомодуль',top:7.5,left:8.2,width:49.8,height:25.6},
  {id:'vestibule',label:'Тамбур',top:7.5,left:58.7,width:17.6,height:25.6},
]
function valid(x,y){return AREA.some(a=>x>=a.left && x<=a.left+a.width && y>=a.top && y<=a.top+a.height)}
function cellColor(val, thresholds, alpha) {
  if(val===null) return null
  if(val>=thresholds.good) return `rgba(24,166,119,${alpha})`
  if(val>=thresholds.ok) return `rgba(248,175,53,${alpha})`
  return `rgba(225,68,88,${alpha})`
}
export default function Heatmap({coverage,positions,onChange,opacity,showHeat,showStructure,showLabels}){
  const canvasRef=useRef(null)
  const baseRef=useRef(null)
  const [dragging,setDragging]=useState(null)

  useEffect(()=>{
    const cv=canvasRef.current
    if(!cv) return
    const ctx=cv.getContext('2d')
    cv.width=1724;cv.height=1017
    ctx.clearRect(0,0,cv.width,cv.height)
    if(!coverage || !showHeat) return
    const dx=cv.width/coverage.columns, dy=cv.height/coverage.rows
    coverage.grid.forEach((row,j)=>row.forEach((v,i)=>{
      const color=cellColor(v,coverage.thresholds,opacity)
      if (color) 
        {ctx.fillStyle=color;ctx.fillRect(i*dx,j*dy,Math.ceil(dx)+.25,Math.ceil(dy)+.25)}
    }))
  },[coverage,opacity,showHeat])
  const move=(e,id)=>{
    if(dragging!==id||!baseRef.current)return
    const rect=baseRef.current.getBoundingClientRect()
    const x=Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100))
    const y=Math.max(0,Math.min(100,(e.clientY-rect.top)/rect.height*100))
    if(!valid(x,y))return
    onChange(positions.map(p=>p.id===id?{...p,x:Math.round(x*10)/10,y:Math.round(y*10)/10}:p))
  }
  return <div className="plan-wrap" ref={baseRef}>
    <img src="/plan.png" alt="Исходный план размещения инженерных шкафов МЦОД" draggable="false"/>
    <canvas ref={canvasRef} className="heat-canvas" aria-label="Тепловая карта расчётного сигнала"/>
    {showStructure&&<div className="plan-structure">
      <div className="wall-h"/><div className="wall-v"/><div className="rack rack-upper"/><div className="rack rack-lower"/>
    </div>}
    {showLabels&&AREA.map(a=><span key={a.id} className="area-tag" style={{left:`${a.left+2}%`,top:`${a.top+1}%`}}>{a.label}</span>)}
    {positions.map(p=><button type="button" className={'antenna-pin '+(dragging===p.id?'dragging':'')} key={p.id}
       style={{left:`${p.x}%`,top:`${p.y}%`}} title={`${p.name} — перетащи для изменения позиции`}
       onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setDragging(p.id)}}
       onPointerMove={e=>move(e,p.id)}
       onPointerUp={e=>{if(dragging===p.id)move(e,p.id);setDragging(null)}}
       onPointerCancel={()=>setDragging(null)}>
        <span className="pin-pulse"/><span className="pin-label">{p.id}</span>
      </button>)}
  </div>
}
