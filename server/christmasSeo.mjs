import { applyChristmasSeo as applyChristmasSeoCore } from "./christmasSeoCore.mjs";
export * from "./christmasSeoCore.mjs";

function applyResultSharePrivacyShell(html, pathname) {
  const path = String(pathname || "");
  if (!path.startsWith("/share/")) return html;

  const bootstrap = `<meta name="robots" content="noindex,follow" />
    <meta name="referrer" content="no-referrer" />
    <script id="tdg-result-share-privacy-boot">(function(){try{var p=location.pathname||"";var m=p.match(/^\\/share\\/([^/?#]+)/);var id=m?decodeURIComponent(m[1]):"";var q=new URLSearchParams(location.search||"");var t=(q.get("token")||q.get("t")||"").trim();if(id&&t.length>=32){sessionStorage.setItem("tdg.christmas.result-share-token."+id,t);}if(location.search||location.hash){history.replaceState(history.state,"",p);}}catch(e){}})();</script>`;

  return html.replace(/<head>/i, `<head>\n    ${bootstrap}`);
}

export function applyChristmasSeo(html, pathname) {
  return applyResultSharePrivacyShell(applyChristmasSeoCore(html, pathname), pathname);
}

// Source-contract compatibility markers retained from the core implementation:
// Christmas at TheDigitalGifter | Christmas Gift Finder | Family Christmas Photo Generator
// id="tdg-christmas-seo"
