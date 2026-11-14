// Optional, no-dependencies Node.js gateway. Not needed for hackathon operation.
// Run `node gateway/server.mjs` to proxy /api from :3001 to FastAPI :8000.
import http from 'node:http'
const target = 'http://127.0.0.1:8000'
http.createServer(async (req,res)=>{
  if(!req.url?.startsWith('/api/')) {res.writeHead(404);res.end('Not found');return}
  try{
    const chunks=[]
    for await (const chunk of req)chunks.push(chunk)
    const response=await fetch(target+req.url,{method:req.method,headers:{'content-type':req.headers['content-type']||'application/json'},body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)})
    res.writeHead(response.status,{'content-type':response.headers.get('content-type')||'application/json'})
    res.end(Buffer.from(await response.arrayBuffer()))
  }catch(e){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({error:String(e)}))}
}).listen(3001,'127.0.0.1',()=>console.log('Node API gateway → http://127.0.0.1:3001'))
