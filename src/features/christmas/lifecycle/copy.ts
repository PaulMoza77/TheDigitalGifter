/**
 * EN/RO transactional + marketing copy for Christmas commerce lifecycle.
 * Locale must come from persisted order.locale — never webhook headers.
 */

import type { ChristmasLocale } from "../catalog";
import { normalizeLifecycleLocale } from "./engine";

export type LifecycleEmailCopy = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrap(locale: ChristmasLocale, title: string, bodyHtml: string, ctaLabel: string, ctaUrl: string, footerNote: string): string {
  return `<!doctype html><html lang="${locale}"><body style="font-family:Georgia,serif;background:#f8fafc;color:#0f172a;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b">The Digital Gifter · Christmas</p>
    <h1 style="font-size:24px;margin:0 0 12px">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="margin:24px 0"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600">${escapeHtml(ctaLabel)}</a></p>
    <p style="font-size:12px;color:#64748b;margin:0">${escapeHtml(footerNote)}</p>
  </div></body></html>`;
}

export function paymentConfirmationCopy(
  localeInput: string | null | undefined,
  input: {
    productName: string;
    amountCents: number;
    currency: string;
    orderId: string;
    nextStepUrl: string;
  },
): LifecycleEmailCopy {
  const locale = normalizeLifecycleLocale(localeInput);
  const amount = `${(input.amountCents / 100).toFixed(2)} ${input.currency.toUpperCase()}`;
  const shortId = input.orderId.slice(0, 8).toUpperCase();
  if (locale === "ro") {
    const subject = "Plata pentru Crăciun a fost confirmată";
    const title = "Plata ta a fost confirmată";
    const body = `<p>Am primit plata pentru <strong>${escapeHtml(input.productName)}</strong> (${escapeHtml(amount)}).</p>
      <p>Referință comandă: <strong>${escapeHtml(shortId)}</strong>.</p>
      <p>Urmează generarea personalizată. Îți trimitem un email când rezultatul este gata — nu promitem un timp exact.</p>`;
    return {
      subject,
      html: wrap(locale, title, body, "Vezi statusul", input.nextStepUrl, "Email tranzacțional · The Digital Gifter"),
      text: `${title}\n${input.productName} · ${amount}\nComandă ${shortId}\n${input.nextStepUrl}`,
    };
  }
  const subject = "Your Christmas payment is confirmed";
  const title = "Payment confirmed";
  const body = `<p>We received payment for <strong>${escapeHtml(input.productName)}</strong> (${escapeHtml(amount)}).</p>
    <p>Order reference: <strong>${escapeHtml(shortId)}</strong>.</p>
    <p>Personalized generation comes next. We’ll email you when your result is ready — we don’t promise an exact wait time.</p>`;
  return {
    subject,
    html: wrap(locale, title, body, "View status", input.nextStepUrl, "Transactional email · The Digital Gifter"),
    text: `${title}\n${input.productName} · ${amount}\nOrder ${shortId}\n${input.nextStepUrl}`,
  };
}

export function generationStartedCopy(
  localeInput: string | null | undefined,
  input: { productName: string; statusUrl: string },
): LifecycleEmailCopy {
  const locale = normalizeLifecycleLocale(localeInput);
  if (locale === "ro") {
    const subject = "Am început crearea videoclipului tău de Crăciun";
    const title = "Generarea a început";
    const body = `<p>Lucrăm la <strong>${escapeHtml(input.productName)}</strong>. Te anunțăm când este gata.</p>`;
    return {
      subject,
      html: wrap(locale, title, body, "Vezi statusul", input.statusUrl, "Email tranzacțional · The Digital Gifter"),
      text: `${title}\n${input.productName}\n${input.statusUrl}`,
    };
  }
  const subject = "We’ve started creating your Christmas video";
  const title = "Generation started";
  const body = `<p>We’re working on <strong>${escapeHtml(input.productName)}</strong>. We’ll let you know when it’s ready.</p>`;
  return {
    subject,
    html: wrap(locale, title, body, "View status", input.statusUrl, "Transactional email · The Digital Gifter"),
    text: `${title}\n${input.productName}\n${input.statusUrl}`,
  };
}

export function generationReadyCopy(
  localeInput: string | null | undefined,
  input: { productName: string; resultUrl: string },
): LifecycleEmailCopy {
  const locale = normalizeLifecycleLocale(localeInput);
  if (locale === "ro") {
    const subject = "Rezultatul tău de Crăciun este gata";
    const title = "Rezultatul este gata";
    const body = `<p><strong>${escapeHtml(input.productName)}</strong> este gata de vizualizat și descărcat.</p>`;
    return {
      subject,
      html: wrap(locale, title, body, "Deschide rezultatul", input.resultUrl, "Email tranzacțional · The Digital Gifter"),
      text: `${title}\n${input.productName}\n${input.resultUrl}`,
    };
  }
  const subject = "Your Christmas result is ready";
  const title = "Your result is ready";
  const body = `<p><strong>${escapeHtml(input.productName)}</strong> is ready to view and download.</p>`;
  return {
    subject,
    html: wrap(locale, title, body, "Open your result", input.resultUrl, "Transactional email · The Digital Gifter"),
    text: `${title}\n${input.productName}\n${input.resultUrl}`,
  };
}

export function generationFailedCopy(
  localeInput: string | null | undefined,
  input: { productName: string; statusUrl: string; terminal: boolean },
): LifecycleEmailCopy {
  const locale = normalizeLifecycleLocale(localeInput);
  if (locale === "ro") {
    const subject = input.terminal
      ? "Avem nevoie de un moment pentru comanda ta de Crăciun"
      : "Încă lucrăm la comanda ta de Crăciun";
    const title = input.terminal ? "Avem nevoie de ajutor manual" : "Reîncercăm generarea";
    const body = input.terminal
      ? `<p>Nu am putut finaliza <strong>${escapeHtml(input.productName)}</strong> automat. Păstrează linkul comenzii — suportul poate reîncerca fără o nouă plată.</p>`
      : `<p>Am întâmpinat o problemă temporară la <strong>${escapeHtml(input.productName)}</strong> și reîncercăm. Nu este nevoie să plătești din nou.</p>`;
    return {
      subject,
      html: wrap(locale, title, body, "Deschide comanda", input.statusUrl, "Email tranzacțional · The Digital Gifter"),
      text: `${title}\n${input.productName}\n${input.statusUrl}`,
    };
  }
  const subject = input.terminal
    ? "We need a moment with your Christmas order"
    : "We’re still working on your Christmas order";
  const title = input.terminal ? "Manual recovery needed" : "We’re retrying generation";
  const body = input.terminal
    ? `<p>We couldn’t finish <strong>${escapeHtml(input.productName)}</strong> automatically. Keep your order link — support can retry without charging again.</p>`
    : `<p>We hit a temporary issue creating <strong>${escapeHtml(input.productName)}</strong> and are retrying. You don’t need to pay again.</p>`;
  return {
    subject,
    html: wrap(locale, title, body, "Open your order", input.statusUrl, "Transactional email · The Digital Gifter"),
    text: `${title}\n${input.productName}\n${input.statusUrl}`,
  };
}

export function abandonedCheckoutCopy(
  localeInput: string | null | undefined,
  input: { productName: string; resumeUrl: string; unsubscribeUrl: string },
): LifecycleEmailCopy {
  const locale = normalizeLifecycleLocale(localeInput);
  if (locale === "ro") {
    const subject = "Vrei să termini portretul de Crăciun?";
    const title = "Comanda ta de Crăciun te așteaptă";
    const body = `<p>Ai început <strong>${escapeHtml(input.productName)}</strong>, dar plata nu s-a finalizat.</p>
      <p>Poți continua de unde ai rămas — nu creăm o plată nouă doar din acest email.</p>
      <p style="font-size:12px;color:#64748b"><a href="${escapeHtml(input.unsubscribeUrl)}">Dezabonare de la emailuri de marketing</a></p>`;
    return {
      subject,
      html: wrap(locale, title, body, "Continuă comanda", input.resumeUrl, "Marketing · The Digital Gifter"),
      text: `${title}\n${input.productName}\n${input.resumeUrl}\nUnsubscribe: ${input.unsubscribeUrl}`,
    };
  }
  const subject = "Want to finish your Christmas creation?";
  const title = "Your Christmas checkout is waiting";
  const body = `<p>You started <strong>${escapeHtml(input.productName)}</strong>, but payment wasn’t completed.</p>
    <p>You can pick up where you left off — this email alone does not create a new charge.</p>
    <p style="font-size:12px;color:#64748b"><a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe from marketing emails</a></p>`;
  return {
    subject,
    html: wrap(locale, title, body, "Resume checkout", input.resumeUrl, "Marketing · The Digital Gifter"),
    text: `${title}\n${input.productName}\n${input.resumeUrl}\nUnsubscribe: ${input.unsubscribeUrl}`,
  };
}

export function crossSellCopy(
  localeInput: string | null | undefined,
  input: {
    sourceProductName: string;
    targetProductName: string;
    targetUrl: string;
    unsubscribeUrl: string;
  },
): LifecycleEmailCopy {
  const locale = normalizeLifecycleLocale(localeInput);
  if (locale === "ro") {
    const subject = `Completează magia: ${input.targetProductName}`;
    const title = "O idee în plus pentru Crăciun";
    const body = `<p>Ți-a plăcut <strong>${escapeHtml(input.sourceProductName)}</strong>? Încearcă și <strong>${escapeHtml(input.targetProductName)}</strong>.</p>
      <p style="font-size:12px;color:#64748b"><a href="${escapeHtml(input.unsubscribeUrl)}">Dezabonare</a></p>`;
    return {
      subject,
      html: wrap(locale, title, body, "Descoperă", input.targetUrl, "Marketing · The Digital Gifter"),
      text: `${title}\n${input.targetProductName}\n${input.targetUrl}`,
    };
  }
  const subject = `Complete the set: ${input.targetProductName}`;
  const title = "One more Christmas idea";
  const body = `<p>Enjoyed <strong>${escapeHtml(input.sourceProductName)}</strong>? You might also like <strong>${escapeHtml(input.targetProductName)}</strong>.</p>
    <p style="font-size:12px;color:#64748b"><a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe</a></p>`;
  return {
    subject,
    html: wrap(locale, title, body, "Explore", input.targetUrl, "Marketing · The Digital Gifter"),
    text: `${title}\n${input.targetProductName}\n${input.targetUrl}`,
  };
}
