/**
 * Release / deploy gates. Preview deploys are allowed. Production
 * promotion requires an explicit Vercel env flag, and customer checkout
 * stays off until the live test checklist is complete.
 */

export const releaseControl = {
  /**
   * Customer checkout. Must stay false until webhook fulfillment, Stripe
   * test payments, and one live €4.99 charge + refund are verified.
   */
  checkoutEnabled: false,
  livePaymentsEnabled: false,
  /**
   * Production Vercel builds are skipped unless ENABLE_PRODUCTION_DEPLOY=1
   * is set on the Production environment. Preview builds always run.
   */
  requireExplicitProductionDeploy: true,
} as const;
