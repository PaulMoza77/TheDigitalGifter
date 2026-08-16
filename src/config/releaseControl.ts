/**
 * Release / deploy gates. Preview deploys are allowed. Production
 * promotion requires an explicit Vercel env flag, and customer checkout
 * stays off until the live test checklist is complete.
 */

export const releaseControl = {
  /**
   * Customer checkout. Compile-time default stays false. Preview may enable
   * Stripe *test* checkout only via VITE_CHECKOUT_ENABLED + VITE_STRIPE_TEST_MODE
   * when VITE_VERCEL_ENV is not production. See src/config/checkoutGate.ts.
   */
  checkoutEnabled: false,
  livePaymentsEnabled: false,
  /**
   * Production Vercel builds are skipped unless ENABLE_PRODUCTION_DEPLOY=1
   * is set on the Production environment. Preview builds always run.
   */
  requireExplicitProductionDeploy: true,
} as const;
