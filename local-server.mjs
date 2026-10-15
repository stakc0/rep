import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,stat} from 'node:fs/promises';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.mp4':'video/mp4'};
const routes={'/':'index.html','/launch':'launch.html','/docs':'docs.html','/analytics':'index.html','/token.html':'token.html'};
let apiHandler;
function safe(p){const d=decodeURIComponent(p);if(d.includes('\0')||d.split('/').includes('..'))return null;const f=path.resolve(ROOT,'.'+d);return f.startsWith(ROOT+path.sep)?f:null;}
async function callApi(req,res){
  apiHandler ??= (await import('./api/[...path].js')).default;
  const chunks=[];for await(const c of req)chunks.push(c);
  const body=Buffer.concat(chunks);
  const u=new URL(req.url,'http://localhost');
  const out={statusCode:200,headers:{},body:Buffer.alloc(0)};
  const response={
    status(code){out.statusCode=code;return response;},
    setHeader(k,v){out.headers[k]=v;return response;},
    json(value){out.headers['content-type']='application/json; charset=utf-8';out.body=Buffer.from(JSON.stringify(value));return response;},
    send(value){out.body=Buffer.isBuffer(value)?value:Buffer.from(String(value));return response;}
  };
  await apiHandler({...req,url:req.url,query:Object.fromEntries(u.searchParams),body},response);
  res.writeHead(out.statusCode,out.headers);res.end(out.body);
}
async function handler(req,res){
  try{
    const u=new URL(req.url,'http://localhost');
    if(u.pathname.startsWith('/api/')) return callApi(req,res);
    const route=routes[u.pathname]|| (u.pathname.startsWith('/token/')?'token.html':u.pathname.slice(1));
    const file=safe('/'+route);
    try{const info=await stat(file);if(info.isFile()){res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream','cache-control':'no-cache'});return res.end(await readFile(file));}}catch{}
    res.writeHead(404,{'content-type':'text/plain'});res.end('Not found');
  }catch(error){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:error.message}));}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) http.createServer(handler).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('REP running on http://localhost:'+(process.env.PORT||3000)));
export {handler};
