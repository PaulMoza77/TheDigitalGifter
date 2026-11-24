import { expect, it } from 'vitest';
import { resolveSantaCheckout } from './santaCheckoutDestination';
it('accepts a hosted LIVE Stripe URL without requiring embedded credentials',()=>{
 expect(resolveSantaCheckout({uiMode:'hosted',checkoutUrl:'https://checkout.stripe.com/c/pay/cs_live_example'})).toEqual({kind:'hosted',url:'https://checkout.stripe.com/c/pay/cs_live_example'});
});
it.each(['https://checkout.stripe.com.attacker.test/pay','javascript:alert(1)','http://checkout.stripe.com/pay','https://user:password@checkout.stripe.com/pay',''])('rejects an invalid hosted destination %s',checkoutUrl=>{
 expect(()=>resolveSantaCheckout({uiMode:'hosted',checkoutUrl})).toThrow();
});
it('requires both credentials for embedded checkout',()=>{
 expect(()=>resolveSantaCheckout({clientSecret:'secret'})).toThrow();
 expect(resolveSantaCheckout({clientSecret:'secret',publishableKey:'pk_live_example'}).kind).toBe('custom');
});
