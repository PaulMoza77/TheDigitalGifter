const imageUrl =
  "https://d3u0tzju9qaucj.cloudfront.net/eac55040-2e53-4622-bd70-3989fb648809/75a26655-ae37-418c-9c52-37cc81453b01.jpeg";
const prompt =
  "Tilt down from the window to the bed, focusing on the inviting layers of blankets and pillows, with a soft fade effect. Slow cinematic camera movement only.";
const combined = String(process.env.HF_CREDENTIALS || "").trim();
const splitAt = combined.indexOf(":");
const keyId = combined.slice(0, splitAt).trim();
const secret = combined.slice(splitAt + 1).trim();
const auth = `Key ${keyId}:${secret}`;
const base = "https://platform.higgsfield.ai";
async function j(method, path, body) {
  const r = await fetch(base + path, {
    method,
    headers: { Authorization: auth, Accept: "application/json", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let p = {};
  try {
    p = JSON.parse(t);
  } catch {
    p = { raw: t.slice(0, 200) };
  }
  return { status: r.status, p };
}
(async () => {
  const est = await j("POST", "/estimate/kling-video/v3.0/pro/image-to-video", {
    image_url: imageUrl,
    prompt,
    duration: 5,
    sound: "off",
  });
  console.log(JSON.stringify({ step: "estimate", ...est }));
  const sub = await j("POST", "/kling-video/v3.0/pro/image-to-video", {
    image_url: imageUrl,
    prompt,
    duration: 5,
    sound: "off",
  });
  console.log(JSON.stringify({ step: "submit", ...sub }));
  const id = sub.p.request_id;
  if (!id) return;
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await j("GET", `/requests/${id}/status`);
    console.log(JSON.stringify({ step: "poll", i, status: st.p.status, http: st.status }));
    const s = String(st.p.status || "").toLowerCase();
    if (["completed", "succeeded", "success", "failed", "error", "cancelled"].includes(s)) {
      console.log(JSON.stringify({ step: "terminal", body: st.p }));
      break;
    }
  }
})().catch((e) => console.error(String(e)));
