import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
const s=JSON.parse(readFileSync('/tmp/tdg-isolated-stripe/status.json','utf8'));
const child=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','58400','--strictPort'],{stdio:'inherit',env:{PATH:process.env.PATH,HOME:process.env.HOME,VITE_SUPABASE_URL:'http://127.0.0.1:58421',VITE_SUPABASE_ANON_KEY:s.ANON_KEY,VITE_APP_URL:'http://127.0.0.1:58400'}});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>child.kill(sig));
