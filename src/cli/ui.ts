// The dev server's page: one self-contained document (no build, no CDN), so
// it works offline and ships inside the CLI bundle.

export const DEV_UI_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Email preview · @unitpost/email</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fafaf9; --surface: #ffffff; --border: #e7e5e4; --text: #1c1917; --muted: #78716c;
    --accent: #1c1917; --accent-text: #fafaf9; --active: #f5f5f4; --fix: #b91c1c; --check: #a16207; --ok: #15803d;
    --stage: #f5f5f4;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0c0a09; --surface: #1c1917; --border: #292524; --text: #f5f5f4; --muted: #a8a29e;
      --accent: #f5f5f4; --accent-text: #1c1917; --active: #292524; --fix: #f87171; --check: #facc15; --ok: #4ade80;
      --stage: #0c0a09;
    }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { display: grid; grid-template-columns: 240px 1fr; background: var(--bg); color: var(--text);
    font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  aside { border-right: 1px solid var(--border); background: var(--surface); overflow: auto; padding: 12px 8px; }
  aside h1 { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin: 4px 8px 10px; }
  aside a { display: block; padding: 6px 10px; border-radius: 8px; color: inherit; text-decoration: none; overflow-wrap: anywhere; }
  aside a:hover { background: var(--active); }
  aside a[aria-current="page"] { background: var(--active); font-weight: 600; }
  aside .empty { color: var(--muted); padding: 6px 10px; }
  main { display: grid; grid-template-rows: auto 1fr; min-width: 0; }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--surface); }
  header .title { font-weight: 600; margin-right: auto; overflow-wrap: anywhere; }
  .seg { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; padding: 2px; }
  .seg button { border: 0; background: none; color: var(--muted); font: inherit; padding: 4px 12px; border-radius: 999px; cursor: pointer; }
  .seg button[aria-pressed="true"] { background: var(--active); color: var(--text); font-weight: 600; }
  form.send { display: inline-flex; gap: 6px; }
  form.send input { font: inherit; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg); color: var(--text); width: 210px; }
  form.send button { font: inherit; padding: 5px 14px; border-radius: 999px; border: 0; background: var(--accent); color: var(--accent-text); cursor: pointer; }
  form.send button:disabled { opacity: .5; cursor: default; }
  .note { color: var(--muted); font-size: 12px; }
  .stage { overflow: auto; background: var(--stage); padding: 24px 16px; display: flex; justify-content: center; align-items: flex-start; }
  iframe { border: 0; background: transparent; width: 640px; max-width: 100%; height: 100%; min-height: 70vh; border-radius: 12px; }
  pre { margin: 0; width: 100%; max-width: 960px; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
  ul.hints { list-style: none; margin: 0; padding: 0; width: 100%; max-width: 720px; display: grid; gap: 8px; }
  ul.hints li { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; }
  ul.hints b { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; margin-right: 8px; }
  .fix { color: var(--fix); } .check { color: var(--check); } .ok { color: var(--ok); }
  @media (max-width: 720px) { body { grid-template-columns: 1fr; grid-template-rows: auto 1fr; } aside { max-height: 30vh; border-right: 0; border-bottom: 1px solid var(--border); } }
</style>
</head>
<body>
<aside><h1>Emails</h1><nav id="list"></nav></aside>
<main>
  <header>
    <span class="title" id="title">No email selected</span>
    <span class="seg" id="tabs">
      <button data-tab="preview" aria-pressed="true">Preview</button>
      <button data-tab="html" aria-pressed="false">HTML</button>
      <button data-tab="text" aria-pressed="false">Text</button>
      <button data-tab="checks" aria-pressed="false" id="checks-tab">Checks</button>
    </span>
    <span class="seg" id="widths">
      <button data-width="640" aria-pressed="true">Desktop</button>
      <button data-width="375" aria-pressed="false">Mobile</button>
    </span>
    <span class="seg" id="schemes">
      <button data-scheme="light" aria-pressed="true">Light</button>
      <button data-scheme="dark" aria-pressed="false">Dark</button>
    </span>
    <form class="send" id="send">
      <input type="email" name="to" placeholder="you@example.com" required aria-label="Send a test to" />
      <button type="submit">Send test</button>
    </form>
    <span class="note" id="status"></span>
  </header>
  <div class="stage" id="stage"></div>
</main>
<script>
  const state = { id: null, tab: "preview", width: 640, scheme: "light", data: null, canSend: false, sending: false };
  // Each load gets a number; a response that arrives after a newer load
  // started is dropped, so the page never shows (or sends) another email.
  let loadSeq = 0;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function pressed(groupId, attr, value) {
    for (const b of $(groupId).querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset[attr] === String(value)));
  }

  async function loadList() {
    const res = await fetch("/api/emails");
    const { emails, canSend } = await res.json();
    state.canSend = canSend;
    $("send").querySelector("button").title = canSend ? "" : "Set UNITPOST_API_KEY and UNITPOST_FROM to send a test through Unitpost";
    $("list").innerHTML = emails.length
      ? emails.map((e) => '<a href="#' + encodeURIComponent(e.id) + '">' + esc(e.name) + "</a>").join("")
      : '<p class="empty">No emails in this folder yet.</p>';
    if (!state.id && emails.length && !location.hash) location.hash = encodeURIComponent(emails[0].id);
    markCurrent();
  }

  function markCurrent() {
    for (const a of $("list").querySelectorAll("a")) {
      if (a.getAttribute("href") === "#" + encodeURIComponent(state.id ?? "")) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  }

  async function loadEmail() {
    const seq = ++loadSeq;
    const id = decodeURIComponent(location.hash.slice(1)) || null;
    if (id !== state.id) state.data = null;
    state.id = id;
    markCurrent();
    if (!id) return draw();
    const res = await fetch("/api/email?id=" + encodeURIComponent(id));
    const data = res.ok ? await res.json() : { id, error: "Not found", hints: [] };
    if (seq !== loadSeq) return;
    state.data = data;
    draw();
  }

  function draw() {
    const d = state.data;
    $("title").textContent = state.id ?? "No email selected";
    const n = d && d.hints ? d.hints.length : 0;
    $("checks-tab").textContent = n ? "Checks (" + n + ")" : "Checks";
    const stage = $("stage");
    $("send").querySelector("button").disabled = state.sending || !d || !!d.error || d.id !== state.id;
    if (!d) { stage.innerHTML = '<p class="note">Loading…</p>'; return; }
    if (d.error) { stage.innerHTML = '<pre class="fix">' + esc(d.error) + "</pre>"; return; }
    if (state.tab === "preview") {
      const frame = document.createElement("iframe");
      frame.title = "Email preview";
      // No allow-scripts: the previewed template must not run script in this
      // page's origin (V140). allow-same-origin keeps contentDocument readable
      // for the height measurement below.
      frame.setAttribute("sandbox", "allow-same-origin");
      frame.style.width = state.width + "px";
      frame.style.colorScheme = state.scheme;
      frame.srcdoc = d.html;
      frame.addEventListener("load", () => {
        const doc = frame.contentDocument;
        if (doc) frame.style.height = Math.max(doc.documentElement.scrollHeight, 400) + "px";
      });
      stage.replaceChildren(frame);
    } else if (state.tab === "html") {
      stage.innerHTML = "<pre>" + esc(d.html) + "</pre>";
    } else if (state.tab === "text") {
      stage.innerHTML = "<pre>" + esc(d.text) + "</pre>";
    } else {
      stage.innerHTML = d.hints.length
        ? '<ul class="hints">' + d.hints.map((h) => '<li><b class="' + h.severity + '">' + h.severity + "</b>" + esc(h.message) + "</li>").join("") + "</ul>"
        : '<ul class="hints"><li><b class="ok">ok</b>No design hints. Contrast, alt text, links and structure pass.</li></ul>';
    }
    $("status").textContent = (d.bytes / 1024).toFixed(1) + " KB" + (d.bytes > 102 * 1024 ? " · Gmail clips over 102 KB" : "");
  }

  $("tabs").addEventListener("click", (e) => { const t = e.target.dataset.tab; if (t) { state.tab = t; pressed("tabs", "tab", t); draw(); } });
  $("widths").addEventListener("click", (e) => { const w = e.target.dataset.width; if (w) { state.width = Number(w); pressed("widths", "width", w); draw(); } });
  $("schemes").addEventListener("click", (e) => { const s = e.target.dataset.scheme; if (s) { state.scheme = s; pressed("schemes", "scheme", s); draw(); } });
  $("send").addEventListener("submit", async (e) => {
    e.preventDefault();
    const shown = state.data;
    // One send at a time: each request carries a fresh idempotency key, so a
    // second click while the first is in flight would send the email twice.
    if (state.sending || !shown || shown.error || shown.id !== state.id) return;
    if (!state.canSend) { $("status").textContent = "Set UNITPOST_API_KEY and UNITPOST_FROM, then restart, to send a test. Or copy the HTML tab into any provider."; return; }
    const button = e.target.querySelector("button");
    state.sending = true;
    button.disabled = true;
    $("status").textContent = "Sending…";
    try {
      const res = await fetch("/api/send", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: shown.id, to: new FormData(e.target).get("to") }) });
      const body = await res.json().catch(() => ({}));
      $("status").textContent = res.ok ? "Sent " + shown.id + "." : body.error || "Send failed.";
    } catch (err) {
      $("status").textContent = "Send failed: " + err.message;
    } finally {
      state.sending = false;
      const d = state.data;
      button.disabled = !d || !!d.error || d.id !== state.id;
    }
  });
  window.addEventListener("hashchange", loadEmail);
  new EventSource("/events").onmessage = () => { loadList(); loadEmail(); };
  loadList().then(loadEmail);
</script>
</body>
</html>
`;
