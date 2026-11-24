import type { PrintProvider } from "./providers";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Printable gift card as HTML (open → Print → Save as PDF).
 * QR uses a public QR image API with only the gift URL (no PII in path beyond token).
 */
export const htmlPrintProvider: PrintProvider = {
  id: "html-print-v1",
  async giftCardHtml({ recipientName, fromName, giftUrl, dedication }) {
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(giftUrl)}`;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Gift card for ${escapeHtml(recipientName)}</title>
<style>
  @page { size: A5; margin: 14mm; }
  body { font-family: Georgia, serif; color: #1a0c10; background: #f6efe3; }
  .card { border: 1px solid #d4b36a; padding: 28px; min-height: 70vh; display: grid; gap: 16px; place-items: center; text-align: center; }
  h1 { font-size: 28px; font-weight: 600; margin: 0; }
  p { margin: 0; line-height: 1.5; max-width: 36ch; }
  .from { letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; color: #6b1420; }
  img { width: 180px; height: 180px; }
  .url { font-family: system-ui, sans-serif; font-size: 11px; word-break: break-all; color: #555; }
</style>
</head>
<body>
  <div class="card">
    <p class="from">A Christmas story for</p>
    <h1>${escapeHtml(recipientName)}</h1>
    <p>${escapeHtml(dedication.slice(0, 280))}</p>
    <img src="${qr}" alt="QR code to open the private gift" width="180" height="180"/>
    <p>Scan to open · From ${escapeHtml(fromName || "someone who loves you")}</p>
    <p class="url">${escapeHtml(giftUrl)}</p>
  </div>
  <script>window.onload=function(){/* print manually */}</script>
</body>
</html>`;
  },
};

export const activePrintProvider: PrintProvider = htmlPrintProvider;
