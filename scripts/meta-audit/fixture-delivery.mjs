import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const s=JSON.parse(readFileSync('/tmp/tdg-isolated-stripe/status.json','utf8'));
const order=JSON.parse(readFileSync('/tmp/tdg-isolated-stripe/order.json','utf8'));
const headers={apikey:s.SERVICE_ROLE_KEY,authorization:'Bearer '+s.SERVICE_ROLE_KEY,'content-type':'application/json'};
const rpc=async(body)=>{const r=await fetch(s.API_URL+'/rest/v1/rpc/fulfill_christmas_v2_order_payment',{method:'POST',headers,body:JSON.stringify(body)});return{status:r.status,body:await r.json()};};
const input={p_event_id:'fixture-payment-not-a-stripe-sale',p_session_id:'cs_test_fixture_not_a_sale',p_event_type:'checkout.session.completed',p_payment_status:'paid',p_payment_intent_id:'pi_fixture_not_a_sale',p_amount_cents:700,p_currency:'eur',p_order_id:order.orderId};
const results=[];
for(const change of [{p_payment_status:'unpaid'},{p_amount_cents:701},{p_currency:'usd'}]){const r=await rpc({...input,...change});if(r.status<400)throw new Error('Invalid payment accepted');results.push({negative:change,rejected:true,status:r.status});}
const paid=await rpc(input);const repeated=await rpc(input);
if(paid.status!==200||!repeated.body.already_paid)throw new Error('Fixture fulfillment failed');
results.push({fixturePaid:paid.body,fixtureRetry:repeated.body});
const generation=await fetch('http://127.0.0.1:58421/functions/v1/christmas-generate',{method:'POST',headers,body:JSON.stringify({order_id:order.orderId})});
results.push({mockGenerationHttp:generation.status,body:await generation.json()});
const polled=await fetch('http://127.0.0.1:58421/functions/v1/christmas-funnel',{method:'POST',headers,body:JSON.stringify({action:'pollGenerationProgress',publicToken:order.publicToken})});const data=await polled.json();
results.push({poll:{status:data.order?.status,paidAt:!!data.order?.paidAt,currency:data.order?.currency,amountCents:data.order?.amountCents,scenes:data.scenes?.map(x=>({key:x.sceneKey,status:x.status,download:!!x.imageUrl}))}});
for(const scene of data.scenes||[]){if(scene.imageUrl){if(new URL(scene.imageUrl).hostname!=='127.0.0.1')throw new Error('Nonlocal download');const r=await fetch(scene.imageUrl);results.push({downloadHttp:r.status,downloadBytes:(await r.arrayBuffer()).byteLength});}}
writeFileSync('/tmp/tdg-isolated-stripe/fixture-results.json',JSON.stringify(results,null,2),{mode:0o600});console.log(JSON.stringify(results));
