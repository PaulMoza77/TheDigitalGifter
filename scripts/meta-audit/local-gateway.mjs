import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
const routes = { 'christmas-funnel':58441, 'stripe-webhook':58442, 'christmas-generate':58443, 'christmas-v2-funnel-event':58444 };
const body = async(req)=>{const a=[];for await(const c of req)a.push(c);return Buffer.concat(a);};
createServer(async(req,res)=>{
 try {
  const bytes=await body(req);
  if(req.url==='/test-email-sink') {
   const message=JSON.parse(bytes);if(!message.to?.every(to=>to.endsWith('@example.invalid')))throw new Error('Non-test recipient refused');
   appendFileSync('/tmp/tdg-isolated-stripe/email-sink.jsonl',JSON.stringify(message)+'\n',{mode:0o600});
   res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({id:'local-email-capture'}));return;
  }
  const name=req.url.split('/')[3];const port=routes[name];
  const dest=port?`http://127.0.0.1:${port}${req.url}`:`http://127.0.0.1:58321${req.url}`;
  const headers={...req.headers};delete headers.host;delete headers['content-length'];
  const upstream=await fetch(dest,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:bytes});
  res.writeHead(upstream.status,Object.fromEntries(upstream.headers));res.end(Buffer.from(await upstream.arrayBuffer()));
 }catch(e){res.writeHead(502,{'content-type':'application/json'}).end(JSON.stringify({error:String(e)}));}
}).listen(58421,'127.0.0.1');
