import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const dir='/tmp/tdg-isolated-stripe';
mkdirSync(dir,{recursive:true});
const cfg=dir+'/supabase/config.toml';
if(!existsSync(cfg))execFileSync('supabase',['init','--workdir',dir],{stdio:'inherit'});
let config=readFileSync(cfg,'utf8');
if(!config.includes('project_id = "tdg-isolated-stripe"'))throw new Error('Unexpected project; refusing setup');
config=config.replaceAll('543','583');writeFileSync(cfg,config);
execFileSync('supabase',['start','--workdir',dir,'--exclude','studio,logflare,realtime,vector,imgproxy,edge-runtime,postgres-meta'],{stdio:'inherit'});
const status=JSON.parse(execFileSync('supabase',['status','--workdir',dir,'--output','json'],{encoding:'utf8'}));
if(status.API_URL!=='http://127.0.0.1:58321')throw new Error('Unexpected API URL');
writeFileSync(dir+'/status.json',JSON.stringify(status),{mode:0o600});
const dbArgs=['-h','127.0.0.1','-p','58322','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
const env={PATH:process.env.PATH,PGPASSWORD:'postgres'};
const count=execFileSync('psql',[...dbArgs,'-Atc',"select count(*) from information_schema.tables where table_schema='public'"],{env,encoding:'utf8'}).trim();
if(count!=='0')throw new Error('Local public schema already contains tables; refusing to overwrite. Reuse the existing harness.');
execFileSync('psql',[...dbArgs,'-f','scripts/meta-audit/isolated-schema.sql'],{env,stdio:'inherit'});
const headers={authorization:'Bearer '+status.SERVICE_ROLE_KEY,apikey:status.SERVICE_ROLE_KEY,'content-type':'application/json'};
for(const name of ['christmas-source-photos','christmas-generated']){
 const response=await fetch(status.API_URL+'/storage/v1/bucket',{method:'POST',headers,body:JSON.stringify({id:name,name,public:false})});
 if(!response.ok)throw new Error('Could not create local bucket '+name);
}
console.log('Isolated schema and storage created; no production rows imported.');
