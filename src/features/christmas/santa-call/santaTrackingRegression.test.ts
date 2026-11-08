import { beforeEach, expect, it, vi } from "vitest";
import { trackSantaCallMetaPurchase, trackSantaCallMetaInitiateCheckout, santaCallPurchaseEventId } from "./santaCallMeta";
let calls: ReturnType<typeof vi.fn>;
beforeEach(() => {
  const consent = new Map<string,string>(); const session = new Map<string,string>();
  consent.set('tdg.cookie-consent.v1','granted'); calls=vi.fn();
  vi.stubGlobal('window', {fbq:calls,localStorage:{getItem:(k:string)=>consent.get(k)},sessionStorage:{getItem:(k:string)=>session.get(k),setItem:(k:string,v:string)=>session.set(k,v)}});
});
it('uses one stable purchase ID and RON amount for repeat calls',()=>{
 const order={orderId:'synthetic-order',amountCents:5900,currency:'ron'};
 trackSantaCallMetaPurchase(order);trackSantaCallMetaPurchase(order);
 expect(calls).toHaveBeenCalledTimes(1);
 expect(calls.mock.calls[0]).toEqual(['track','Purchase',expect.objectContaining({currency:'RON',value:59,content_ids:['christmas_santa_voice_call']}),{eventID:santaCallPurchaseEventId(order.orderId)}]);
});
it('does not transmit after consent rejection',()=>{
 window.localStorage.getItem=()=> 'denied';trackSantaCallMetaPurchase({orderId:'test',amountCents:5900,currency:'ron'});expect(calls).not.toHaveBeenCalled();
});
it('deduplicates checkout using a separate stable event ID',()=>{
 const order={orderId:'synthetic-order',amountCents:4900,currency:'ron'};trackSantaCallMetaInitiateCheckout(order);trackSantaCallMetaInitiateCheckout(order);expect(calls).toHaveBeenCalledTimes(1);expect(calls.mock.calls[0][3]).toEqual({eventID:'xmas_santa_call_ic_synthetic-order'});
});
