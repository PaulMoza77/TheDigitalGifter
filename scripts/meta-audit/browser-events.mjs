import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true,channel:'chrome'});const evidence=[];
for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile});
 // Capture dispatch locally; never send fixture Purchase or matching data to Meta.
 await context.addInitScript(()=>{window.__auditCalls=[];});
 await context.route('**/*',async(route)=>{
  const u=new URL(route.request().url());
  if(u.hostname==='127.0.0.1')return route.continue();
  if(u.href==='https://connect.facebook.net/en_US/fbevents.js')return route.fulfill({contentType:'application/javascript',body:'window.__auditCalls.push(...window.fbq.queue);window.fbq.queue=[];window.fbq.callMethod=function(){window.__auditCalls.push(Array.from(arguments));};'});
  return route.abort();
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:58400/christmas/photo-generator?utm_source=facebook&utm_medium=paid_social&utm_campaign=tdg_living_memory_us&utm_content=grandma_family_video',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(1200);
 const before=await page.evaluate(()=>({calls:window.__auditCalls,fbq:typeof window.fbq}));
 await page.getByRole('button',{name:'Accept',exact:true}).click();await page.waitForTimeout(600);
 const accepted=await page.evaluate(()=>window.__auditCalls);
 const checkout=JSON.parse(readFileSync('/tmp/tdg-isolated-stripe/checkout.json','utf8'));
 await page.evaluate(async(input)=>{
   const module=await import('/src/features/christmas-v2/meta.ts');
   module.trackChristmasPackCheckout(input);module.trackChristmasPackCheckout(input);
 }, {orderId:checkout.orderId,amountCents:checkout.amountCents,currency:checkout.currency});
 const checkoutDispatch=await page.evaluate(()=>window.__auditCalls);
 await page.getByRole('button',{name:'Create My Christmas Photo',exact:true}).first().click();await page.waitForTimeout(300);
 const upload={fileInputs:await page.locator('input[type=file]').count(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)};
 await page.locator('input[type=file]').setInputFiles('public/assets/funnel/christmas-before.png');await page.waitForTimeout(800);
 const afterUpload={url:page.url(),text:(await page.locator('body').innerText()).slice(-1600)};
 const order=JSON.parse(readFileSync(process.env.TDG_AUDIT_ORDER_FILE || '/tmp/tdg-isolated-stripe/order.json','utf8'));
 await page.goto('http://127.0.0.1:58400/christmas-ai-photos/order?token='+encodeURIComponent(order.publicToken),{waitUntil:'domcontentloaded'});await page.waitForTimeout(1300);
 const first=await page.evaluate(()=>window.__auditCalls);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(1000);
 const refresh=await page.evaluate(()=>window.__auditCalls);
 evidence.push({mobile,before,accepted,checkoutDispatch,upload,afterUpload,first,refresh,errors});
 await context.close();
}
await browser.close();writeFileSync(process.env.TDG_AUDIT_BROWSER_OUTPUT || '/tmp/tdg-isolated-stripe/browser-events.json',JSON.stringify(evidence,null,2),{mode:0o600});
console.log(JSON.stringify(evidence.map(e=>({...e,afterUpload:{url:e.afterUpload.url},errors:e.errors.slice(0,5)}))));
