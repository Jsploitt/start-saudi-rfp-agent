# Versions — operator UI

## v1, 2026-09-20 — archived

`index.html`, `app.js`, `app.css`, moved here from `public/` on 2026-09-20 and
superseded by the React application in `web/`.

Nothing was deleted. These three files are the last working state of the
plain-JS UI and remain the reference for two things:

- The `handle(e)` switch in `app.js` (line 84) is the original specification of
  what the operator UI renders for each event on the wire. `web/src/state/runReducer.ts`
  reproduces it case for case and should be read alongside it.
- The `.lockup` crop maths in `app.css` (line 18) is measured against the
  content box of `mark-color.png` / `mark-light.png`, which are padded into a
  1080² frame and are 93% transparent. It is carried over verbatim into
  `web/src/index.css`.

### What it was

One screen: a three-column grid at `30fr 25fr 45fr` holding the conversation,
an activity log and an iframe preview, on `<body data-surface="dark">` so the
whole application sat in the brand's navy register.

### Why it was replaced

- One screen with no session history, and no structured intake, so the client's
  legal name and target date were inferred from the RFP rather than asked for.
- The UI only updated when a discrete event arrived. The researcher can run for
  90 seconds and the reviewer for 120 without emitting anything, so roughly
  three and a half minutes of a nine-minute run showed a screen that did not
  move. The `heartbeat` event and `web/src/components/AgentStatus.tsx` exist to
  answer that.
- The activity log held a permanent quarter of the screen while being reference
  material rather than something to watch.

### What carried over unchanged

- Collapsing consecutive identical log rows into one with a ×N counter
  (`app.js` line 210).
- Coalescing preview reloads on a 120ms timer, because sections can land faster
  than an iframe loads (`app.js` line 299).
- Re-attaching to a run already in progress via `/healthz` on load, which is
  what makes a reload mid-demo survivable (`app.js` line 420).

### Note for whoever is rebuilding the server

`public/index.html` no longer exists, so `express.static(PUBLIC_DIR)` has no
index to serve at `/`. The built React app (`web/` → `dist/`, emitted with
`assetsDir: 'app'`) is what should be served there instead. `public/assets/`
and `public/tokens.css` are untouched and must stay where they are: the
generated proposal references `/assets/fonts/...` and `/assets/logo-*.png` by
absolute path.
