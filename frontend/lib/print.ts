/**
 * Print (or "Save as PDF") a single answer, without the sidebar or chat chrome.
 * Opens a clean window that reuses the app's stylesheets, forces the light theme
 * to save ink, and adds a small header/footer with the date and source.
 */
export function printAnswer(el: HTMLElement, title: string) {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join("\n");
  const fontVars = document.documentElement.className.replace(/\bdark\b/g, "");
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const safeTitle = title.replace(/[<>&"]/g, "");

  win.document.open();
  win.document.write(`<!doctype html>
<html lang="en" class="${fontVars}">
<head>
<meta charset="utf-8" />
<title>${safeTitle} | CalLaw</title>
${styles}
<style>
  body { background: #fff; padding: 32px; }
  .print-hide, button { display: none !important; }
  .print-header { font-family: var(--font-fraunces), Georgia, serif; border-bottom: 2px solid rgb(var(--gold-300)); padding-bottom: 12px; margin-bottom: 20px; }
  .print-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid rgb(var(--paper-300)); font-size: 11px; color: rgb(var(--ink-400)); }
  * { box-shadow: none !important; }
  @page { margin: 16mm; }
</style>
</head>
<body>
  <div class="print-header">
    <div style="font-size:22px;font-weight:600;color:rgb(var(--ink-900))">CalLaw</div>
    <div style="font-size:13px;color:rgb(var(--ink-500));font-family:var(--font-inter),sans-serif">${safeTitle} · ${date}</div>
  </div>
  ${el.outerHTML}
  <div class="print-footer">
    Laws quoted from the official text at leginfo.legislature.ca.gov. This is legal information, not legal advice.
  </div>
</body>
</html>`);
  win.document.close();
  // Give fonts and styles a moment to load before opening the print dialog.
  win.onload = () => setTimeout(() => win.print(), 300);
  return true;
}
