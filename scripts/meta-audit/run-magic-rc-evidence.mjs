/**
 * Starts isolated harness, runs Magic evidence, then shuts down children.
 * Keeps processes in the same process group for one durable shell session.
 */
import { spawn, execFileSync } from 'node:child_process';
import { openSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const DIR = '/tmp/tdg-isolated-stripe';
const status = JSON.parse(readFileSync(`${DIR}/status.json`, 'utf8'));
if (status.API_URL !== 'http://127.0.0.1:58321') throw new Error('Unexpected local API');

const offline = process.env.TDG_OFFLINE_TEST === '1';
let key = 'sk_test_offline_fixture';
let secret = `whsec_${randomBytes(32).toString('hex')}`;
let stripeEnv;

if (!offline) {
  const expected = process.env.TDG_AUTHORIZED_STRIPE_TEST_ACCOUNT;
  const keyFile = process.env.TDG_AUTHORIZED_STRIPE_TEST_KEY_FILE;
  if (!expected?.startsWith('acct_') || !keyFile) {
    throw new Error('Authorized TDG TEST account + key file required');
  }
  key = readFileSync(resolve(keyFile), 'utf8').trim();
  if (!key.startsWith('sk_test_')) throw new Error('TEST key required');
  const accountRes = await fetch('https://api.stripe.com/v1/account', {
    headers: { authorization: `Bearer ${key}` },
  });
  const account = await accountRes.json();
  if (!accountRes.ok || account.id !== expected) {
    throw new Error('Stripe account does not match authorized TDG TEST account');
  }
  stripeEnv = { PATH: process.env.PATH, HOME: homedir(), STRIPE_API_KEY: key };
  secret = execFileSync('stripe', ['listen', '--print-secret'], {
    env: stripeEnv,
    encoding: 'utf8',
  }).trim();
  if (!secret.startsWith('whsec_')) throw new Error('TEST listener signing secret missing');
} else {
  writeFileSync(`${DIR}/offline-signing-secret`, secret, { mode: 0o600 });
}

const env = {
  PATH: process.env.PATH,
  HOME: homedir(),
  DENO_TLS_CA_STORE: 'system',
  TDG_ISOLATED_TEST: '1',
  TDG_OFFLINE_TEST: offline ? '1' : '0',
  CHRISTMAS_GENERATION_MOCK: process.env.TDG_MOCK_GENERATION === '1' ? 'true' : 'false',
  SUPABASE_URL: 'http://127.0.0.1:58421',
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY: status.ANON_KEY,
  STRIPE_SECRET_KEY: key,
  STRIPE_WEBHOOK_SECRET: secret,
  SITE_URL: 'http://127.0.0.1:58400',
  CHRISTMAS_CHECKOUT_ENABLED: 'true',
  CHRISTMAS_GENERATION_ENABLED: 'false',
  RESEND_API_KEY: 'local-capture-only',
  CHRISTMAS_EMAIL_FROM: 'audit@example.invalid',
};

const children = [];
function start(bin, args, name, childEnv = env) {
  const log = openSync(`${DIR}/${name}.log`, 'a', 0o600);
  const child = spawn(bin, args, {
    cwd: process.cwd(),
    env: childEnv,
    stdio: ['ignore', log, log],
  });
  children.push(child);
  child.on('exit', (code) => {
    if (code) console.error(`${name} exited ${code}`);
  });
  return child;
}

function shutdown() {
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(130);
});
process.on('SIGTERM', () => {
  shutdown();
  process.exit(143);
});

start('node', ['scripts/meta-audit/local-gateway.mjs'], 'gateway');
for (const [port, name, target] of [
  [58441, 'funnel', 'supabase/functions/christmas-funnel/index.ts'],
  [58442, 'webhook', 'supabase/functions/stripe-webhook/index.ts'],
  [58443, 'generation', 'supabase/functions/christmas-generate/index.ts'],
  [58444, 'events', 'supabase/functions/_christmas_v2_6d533ec7a8cac492/christmas-v2-funnel-event/index.ts'],
  [58445, 'generation-video', 'supabase/functions/christmas-generate-video/index.ts'],
]) {
  start(
    'deno',
    [
      'run',
      '--allow-env',
      '--allow-read',
      '--allow-net=127.0.0.1,api.stripe.com',
      'scripts/meta-audit/serve-function.ts',
      String(port),
      target,
    ],
    name,
  );
}
if (!offline) {
  start(
    'stripe',
    [
      'listen',
      '--events',
      'checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired',
      '--forward-to',
      'http://127.0.0.1:58421/functions/v1/stripe-webhook',
    ],
    'stripe-listener',
    stripeEnv,
  );
}

console.log(offline ? 'Harness online (offline fixture)' : 'Harness online (authorized Stripe TEST)');

// Wait for gateway
let ready = false;
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    const r = await fetch('http://127.0.0.1:58421/functions/v1/christmas-funnel', {
      method: 'OPTIONS',
    });
    if (r.status === 200) {
      ready = true;
      break;
    }
  } catch {
    /* retry */
  }
}
if (!ready) {
  shutdown();
  throw new Error('Gateway failed to become ready');
}

const evidenceEnv = {
  ...process.env,
  TDG_OFFLINE_TEST: offline ? '1' : '0',
  TDG_AUTHORIZED_STRIPE_TEST_ACCOUNT: process.env.TDG_AUTHORIZED_STRIPE_TEST_ACCOUNT,
  TDG_AUTHORIZED_STRIPE_TEST_KEY_FILE: process.env.TDG_AUTHORIZED_STRIPE_TEST_KEY_FILE,
};

const code = await new Promise((resolvePromise) => {
  const child = spawn(process.execPath, ['scripts/meta-audit/magic-video-evidence.mjs'], {
    cwd: process.cwd(),
    env: evidenceEnv,
    stdio: 'inherit',
  });
  child.on('exit', (c) => resolvePromise(c ?? 1));
});

shutdown();
process.exit(code);
