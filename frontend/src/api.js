import { useEffect, useState } from 'react'
export async function api(path, opts={}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch('/api' + path, {
      method: opts.method ?? 'GET',
      headers: opts.body ? {'Content-Type':'application/json'} : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    const data = await response.json().catch(()=>({}))
    if (!response.ok) {
      let msg = data.detail ?? response.statusText
      if (Array.isArray(msg)) msg = msg.map(x => x.msg).join(', ')
      throw new Error(String(msg))
    }
    return data
  } finally { clearTimeout(timer) }
}
export function usePoll(path, interval=5000, deps=[]) {
  const [data,setData]=useState(null)
  const [error,setError]=useState('')
  useEffect(()=>{
    if (!path) return
    let live = true
    async function load(){try{const result=await api(path); if(live){setData(result);setError('')}}catch(e){if(live)setError(e.message)}}
    load(); const timer=setInterval(load,interval)
    return ()=>{live=false;clearInterval(timer)}
  },[path,interval,...deps])
  return [data,error]
}
