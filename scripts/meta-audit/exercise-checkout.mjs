import {readFileSync,writeFileSync} from 'node:fs';
const base='http://127.0.0.1:58421/functions/v1/christmas-funnel';
const order=JSON.parse(readFileSync(process.env.TDG_AUDIT_ORDER_FILE || '/tmp/tdg-isolated-stripe/order.json','utf8'));
async function call(action,input){const r=await fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...input})});const d=await r.json();if(!r.ok)throw new Error(JSON.stringify(d));return d;}
const bytes=readFileSync('public/assets/funnel/christmas-before.png');
const auth={orderId:order.orderId,publicToken:order.publicToken};
const signed=await call('getSignedUploadUrl',{...auth,contentType:'image/png',fileName:'audit-demo.png',byteSize:bytes.length});
if(new URL(signed.uploadUrl).hostname!=='127.0.0.1')throw new Error('Nonlocal storage refused');
const uploaded=await fetch(signed.uploadUrl,{method:'PUT',headers:{'content-type':'image/png'},body:bytes});if(!uploaded.ok)throw new Error(await uploaded.text());
await call('confirmUpload',{...auth,objectPath:signed.objectPath});
const checkout=await call('createStripeCheckout',{...auth,uiMode:'hosted',attribution:{utm_source:'facebook',utm_medium:'paid_social',utm_campaign:'tdg_living_memory_us',utm_content:'grandma_family_video'}});
if(!checkout.sessionId.startsWith('cs_test_'))throw new Error('Non-TEST session refused');
writeFileSync(process.env.TDG_AUDIT_CHECKOUT_FILE || '/tmp/tdg-isolated-stripe/checkout.json',JSON.stringify(checkout),{mode:0o600});
console.log(JSON.stringify({uploadBytes:bytes.length,orderId:order.orderId,sessionId:checkout.sessionId,amountCents:checkout.amountCents,currency:checkout.currency,hostedCheckout:!!checkout.checkoutUrl}));
