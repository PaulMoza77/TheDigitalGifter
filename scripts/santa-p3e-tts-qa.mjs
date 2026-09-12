/**
 * P3E cheap Santa TTS audio QA (Wave 1).
 *
 * Production non-EN path (santaTts.ts auto): Replicate MiniMax first.
 * OPENAI_API_KEY unavailable in this Cloud Agent → MiniMax used for QA
 * (matches production primary for de/fr/es/it/pt/nl/pl).
 *
 * Whisper on Replicate validates spoken language/terms (same token, no new provider).
 * Fictional QA persona only. Secrets never printed.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const OUT = process.env.SANTA_P3E_OUT || "/opt/cursor/artifacts/santa-p3e-qa";
const TOKEN = String(process.env.REPLICATE_API_TOKEN || "").trim();
if (!TOKEN) {
  console.error("REPLICATE_API_TOKEN missing — cannot run live TTS QA");
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync("artifacts/santa-p3e-qa", { recursive: true });

const TTS_MODEL = "minimax/speech-02-hd";
const TTS_VOICE = "English_Trustworthy_Man";

/** Natural short Santa scripts (~35–60 words). Not mechanical EN translations. */
const SCRIPTS = {
  de: {
    localeKey: "de",
    fileTag: "de",
    name: "Emma",
    languageBoost: "German",
    mustTerms: ["Weihnachtsmann", "Weihnachten", "Emma"],
    script:
      "Ho ho ho! Hallo Emma! Der Weihnachtsmann freut sich sehr, dich zu sehen. Du bist sieben und hast deinem kleinen Bruder so liebevoll geholfen. Ich weiß, dass du gerne malst, und dein Wunsch nach einem Fahrrad ist angekommen. Bleib so freundlich! Frohe Weihnachten von Mama und Papa — und von mir!",
  },
  fr: {
    localeKey: "fr",
    fileTag: "fr",
    name: "Emma",
    languageBoost: "French",
    mustTerms: ["Père Noël", "Noël", "Emma"],
    script:
      "Ho ho ho ! Bonjour Emma ! C’est le Père Noël. Tu as sept ans et tu as aidé ton petit frère avec tant de gentillesse. J’ai vu que tu aimes dessiner, et ton vœu pour un vélo est bien arrivé. Continue d’être aussi attentionnée ! Joyeux Noël de la part de Maman et Papa — et de moi !",
  },
  es: {
    localeKey: "es",
    fileTag: "es",
    name: "Emma",
    languageBoost: "Spanish",
    mustTerms: ["Papá Noel", "Navidad", "Emma"],
    script:
      "¡Ho ho ho! ¡Hola Emma! Soy Papá Noel. Tienes siete años y has ayudado a tu hermanito con mucho cariño. Sé que te encanta dibujar, y tu deseo de una bicicleta ha llegado. ¡Sigue siendo tan amable! Feliz Navidad de parte de Mamá y Papá… ¡y de mí!",
  },
  it: {
    localeKey: "it",
    fileTag: "it",
    name: "Emma",
    languageBoost: "Italian",
    mustTerms: ["Babbo Natale", "Natale", "Emma"],
    script:
      "Ho ho ho! Ciao Emma! Sono Babbo Natale. Hai sette anni e hai aiutato il tuo fratellino con tanto amore. So che ti piace disegnare, e il tuo desiderio di una bicicletta è arrivato. Continua a essere così gentile! Buon Natale da mamma e papà — e da me!",
  },
  pt: {
    localeKey: "pt",
    fileTag: "pt-PT",
    name: "Emma",
    languageBoost: "Portuguese",
    mustTerms: ["Pai Natal", "Natal", "Emma"],
    script:
      "Ho ho ho! Olá Emma! Sou o Pai Natal. Tens sete anos e ajudaste o teu irmãozinho com muito carinho. Sei que gostas de desenhar, e o teu desejo de uma bicicleta chegou bem. Continua a ser tão gentil! Feliz Natal da Mamã e do Papá — e de mim!",
  },
  nl: {
    localeKey: "nl",
    fileTag: "nl",
    name: "Emma",
    languageBoost: "Dutch",
    mustTerms: ["Kerstman", "kerst", "Emma"],
    script:
      "Ho ho ho! Hallo Emma! De Kerstman hier. Je bent zeven en je hebt je kleine broertje zo lief geholpen. Ik weet dat je graag tekent, en je wens voor een fiets is aangekomen. Blijf zo aardig! Fijne kerst van mama en papa — en van mij!",
  },
  pl: {
    localeKey: "pl",
    fileTag: "pl",
    name: "Emma",
    languageBoost: "Polish",
    mustTerms: ["Mikołaj", "Świąt", "Emma"],
    script:
      "Ho ho ho! Cześć Emma! Tu Święty Mikołaj. Masz siedem lat i tak troskliwie pomogłaś młodszemu bratu. Wiem, że lubisz rysować, a Twoje życzenie o rower dotarło. Bądź nadal taka miła! Wesołych Świąt od Mamy i Taty — i ode mnie!",
  },
};

const HARD_NAMES = {
  de: {
    localeKey: "de",
    fileTag: "de",
    name: "Jürgen",
    languageBoost: "German",
    mustTerms: ["Jürgen", "Weihnachtsmann", "Weihnachten"],
    script:
      "Ho ho ho! Hallo Jürgen! Der Weihnachtsmann freut sich, dich zu sehen. Du bist sieben und hast deinem Bruder geholfen. Dein Wunsch nach einem Fahrrad ist angekommen. Frohe Weihnachten!",
  },
  fr: {
    localeKey: "fr",
    fileTag: "fr",
    name: "Élodie",
    languageBoost: "French",
    mustTerms: ["Élodie", "Père Noël", "Noël"],
    script:
      "Ho ho ho ! Bonjour Élodie ! C’est le Père Noël. Tu as sept ans et tu as aidé ton frère. Ton vœu pour un vélo est arrivé. Joyeux Noël !",
  },
  es: {
    localeKey: "es",
    fileTag: "es",
    name: "José",
    languageBoost: "Spanish",
    mustTerms: ["José", "Papá Noel", "Navidad"],
    script:
      "¡Ho ho ho! ¡Hola José! Soy Papá Noel. Tienes siete años y has ayudado a tu hermano. Tu deseo de una bicicleta ha llegado. ¡Feliz Navidad!",
  },
  it: {
    localeKey: "it",
    fileTag: "it",
    name: "Giorgia",
    languageBoost: "Italian",
    mustTerms: ["Giorgia", "Babbo Natale", "Natale"],
    script:
      "Ho ho ho! Ciao Giorgia! Sono Babbo Natale. Hai sette anni e hai aiutato tuo fratello. Il tuo desiderio di una bicicletta è arrivato. Buon Natale!",
  },
  pt: {
    localeKey: "pt",
    fileTag: "pt-PT",
    name: "João",
    languageBoost: "Portuguese",
    mustTerms: ["João", "Pai Natal", "Natal"],
    script:
      "Ho ho ho! Olá João! Sou o Pai Natal. Tens sete anos e ajudaste o teu irmão. O teu desejo de uma bicicleta chegou. Feliz Natal!",
  },
  nl: {
    localeKey: "nl",
    fileTag: "nl",
    name: "Sjoerd",
    languageBoost: "Dutch",
    mustTerms: ["Sjoerd", "Kerstman", "kerst"],
    script:
      "Ho ho ho! Hallo Sjoerd! De Kerstman hier. Je bent zeven en je hebt je broertje geholpen. Je wens voor een fiets is aangekomen. Fijne kerst!",
  },
  pl: {
    localeKey: "pl",
    fileTag: "pl",
    name: "Łukasz",
    languageBoost: "Polish",
    mustTerms: ["Łukasz", "Mikołaj", "Świąt"],
    script:
      "Ho ho ho! Cześć Łukasz! Tu Święty Mikołaj. Masz siedem lat i pomogłeś bratu. Twoje życzenie o rower dotarło. Wesołych Świąt!",
  },
};

function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function slugName(name) {
  return String(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function fold(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function probeDuration(file) {
  const r = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ],
    { encoding: "utf8" },
  );
  const d = Number(String(r.stdout || "").trim());
  return Number.isFinite(d) ? d : 0;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}


async function createPredictionByVersion(version, input) {
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ version, input }),
  });
  let prediction = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(prediction).slice(0, 500));
  let guard = 0;
  while (
    prediction?.status &&
    !["succeeded", "failed", "canceled"].includes(String(prediction.status)) &&
    guard < 90
  ) {
    await sleep(2000);
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    prediction = await poll.json();
    guard += 1;
  }
  return prediction;
}

async function latestModelVersion(ownerModel) {
  const res = await fetch(`https://api.replicate.com/v1/models/${ownerModel}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const j = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  const id = j?.latest_version?.id;
  if (!id) throw new Error(`no_latest_version:${ownerModel}`);
  return id;
}

async function createPrediction(model, input) {
  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input }),
  });
  let prediction = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(prediction).slice(0, 500));
  let guard = 0;
  while (
    prediction?.status &&
    !["succeeded", "failed", "canceled"].includes(String(prediction.status)) &&
    guard < 90
  ) {
    await sleep(2000);
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    prediction = await poll.json();
    guard += 1;
  }
  return prediction;
}

async function synthesize(sample, fileBase) {
  const started = Date.now();
  // Match santaTts.ts MiniMax input shape as closely as Replicate schema allows.
  const prediction = await createPrediction(TTS_MODEL, {
    text: sample.script.slice(0, 5000),
    voice_id: TTS_VOICE,
    emotion: "happy",
    english_normalization: false,
    language_boost: sample.languageBoost,
    bitrate: 128000,
    channel: "mono",
    sample_rate: 32000,
  });
  if (String(prediction.status) !== "succeeded") {
    // Retry with alternate schema keys used by some MiniMax replicas
    const retry = await createPrediction(TTS_MODEL, {
      text: sample.script.slice(0, 5000),
      voice_id: TTS_VOICE,
      emotion: "happy",
      language_boost: sample.languageBoost,
    });
    if (String(retry.status) !== "succeeded") {
      throw new Error(
        `tts_${retry.status}:${JSON.stringify(retry.error || prediction.error || retry).slice(0, 300)}`,
      );
    }
    return finalizeAudio(retry, fileBase, started, sample.languageBoost);
  }
  return finalizeAudio(prediction, fileBase, started, sample.languageBoost);
}

async function finalizeAudio(prediction, fileBase, started, languageBoost) {
  const out = prediction.output;
  const url = Array.isArray(out) ? out[0] : typeof out === "string" ? out : out?.url;
  if (!url) throw new Error("tts_missing_url");
  const dl = await fetch(url);
  if (!dl.ok) throw new Error("tts_download_failed");
  const buf = Buffer.from(await dl.arrayBuffer());
  if (buf.byteLength < 1000) throw new Error("tts_empty");
  const file = path.join(OUT, `${fileBase}.mp3`);
  fs.writeFileSync(file, buf);
  fs.copyFileSync(file, path.join("artifacts/santa-p3e-qa", `${fileBase}.mp3`));
  return {
    file,
    bytes: buf.byteLength,
    durationSec: Number(probeDuration(file).toFixed(2)),
    latencyMs: Date.now() - started,
    provider: "replicate",
    model: TTS_MODEL,
    voice: TTS_VOICE,
    languageBoost,
    estimatedCostUsd: null,
  };
}

async function transcribe(filePath) {
  try {
    const version = await latestModelVersion("openai/whisper");
    const prediction = await createPredictionByVersion(version, {
      audio: `data:audio/mpeg;base64,${fs.readFileSync(filePath).toString("base64")}`,
      model: "large-v3",
      transcription: "plain text",
      translate: false,
    });
    if (String(prediction.status) !== "succeeded") {
      throw new Error(String(prediction.error || prediction.status));
    }
    const out = prediction.output;
    let text = "";
    let detectedLanguage = null;
    if (typeof out === "string") text = out;
    else if (out && typeof out === "object") {
      detectedLanguage = out.detected_language || out.language || null;
      text = out.transcription || out.text || "";
      if (!text && Array.isArray(out.segments)) {
        text = out.segments.map((seg) => seg.text || "").join(" ").trim();
      }
      if (!text && Array.isArray(out)) text = out.join(" ");
    }
    return {
      ok: true,
      text: String(text || "").trim(),
      detectedLanguage,
      via: "openai/whisper",
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err).slice(0, 400) };
  }
}

function evaluate(sample, audio, transcript) {
  const technical =
    audio.bytes > 1000 && audio.durationSec > 2 ? "TECHNICAL_PASS" : "TECHNICAL_FAIL";
  let language = "LANGUAGE_UNVERIFIED";
  let pronunciation = "NAME_UNVERIFIED";
  let terminology = "TERMS_UNVERIFIED";
  let drift = "DRIFT_UNVERIFIED";
  const raw = String(transcript?.text || "");
  const lower = fold(raw);
  const expectedLang = {
    de: "german",
    fr: "french",
    es: "spanish",
    it: "italian",
    pt: "portuguese",
    nl: "dutch",
    pl: "polish",
  }[sample.localeKey];
  if (transcript?.ok && (lower.length > 10 || transcript.detectedLanguage)) {
    const hits = sample.mustTerms.filter((t) => lower.includes(fold(t)));
    terminology =
      hits.length >= 2 ? "TERMS_FOUND" : hits.length === 1 ? "TERMS_PARTIAL" : "TERMS_MISSING";
    pronunciation = lower.includes(fold(sample.name)) ? "NAME_OK" : "NAME_WEAK";
    const englishHeavy =
      /\b(merry christmas|hello there|i am santa claus|dear child)\b/i.test(raw) &&
      hits.length === 0;
    drift = englishHeavy ? "ENGLISH_DRIFT" : "NO_OBVIOUS_ENGLISH_DRIFT";
    const detected = fold(transcript.detectedLanguage || "");
    const langMatch = expectedLang && detected.includes(expectedLang);
    language =
      langMatch || hits.length >= 1
        ? "LANGUAGE_VALIDATED"
        : "LANGUAGE_UNCERTAIN";
  }
  const productReady =
    technical === "TECHNICAL_PASS" &&
    language === "LANGUAGE_VALIDATED" &&
    terminology !== "TERMS_MISSING" &&
    drift !== "ENGLISH_DRIFT";
  return {
    scriptWordCount: wordCount(sample.script),
    technical,
    language,
    terminology,
    pronunciation,
    drift,
    prosody: "PROSODY_NOT_PERCEPTUALLY_JUDGED",
    human_review: productReady ? "AUTOMATED_LANGUAGE_EVIDENCE" : "HUMAN_REVIEW_REQUIRED",
    product_ready: productReady ? "CANDIDATE_YES" : "NO",
  };
}

const manifest = {
  generatedAt: new Date().toISOString(),
  persona: {
    recipient: "Emma",
    age: 7,
    goodDeed: "helped little brother",
    hobby: "drawing",
    wish: "bicycle",
    sender: "Mom and Dad",
    fictional: true,
  },
  productionPath: {
    note: "santaTts.ts auto: non-en prefers Replicate MiniMax first; OpenAI tts-1-hd fallback. OPENAI_API_KEY unavailable here — MiniMax used for QA (matches non-en primary).",
    ttsModel: TTS_MODEL,
    ttsVoice: TTS_VOICE,
  },
  samples: [],
  openaiTtsCalls: 0,
  minimaxCalls: 0,
  whisperCalls: 0,
  fullVideoCalls: 0,
};

async function runSample(sample, kind) {
  const fileBase =
    kind === "hard"
      ? `santa_${sample.fileTag}_${slugName(sample.name)}`
      : `santa_${sample.fileTag}_emma`;
  console.log(`\n=== ${kind} ${sample.fileTag} → ${fileBase} ===`);
  console.log(`script_words=${wordCount(sample.script)}`);
  const audio = await synthesize(sample, fileBase);
  manifest.minimaxCalls += 1;
  console.log(`audio bytes=${audio.bytes} duration=${audio.durationSec}s`);
  const transcript = await transcribe(audio.file);
  if (transcript.ok) {
    manifest.whisperCalls += 1;
    console.log(`transcript: ${transcript.text.slice(0, 200)}`);
  } else {
    console.log(`whisper_failed: ${transcript.error}`);
  }
  const evaluation = evaluate(sample, audio, transcript);
  const row = {
    kind,
    locale: sample.fileTag,
    localeKey: sample.localeKey,
    name: sample.name,
    script: sample.script,
    transcript: transcript.ok ? transcript.text : null,
    transcriptError: transcript.ok ? null : transcript.error || null,
    audio,
    evaluation,
  };
  manifest.samples.push(row);
  fs.writeFileSync(path.join(OUT, `${fileBase}.json`), JSON.stringify(row, null, 2));
  console.log(JSON.stringify(evaluation));
  return row;
}

const argvLocales = process.argv.slice(2).filter((a) => SCRIPTS[a]);
const skipHard = process.argv.includes("--skip-hard");
const hardOnly = process.argv.includes("--hard-only");
const locales = argvLocales.length ? argvLocales : Object.keys(SCRIPTS);

if (!hardOnly) {
  for (const key of locales) {
    await runSample(SCRIPTS[key], "standard");
  }
}

if (!skipHard) {
  for (const key of locales) {
    if (hardOnly) {
      await runSample(HARD_NAMES[key], "hard");
      continue;
    }
    const standard = manifest.samples.find(
      (s) => s.kind === "standard" && s.localeKey === key,
    );
    if (standard?.evaluation?.technical === "TECHNICAL_PASS") {
      await runSample(HARD_NAMES[key], "hard");
    }
  }
}

fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
fs.copyFileSync(path.join(OUT, "manifest.json"), "artifacts/santa-p3e-qa/manifest.json");
console.log("\nDONE", {
  minimaxCalls: manifest.minimaxCalls,
  whisperCalls: manifest.whisperCalls,
  openaiTtsCalls: manifest.openaiTtsCalls,
  candidates: manifest.samples
    .filter((s) => s.evaluation.product_ready === "CANDIDATE_YES")
    .map((s) => `${s.locale}:${s.kind}`),
});
