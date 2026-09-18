/* The demo UI. Plain JS, no build step — every dependency is one more thing that
   can fail live. Its only jobs: start a run, render events as English, keep the
   preview one section ahead of the conversation. */

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var started = null;
  var frameReady = false;
  var outline = [];

  /* ---------- starting a run ---------------------------------------------- */

  function start(body, isForm) {
    if (started) return;
    started = Date.now();
    $('drop').hidden = true;
    $('chat').hidden = false;
    $('answerForm').hidden = false;
    $('elapsed').hidden = false;
    tick();

    fetch('/api/run', isForm ? { method: 'POST', body: body }
                             : { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) return logRow('error', 'Could not start', d.error);
        if (d.mode && d.mode !== 'live') { $('mode').hidden = false; $('mode').textContent = d.mode; }
        listen();
      })
      .catch(function (e) { logRow('error', 'Could not start', String(e)); });
  }

  $('browse').onclick = function () { $('file').click(); };
  $('file').onchange = function () {
    if (!this.files[0]) return;
    var fd = new FormData();
    fd.append('file', this.files[0]);
    start(fd, true);
  };
  $('sample').onclick = function () { start({ path: 'proposal/sample-rfp.md', force: true }, false); };

  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (e) {
    drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (e) {
    drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (ev) {
    var f = ev.dataTransfer && ev.dataTransfer.files[0];
    if (!f) return;
    var fd = new FormData();
    fd.append('file', f);
    start(fd, true);
  });

  /* ---------- the event stream -------------------------------------------- */

  function listen() {
    var es = new EventSource('/api/events');
    es.onmessage = function (m) {
      var e;
      try { e = JSON.parse(m.data); } catch (_) { return; }
      handle(e);
    };
    es.onerror = function () { /* EventSource retries on its own */ };
  }

  function handle(e) {
    switch (e.type) {
      case 'act':
        logRow('act', e.verb, e.detail); break;

      case 'agent':
        say('agent', 'Agent', e.text); break;

      case 'question':
        say('question', 'Agent asks', e.text);
        logRow('question', 'Asked the client about the gaps');
        $('answer').focus();
        break;

      case 'answer':
        say('you', 'You', e.text); break;

      case 'rfp':
        showRfp(e.analysis);
        logRow('rfp', 'Read the RFP',
          e.analysis.requirements.length + ' requirements · ' + e.analysis.gaps.length + ' gaps');
        break;

      case 'outline':
        outline = e.sections;
        showOutline();
        logRow('outline', 'Planned the document', e.sections.length + ' sections');
        break;

      case 'section:start':
        mark(e.id, 'doing');
        tellDeck({ type: 'deck:writing', id: e.id });
        break;

      case 'section:done':
        mark(e.id, 'done');
        logRow('section:done', e.title, 'page ' + e.index + ' of ' + e.total);
        $('progress').hidden = false;
        $('progress').textContent = e.index + ' / ' + e.total;
        break;

      case 'preview':
        showPreview(e.url, e.sectionId); break;

      case 'research':
        logRow('research', 'The researcher reported back',
          e.items.map(function (s) { return s.length > 150 ? s.slice(0, 150) + '…' : s; }).join('  ·  '));
        break;

      case 'review':
        if (!e.findings.length) { logRow('review', 'The reviewer found nothing to fix'); break; }
        logRow('review', 'The reviewer found ' + e.findings.length + ' thing' +
          (e.findings.length === 1 ? '' : 's'),
          e.findings.map(function (f) { return '[' + f.severity + '] ' + f.requirement; }).join(' · '));
        break;

      case 'warn': logRow('warn', e.text); break;
      case 'error': logRow('error', e.message); break;
      case 'status': logRow('status', e.text); break;

      case 'done':
        logRow('done', 'Finished',
          e.sections + ' sections in ' + Math.round(e.elapsedMs / 1000) + 's');
        $('export').disabled = false;
        $('openfull').disabled = false;
        stopTick();
        break;
    }
  }

  /* ---------- rendering ---------------------------------------------------- */

  function say(kind, who, text) {
    var el = document.createElement('div');
    el.className = 'msg ' + kind + (text.length < 260 ? ' short' : '');
    var w = document.createElement('span');
    w.className = 'msg-who';
    w.textContent = who;
    el.appendChild(w);
    el.appendChild(document.createTextNode(text));
    if (kind === 'agent') el.onclick = function () { el.classList.add('open'); };
    var chat = $('chat');
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  }

  function logRow(kind, what, sub) {
    var li = document.createElement('li');
    li.className = 'ev-' + kind;
    var t = document.createElement('span');
    t.className = 't';
    t.textContent = started ? Math.round((Date.now() - started) / 1000) + 's' : '';
    var w = document.createElement('span');
    w.className = 'what';
    var b = document.createElement('b');
    b.textContent = what;
    w.appendChild(b);
    if (sub) {
      var s = document.createElement('span');
      s.className = 'sub';
      s.textContent = sub;
      s.title = sub;
      w.appendChild(s);
      li.onclick = function () { li.classList.toggle('open'); };
    }
    li.appendChild(t); li.appendChild(w);
    var log = $('log');
    log.appendChild(li);
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function showRfp(a) {
    var dl = $('rfpFacts');
    dl.textContent = '';
    var rows = [
      ['Client', a.client.name],
      ['Sector', a.client.sector || '—'],
      ['Country', a.client.country || '—'],
      ['Requirements', String(a.requirements.length)],
      ['Key dates', a.dates.map(function (d) { return d.label + ': ' + d.date; }).join('\n') || '—'],
      ['Gaps', a.gaps.map(function (g) { return '· ' + g.question; }).join('\n\n')]
    ];
    rows.forEach(function (r) {
      var dt = document.createElement('dt'); dt.textContent = r[0];
      var dd = document.createElement('dd'); dd.textContent = r[1]; dd.style.whiteSpace = 'pre-wrap';
      dl.appendChild(dt); dl.appendChild(dd);
    });
    $('rfpPanel').hidden = false;
  }

  function showOutline() {
    var ol = $('outlineList');
    ol.textContent = '';
    outline.forEach(function (s) {
      var li = document.createElement('li');
      li.id = 'out-' + s.id;
      li.textContent = s.title;
      li.title = s.intent;
      ol.appendChild(li);
    });
    $('outlinePanel').hidden = false;
  }

  function mark(id, state) {
    var li = document.getElementById('out-' + id);
    if (!li) return;
    if (state === 'done') li.classList.remove('doing');
    li.classList.add(state);
  }

  /* The payoff: each section lands, and the preview opens on it.
     The deck reads its own hash on load, so a cache-busted src does the whole job —
     no postMessage handshake to get wrong, and no stale frame if one is missed. */
  var pending = null;
  function showPreview(url, sectionId) {
    var frame = $('frame');
    $('framePlaceholder').hidden = true;
    frame.dataset.url = url + (sectionId ? '#sec-' + sectionId : '');
    frameReady = true;
    /* Sections can land faster than a frame loads. Coalesce. */
    clearTimeout(pending);
    pending = setTimeout(function () {
      frame.src = url + '?t=' + Date.now() + (sectionId ? '#sec-' + sectionId : '');
    }, 120);
  }

  function tellDeck(msg) {
    if (!msg.id || !frameReady) return;
    try { $('frame').contentWindow.postMessage(msg, '*'); } catch (_) { /* not loaded yet */ }
  }

  /* ---------- answering ---------------------------------------------------- */

  $('answerForm').onsubmit = function (ev) {
    ev.preventDefault();
    var box = $('answer');
    var text = box.value.trim();
    if (!text) return;
    box.value = '';
    fetch('/api/answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    }).catch(function () { logRow('error', 'Could not send that'); });
  };
  $('answer').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('answerForm').requestSubmit(); }
  });

  /* ---------- chrome ------------------------------------------------------- */

  $('export').onclick = function () {
    var b = $('export');
    b.disabled = true; b.textContent = 'Printing…';
    fetch('/api/export', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        b.textContent = 'PDF';
        b.disabled = false;
        if (d.url) window.open(d.url, '_blank');
        else logRow('error', 'Export failed', d.error);
      })
      .catch(function () { b.textContent = 'PDF'; b.disabled = false; });
  };

  $('openfull').onclick = function () {
    var url = $('frame').dataset.url;
    if (url) window.open(url, '_blank');
  };

  var timer = null;
  function tick() {
    timer = setInterval(function () {
      var s = Math.round((Date.now() - started) / 1000);
      $('elapsed').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }, 1000);
  }
  function stopTick() { if (timer) clearInterval(timer); }

  /* If a run is already going (a reload mid-demo), attach to it. */
  fetch('/healthz').then(function (r) { return r.json(); }).then(function (d) {
    if (d.mode && d.mode !== 'live') { $('mode').hidden = false; $('mode').textContent = d.mode; }
    if (d.running) { started = Date.now(); $('drop').hidden = true; $('chat').hidden = false;
      $('answerForm').hidden = false; $('elapsed').hidden = false; tick(); listen(); }
  }).catch(function () {});
})();
