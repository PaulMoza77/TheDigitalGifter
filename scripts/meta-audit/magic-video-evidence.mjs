/**
 * Isolated Magic (€17) fulfillment evidence:
 * create Magic order + video jobs, pay (Stripe TEST or offline fixture),
 * mock image+video generation, assert email only after ready_for_email.
 * Never uses LIVE Stripe, production DB, or paid Higgsfield.
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const DIR = '/tmp/tdg-isolated-stripe';
const GATEWAY = 'http://127.0.0.1:58421';
const status = JSON.parse(readFileSync(`${DIR}/status.json`, 'utf8'));
if (status.API_URL !== 'http://127.0.0.1:58321') throw new Error('Unexpected local API');

const offline = process.env.TDG_OFFLINE_TEST === '1';
const serviceHeaders = {
  apikey: status.SERVICE_ROLE_KEY,
  authorization: `Bearer ${status.SERVICE_ROLE_KEY}`,
  'content-type': 'application/json',
};

const evidence = {
  scope: offline
    ? 'Isolated Magic offline fixture + mocked Higgsfield/video (no Stripe network)'
    : 'Isolated Magic authorized Stripe TEST + webhook + mocked Higgsfield/video',
  startedAt: new Date().toISOString(),
  checks: {},
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function funnel(action, input = {}) {
  const r = await fetch(`${GATEWAY}/functions/v1/christmas-funnel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...input }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`funnel ${action}: ${JSON.stringify(body)}`);
  return body;
}

async function rest(path, init = {}) {
  const r = await fetch(`${status.API_URL}${path}`, {
    ...init,
    headers: { ...serviceHeaders, ...(init.headers || {}) },
  });
  const text = await r.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

const email = `magic-rc-${Date.now()}@example.invalid`;
const order = await funnel('createOrder', {
  email,
  customerName: 'Magic RC',
  packKey: 'magic',
  photo: { contentType: 'image/png', byteSize: 12345, fileName: 'magic-rc.png' },
  sceneKeys: [
    'by-the-christmas-tree',
    'snowy-winter-portrait',
    'cozy-christmas',
    'grand-evergreen',
    'festive-dinner',
  ],
});
assert(order.packKey === 'magic', 'packKey magic');
assert(order.amountCents === 1700, 'Magic amount €17');
assert(order.videoCount === 1, 'Magic videoCount 1');
writeFileSync(`${DIR}/magic-order.json`, JSON.stringify(order), { mode: 0o600 });
evidence.order = {
  orderId: order.orderId,
  packKey: order.packKey,
  amountCents: order.amountCents,
  videoCount: order.videoCount,
};

const videosBefore = await rest(
  `/rest/v1/christmas_v2_order_videos?order_id=eq.${order.orderId}&select=id,source_scene_key,status`,
);
evidence.checks.videoJobsAtCreate = {
  http: videosBefore.status,
  count: Array.isArray(videosBefore.body) ? videosBefore.body.length : -1,
  rows: videosBefore.body,
};
assert(evidence.checks.videoJobsAtCreate.count === 1, 'Magic must insert exactly 1 video job');

const starter = await funnel('createOrder', {
  email: `starter-rc-${Date.now()}@example.invalid`,
  packKey: 'starter',
  photo: { contentType: 'image/png', byteSize: 1111, fileName: 's.png' },
});
const ultimate = await funnel('createOrder', {
  email: `ultimate-rc-${Date.now()}@example.invalid`,
  packKey: 'ultimate',
  photo: { contentType: 'image/png', byteSize: 2222, fileName: 'u.png' },
  sceneKeys: [
    'by-the-christmas-tree',
    'snowy-winter-portrait',
    'cozy-christmas',
    'grand-evergreen',
    'festive-dinner',
    'red-gold-card',
    'by-the-hearth',
    'choosing-the-star',
    'hot-chocolate',
  ],
});
const countVideos = async (id) => {
  const r = await rest(`/rest/v1/christmas_v2_order_videos?order_id=eq.${id}&select=id`);
  return Array.isArray(r.body) ? r.body.length : -1;
};
evidence.checks.videoJobCounts = {
  starter: { amountCents: starter.amountCents, videoCount: starter.videoCount, jobs: await countVideos(starter.orderId) },
  magic: { amountCents: order.amountCents, videoCount: order.videoCount, jobs: await countVideos(order.orderId) },
  ultimate: {
    amountCents: ultimate.amountCents,
    videoCount: ultimate.videoCount,
    jobs: await countVideos(ultimate.orderId),
  },
};
assert(evidence.checks.videoJobCounts.starter.jobs === 0, 'Starter 0 video jobs');
assert(evidence.checks.videoJobCounts.magic.jobs === 1, 'Magic 1 video job');
assert(evidence.checks.videoJobCounts.ultimate.jobs === 3, 'Ultimate 3 video jobs');
assert(evidence.checks.videoJobCounts.starter.amountCents === 700, 'Starter €7');
assert(evidence.checks.videoJobCounts.ultimate.amountCents === 2700, 'Ultimate €27');

const bytes = readFileSync('public/assets/funnel/christmas-before.png');
const auth = { orderId: order.orderId, publicToken: order.publicToken };
const signed = await funnel('getSignedUploadUrl', {
  ...auth,
  contentType: 'image/png',
  fileName: 'magic-rc.png',
  byteSize: bytes.length,
});
assert(new URL(signed.uploadUrl).hostname === '127.0.0.1', 'local upload only');
const uploaded = await fetch(signed.uploadUrl, {
  method: 'PUT',
  headers: { 'content-type': 'image/png' },
  body: bytes,
});
assert(uploaded.ok, 'upload failed');
await funnel('confirmUpload', { ...auth, objectPath: signed.objectPath });

let paymentPath = 'offline_fixture_rpc';

if (!offline) {
  const expected = process.env.TDG_AUTHORIZED_STRIPE_TEST_ACCOUNT;
  const keyFile = process.env.TDG_AUTHORIZED_STRIPE_TEST_KEY_FILE;
  assert(expected?.startsWith('acct_'), 'authorized account required');
  assert(keyFile, 'authorized key file required');
  const key = readFileSync(resolve(keyFile), 'utf8').trim();
  assert(key.startsWith('sk_test_'), 'TEST key required');
  const account = await fetch('https://api.stripe.com/v1/account', {
    headers: { authorization: `Bearer ${key}` },
  }).then((r) => r.json());
  assert(account.id === expected, `Stripe account mismatch: ${account.id}`);

  const checkout = await funnel('createStripeCheckout', {
    ...auth,
    uiMode: 'hosted',
    attribution: {
      utm_source: 'facebook',
      utm_medium: 'paid_social',
      utm_campaign: 'tdg_rc_magic_video',
      utm_content: 'magic_17',
    },
  });
  assert(checkout.sessionId?.startsWith('cs_test_'), 'cs_test_ required');
  assert(checkout.amountCents === 1700, 'checkout €17');
  writeFileSync(`${DIR}/magic-checkout.json`, JSON.stringify(checkout), { mode: 0o600 });
  evidence.checkout = {
    sessionId: checkout.sessionId,
    amountCents: checkout.amountCents,
    currency: checkout.currency,
  };

  // Complete TEST Checkout via Stripe payment_pages confirm (tok_visa) — no LIVE keys.
  const form = (body) =>
    fetch('https://api.stripe.com/v1/' + body.path, {
      method: body.method || 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: body.params ? new URLSearchParams(body.params) : undefined,
    }).then(async (r) => ({ http: r.status, body: await r.json() }));

  // Init payment page (creates deferred PI for hosted Checkout).
  const pageInit = await form({
    method: 'GET',
    path: `payment_pages/${checkout.sessionId}`,
  });
  evidence.checks.paymentPageInit = {
    http: pageInit.http,
    id: pageInit.body?.id,
    error: pageInit.body?.error || null,
  };

  const pm = await form({
    path: 'payment_methods',
    params: {
      type: 'card',
      'card[token]': 'tok_visa',
      'billing_details[email]': email,
      'billing_details[name]': 'Magic RC',
    },
  });
  assert(pm.http < 300 && pm.body?.id?.startsWith('pm_'), `pm create failed: ${JSON.stringify(pm.body)}`);
  evidence.checks.paymentMethod = { id: pm.body.id, livemode: pm.body.livemode };

  const confirmed = await form({
    path: `payment_pages/${checkout.sessionId}/confirm`,
    params: {
      payment_method: pm.body.id,
      expected_amount: '1700',
      expected_payment_method_type: 'card',
    },
  });
  evidence.checks.paymentPageConfirm = {
    http: confirmed.http,
    status: confirmed.body?.status,
    error: confirmed.body?.error || null,
    payment_intent: confirmed.body?.payment_intent || null,
  };
  assert(confirmed.http < 300, `payment_pages confirm failed: ${JSON.stringify(confirmed.body)}`);

  let paid = false;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const poll = await funnel('pollGenerationProgress', { publicToken: order.publicToken });
    if (poll.order?.paidAt) {
      paid = true;
      evidence.checks.webhookPaid = {
        attempt: i + 1,
        status: poll.order.status,
        amountCents: poll.order.amountCents,
        currency: poll.order.currency,
      };
      paymentPath = 'stripe_test_payment_pages_confirm_plus_listen_webhook';
      break;
    }
  }

  const session = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${checkout.sessionId}`,
    { headers: { authorization: `Bearer ${key}` } },
  ).then((r) => r.json());
  evidence.checks.stripeSession = {
    id: session.id,
    livemode: session.livemode,
    paymentStatus: session.payment_status,
    amountTotal: session.amount_total,
    currency: session.currency,
  };
  assert(session.livemode === false, 'TEST only');
  assert(session.payment_status === 'paid', `session not paid: ${session.payment_status}`);
  assert(session.amount_total === 1700, 'session amount €17');

  if (!paid) {
    const events = await fetch(
      'https://api.stripe.com/v1/events?type=checkout.session.completed&limit=30',
      { headers: { authorization: `Bearer ${key}` } },
    ).then((r) => r.json());
    const event = (events.data || []).find((e) => e.data?.object?.id === checkout.sessionId);
    assert(event && event.livemode === false, 'TEST checkout.session.completed event missing');
    const whsec = execFileSync('stripe', ['listen', '--print-secret'], {
      env: { PATH: process.env.PATH, HOME: homedir(), STRIPE_API_KEY: key },
      encoding: 'utf8',
    }).trim();
    const raw = JSON.stringify(event);
    const t = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', whsec).update(`${t}.${raw}`).digest('hex');
    const replay = await fetch(`${GATEWAY}/functions/v1/stripe-webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=${t},v1=${signature}`,
      },
      body: raw,
    });
    const replayBody = await replay.json();
    evidence.checks.manualWebhookReplay = { http: replay.status, body: replayBody };
    paymentPath = 'stripe_test_payment_pages_confirm_plus_event_replay';
    const poll = await funnel('pollGenerationProgress', { publicToken: order.publicToken });
    assert(poll.order?.paidAt, 'order still unpaid after webhook replay');
    evidence.checks.webhookPaid = {
      status: poll.order.status,
      amountCents: poll.order.amountCents,
      currency: poll.order.currency,
    };
  }
} else {
  const tryRpc = async (body) =>
    rest('/rest/v1/rpc/fulfill_christmas_v2_order_payment', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  const base = {
    p_session_id: `cs_test_fixture_magic_${order.orderId.slice(0, 8)}`,
    p_event_type: 'checkout.session.completed',
    p_payment_intent_id: `pi_fixture_magic_${order.orderId.slice(0, 8)}`,
    p_order_id: order.orderId,
    p_amount_cents: 1700,
    p_currency: 'eur',
  };
  const rejectUnpaid = await tryRpc({
    ...base,
    p_event_id: `fixture-magic-unpaid-${order.orderId}`,
    p_payment_status: 'unpaid',
  });
  assert(rejectUnpaid.status >= 400, 'unpaid must be rejected');
  evidence.checks.unpaidRejected = { http: rejectUnpaid.status, body: rejectUnpaid.body };

  const paid = await tryRpc({
    ...base,
    p_event_id: `fixture-magic-paid-${order.orderId}`,
    p_payment_status: 'paid',
  });
  assert(paid.status === 200, `fixture pay failed: ${JSON.stringify(paid.body)}`);
  evidence.checks.fixturePaid = paid.body;
}

evidence.paymentPath = paymentPath;

const gen = await fetch(`${GATEWAY}/functions/v1/christmas-generate`, {
  method: 'POST',
  headers: serviceHeaders,
  body: JSON.stringify({ order_id: order.orderId }),
});
const genBody = await gen.json();
evidence.checks.imageGeneration = { http: gen.status, body: genBody };
assert(gen.ok, `image gen failed: ${JSON.stringify(genBody)}`);

// Image finalize must not claim email-ready while videos are still outstanding.
// Mock mode may waitUntil()-enqueue and finish the video worker before this HTTP
 // response returns — in that case email may already be sent, but only after videos.
assert(
  genBody?.finalize?.ready_for_email !== true || Number(genBody?.finalize?.video_succeeded || 0) >= 1,
  'ready_for_email without videos is forbidden',
);
evidence.checks.imageFinalize = genBody?.finalize || null;

let videosAfter = await rest(
  `/rest/v1/christmas_v2_order_videos?order_id=eq.${order.orderId}&select=id,source_scene_key,status,result_path,model_name,completed_at`,
);
if (
  !Array.isArray(videosAfter.body) ||
  videosAfter.body.length !== 1 ||
  !videosAfter.body.every((v) => ['succeeded', 'ready'].includes(v.status))
) {
  const vid = await fetch(`${GATEWAY}/functions/v1/christmas-generate-video`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ order_id: order.orderId }),
  });
  const vidBody = await vid.json();
  evidence.checks.videoGeneration = { http: vid.status, body: vidBody };
  assert(vid.ok, `video gen failed: ${JSON.stringify(vidBody)}`);
  videosAfter = await rest(
    `/rest/v1/christmas_v2_order_videos?order_id=eq.${order.orderId}&select=id,source_scene_key,status,result_path,model_name,completed_at`,
  );
} else {
  evidence.checks.videoGeneration = {
    http: 200,
    body: { status: 'already_completed_via_waitUntil_enqueue' },
  };
}
evidence.checks.videosAfter = videosAfter.body;
assert(
  Array.isArray(videosAfter.body) &&
    videosAfter.body.length === 1 &&
    videosAfter.body.every((v) => ['succeeded', 'ready'].includes(v.status)),
  'Magic video must succeed under mock',
);

const poll = await funnel('pollGenerationProgress', { publicToken: order.publicToken });
evidence.checks.poll = {
  status: poll.order?.status,
  paidAt: !!poll.order?.paidAt,
  amountCents: poll.order?.amountCents,
  currency: poll.order?.currency,
  scenes: (poll.scenes || []).map((s) => ({ key: s.sceneKey, status: s.status, download: !!s.imageUrl })),
  videos: (poll.videos || []).map((v) => ({
    key: v.sourceSceneKey || v.source_scene_key,
    status: v.status,
    download: !!(v.videoUrl || v.downloadUrl || v.url),
  })),
};
assert(poll.order?.paidAt, 'order must be paid');
assert(poll.order?.amountCents === 1700, 'poll amount €17');
assert(poll.order?.currency === 'eur', 'poll currency eur');

const downloads = [];
for (const scene of poll.scenes || []) {
  if (!scene.imageUrl) continue;
  assert(new URL(scene.imageUrl).hostname === '127.0.0.1', 'nonlocal image');
  const r = await fetch(scene.imageUrl);
  downloads.push({ type: 'image', status: r.status, bytes: (await r.arrayBuffer()).byteLength });
}
for (const video of poll.videos || []) {
  const url = video.videoUrl || video.downloadUrl || video.url;
  if (!url) continue;
  assert(new URL(url).hostname === '127.0.0.1', 'nonlocal video');
  const r = await fetch(url);
  downloads.push({ type: 'video', status: r.status, bytes: (await r.arrayBuffer()).byteLength });
}
evidence.checks.downloads = downloads;
assert(downloads.some((d) => d.type === 'image' && d.status === 200 && d.bytes > 0), 'image download');
assert(downloads.some((d) => d.type === 'video' && d.status === 200 && d.bytes > 0), 'video download');

const emailAfterVideos = await rest(
  `/rest/v1/christmas_v2_email_deliveries?order_id=eq.${order.orderId}&select=*`,
);
evidence.checks.emailAfterVideos = emailAfterVideos.body;
assert(
  Array.isArray(emailAfterVideos.body) &&
    emailAfterVideos.body.some((row) => row.status === 'sent' && String(row.kind).includes('magic')),
  'magic_ready email must send after videos',
);
const emailRow = emailAfterVideos.body.find(
  (row) => row.status === 'sent' && String(row.kind).includes('magic'),
);
const videoCompletedAt = videosAfter.body[0]?.completed_at
  ? Date.parse(videosAfter.body[0].completed_at)
  : NaN;
const emailCreatedAt = emailRow?.created_at ? Date.parse(emailRow.created_at) : NaN;
evidence.checks.emailAfterVideoOrdering = {
  videoCompletedAt: videosAfter.body[0]?.completed_at || null,
  emailCreatedAt: emailRow?.created_at || null,
  emailAfterVideo: Number.isFinite(videoCompletedAt) &&
    Number.isFinite(emailCreatedAt) &&
    emailCreatedAt >= videoCompletedAt - 50,
};
assert(evidence.checks.emailAfterVideoOrdering.emailAfterVideo, 'email must not precede video completion');

try {
  const sink = readFileSync(`${DIR}/email-sink.jsonl`, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  evidence.checks.emailSinkTail = sink.slice(-3).map((m) => ({ to: m.to, subject: m.subject }));
} catch {
  evidence.checks.emailSinkTail = [];
}

evidence.finishedAt = new Date().toISOString();
evidence.ok = true;
writeFileSync(`${DIR}/magic-video-evidence.json`, JSON.stringify(evidence, null, 2), { mode: 0o600 });
appendFileSync(`${DIR}/magic-video-evidence.jsonl`, `${JSON.stringify(evidence)}\n`, { mode: 0o600 });
console.log(JSON.stringify(evidence, null, 2));
