// ==UserScript==
// @name         N₂ impurity monitor (Samator SCADA)
// @namespace    n2-monitor
// @version      1.0
// @description  Dashboard for SCADA channel 1649: latest value, 2-hour average/max/min, trend and limit alarm.
// @match        https://scada.samatorgroup.com/*
// @grant        none
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  function n2monStart() {
    "use strict";
    var CHANNEL = 1649;
    var SCADA_HOST = "scada.samatorgroup.com";
  
    if (location.hostname !== SCADA_HOST) {
      if (confirm("The N₂ monitor runs on the Samator SCADA website.\n\nOpen SCADA now? When the page has loaded, click the N₂ Monitor bookmark again.")) {
        location.href = "https://" + SCADA_HOST + "/Chart/Chart?cnlNums=" + CHANNEL;
      }
      return;
    }
    if (window.top !== window.self || window.__n2monRunning) return;
    window.__n2monRunning = true;
  
    /* ---------- take over this tab ---------- */
    var lastTimer = setTimeout(function () {}, 0);
    for (var i = 1; i <= lastTimer; i++) { clearTimeout(i); clearInterval(i); }
    try { window.stop(); } catch (e) {}
    window.onresize = null;
  
    var CSS = `
  :root{
    --panel:#D3D8DD; --surface:#E8EBEE; --well:#F5F6F7; --ink:#1D2831; --muted:#55626D;
    --rule:#B4BCC4; --trend:#2A4B60; --alarm:#C42E27; --alarm-bg:#F4D6D3;
    --caution:#B97F00; --caution-bg:#F5E8C4; --focus:#1F6FB2;
    --sans:"Barlow","Segoe UI",system-ui,sans-serif;
    --cond:"Barlow Condensed","Arial Narrow","Roboto Condensed",sans-serif;
  }
  *{box-sizing:border-box}
  [hidden]{display:none !important}
  html,body{margin:0;padding:0}
  body{background:var(--panel);color:var(--ink);font:16px/1.45 var(--sans)}
  h1,h2{font-family:var(--cond);font-weight:600;margin:0;letter-spacing:.01em;color:var(--ink)}
  h1{font-size:1.75rem;line-height:1.1}
  h2{font-size:1.2rem}
  p{margin:0}
  .muted{color:var(--muted);font-size:.9rem}
  button,input,select{font:inherit;color:inherit}
  button{background:var(--ink);color:#fff;border:1px solid var(--ink);border-radius:4px;padding:.45rem .9rem;cursor:pointer;font-weight:500;line-height:1.3}
  button:hover{background:#34434f}
  button.ghost{background:transparent;color:var(--ink)}
  button.ghost:hover{background:var(--well)}
  button.danger{background:var(--alarm);border-color:var(--alarm)}
  button:disabled{opacity:.4;cursor:default}
  :focus-visible{outline:3px solid var(--focus);outline-offset:2px}
  input,select{width:100%;padding:.45rem .55rem;border:1px solid var(--rule);border-radius:4px;background:#fff;height:auto}
  label{display:block;font-size:.92rem;font-weight:500;margin-bottom:.8rem}
  label input,label select{margin-top:.25rem;font-weight:400}
  label.check{display:flex;gap:.55rem;align-items:center;font-weight:400}
  label.check input{width:auto;margin:0}
  a{color:var(--trend)}
  .app{max-width:1200px;margin:0 auto;padding:1.25rem 1.25rem 3rem}
  .top{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}
  .sub{display:flex;align-items:center;gap:.45rem;margin-top:.3rem;color:var(--muted);font-size:.92rem}
  .dot{width:.6rem;height:.6rem;border-radius:50%;background:var(--muted);flex:none}
  .dot.ok{background:var(--ink)}
  .dot.busy{background:var(--rule)}
  .dot.bad{background:var(--caution)}
  .top-actions{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
  .banner{background:var(--caution-bg);border-left:4px solid var(--caution);padding:.6rem .9rem;margin-bottom:1rem;border-radius:0 4px 4px 0;display:flex;gap:1rem;align-items:center;justify-content:space-between;flex-wrap:wrap}
  .toast{position:fixed;left:16px;bottom:16px;max-width:22rem;margin:0;z-index:10;box-shadow:0 2px 10px rgba(0,0,0,.2)}
  .readout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);border:1px solid var(--rule);border-radius:10px;background:var(--surface);overflow:hidden;margin-bottom:1rem}
  .now{padding:1.4rem 1.6rem;border-right:1px solid var(--rule)}
  .now .label{font-size:.95rem;color:var(--muted)}
  .value{font-family:var(--cond);font-weight:600;font-size:clamp(4.5rem,11vw,7.5rem);line-height:.95;font-variant-numeric:tabular-nums;margin:.2rem 0 .3rem}
  .value .unit{font-size:.28em;font-weight:500;margin-left:.35rem;color:var(--muted)}
  .stale{color:var(--caution);font-weight:600;font-size:.9rem}
  .gauge{position:relative;height:14px;background:var(--well);border:1px solid var(--rule);border-radius:3px;margin:1.1rem 0 .4rem}
  .gauge-fill{position:absolute;top:0;bottom:0;left:0;width:0;background:var(--trend);border-radius:2px 0 0 2px;transition:width .4s}
  .gauge-limit{position:absolute;top:-6px;bottom:-6px;width:3px;background:var(--alarm);left:100%}
  .gauge-caption{font-size:.9rem;color:var(--muted)}
  .alarm-state{margin-top:1rem;font-weight:600}
  .now.over{background:var(--alarm-bg)}
  .now.over .value,.now.over .alarm-state{color:var(--alarm)}
  .now.over .gauge-fill{background:var(--alarm)}
  .now.flash{animation:n2flash 1s steps(1) infinite}
  @keyframes n2flash{50%{background:var(--alarm);color:#fff}}
  .now.flash p,.now.flash span{animation:n2text 1s steps(1) infinite}
  @keyframes n2text{50%{color:#fff}}
  .now.flash .gauge{animation:n2track 1s steps(1) infinite}
  @keyframes n2track{50%{background:rgba(0,0,0,.28);border-color:#fff}}
  .now.flash .gauge-fill{animation:n2fill 1s steps(1) infinite}
  @keyframes n2fill{50%{background:#fff}}
  .now.flash .gauge-limit{animation:n2lim 1s steps(1) infinite}
  @keyframes n2lim{50%{background:var(--ink)}}
  @media (prefers-reduced-motion:reduce){.now.flash,.now.flash *{animation:none !important}}
  .stats{padding:1.4rem 1.6rem}
  .stats dl{margin:.9rem 0 .6rem;display:grid;gap:.9rem}
  .stats dl div{display:grid;grid-template-columns:6.5rem auto 1fr;align-items:baseline;gap:.6rem;border-bottom:1px solid var(--rule);padding-bottom:.6rem}
  .stats dt{color:var(--muted);font-weight:400}
  .stats dd{margin:0;font-family:var(--cond);font-weight:600;font-size:2.4rem;line-height:1;font-variant-numeric:tabular-nums}
  .stats dl span{color:var(--muted);font-size:.9rem;text-align:right}
  .stats dd.over{color:var(--alarm)}
  .card{border:1px solid var(--rule);border-radius:10px;background:var(--surface);padding:1rem 1.2rem 1.2rem;margin-bottom:1rem}
  .card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;gap:1rem;flex-wrap:wrap}
  .seg{display:inline-flex;border:1px solid var(--ink);border-radius:4px;overflow:hidden}
  .seg button{border:0;border-radius:0;background:transparent;color:var(--ink);padding:.3rem .8rem}
  .seg button[aria-pressed="true"]{background:var(--ink);color:#fff}
  .canvas-wrap{position:relative;height:320px;background:var(--well);border-radius:4px}
  canvas{display:block}
  .tip{position:absolute;pointer-events:none;background:var(--ink);color:#fff;padding:.3rem .55rem;border-radius:4px;font-size:.85rem;white-space:nowrap;transform:translate(-50%,-120%)}
  .page-link{font-size:.9rem;overflow-wrap:anywhere}
  .page-body{height:0;overflow:hidden;border-radius:4px;transition:height .25s}
  .page.open .page-body{height:620px;border:1px solid var(--rule)}
  .page-body iframe{width:100%;height:618px;border:0;background:#fff;display:block}
  .page .note{margin-top:.5rem}
  .controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}
  .box{border:1px solid var(--rule);border-radius:10px;background:var(--surface);padding:1.1rem 1.2rem}
  .box h2{margin-bottom:.8rem}
  .box p.muted{margin-top:.6rem}
  .row{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.4rem}
  .inline{display:flex;gap:.5rem;align-items:flex-end}
  .inline label{flex:1;margin-bottom:0}
  .saved{color:var(--muted);font-size:.85rem;min-height:1.2em;margin-top:.35rem}
  .log{list-style:none;margin:0;padding:0;max-height:300px;overflow:auto;font-size:.92rem}
  .log li{padding:.45rem 0;border-bottom:1px solid var(--rule);display:grid;grid-template-columns:auto 1fr;gap:.6rem}
  .log time{color:var(--muted);font-variant-numeric:tabular-nums}
  .log .a{color:var(--alarm);font-weight:600}
  .empty{color:var(--muted);font-size:.92rem}
  @media (prefers-reduced-motion:reduce){.page-body{transition:none}}
  @media (max-width:900px){
    .readout{grid-template-columns:1fr}
    .now{border-right:0;border-bottom:1px solid var(--rule)}
    .controls{grid-template-columns:1fr}
    .canvas-wrap{height:260px}
    .page.open .page-body{height:520px}
    .page-body iframe{height:518px}
  }`;
  
    var MARKUP = `
  <div class="app">
    <header class="top">
      <div>
        <h1 id="chanTitle">[${CHANNEL}] N₂ impurity</h1>
        <p class="sub"><span id="connDot" class="dot"></span><span id="connText">Starting</span></p>
      </div>
      <div class="top-actions">
        <span id="countdown" class="muted"></span>
        <button id="refreshNow" type="button">Refresh now</button>
      </div>
    </header>
  
    <div id="loginBanner" class="banner" hidden>
      <span>You are not signed in to SCADA. Sign in on the SCADA page below. Monitoring continues by itself after you sign in.</span>
      <button id="showLogin" type="button">Show sign-in</button>
    </div>
    <div id="banner" class="banner" role="alert" hidden></div>
    <div id="audioHint" class="banner toast" hidden><span>Click anywhere on this page so the browser allows the alarm sound.</span></div>
  
    <section class="readout">
      <div class="now" id="nowPanel">
        <p class="label">Latest reading</p>
        <p class="value"><span id="curVal">--</span><span class="unit" id="unit">ppm</span></p>
        <p class="muted" id="curTime">Waiting for data</p>
        <div class="gauge" aria-hidden="true"><div class="gauge-fill" id="gaugeFill"></div><div class="gauge-limit" id="gaugeLimit"></div></div>
        <p class="gauge-caption" id="gaugeCaption"></p>
        <p class="alarm-state" id="alarmState" aria-live="assertive"></p>
      </div>
      <div class="stats">
        <h2>Last 2 hours</h2>
        <dl>
          <div><dt>Average</dt><dd id="avg">--</dd><span></span></div>
          <div><dt>Maximum</dt><dd id="max">--</dd><span id="maxAt"></span></div>
          <div><dt>Minimum</dt><dd id="min">--</dd><span id="minAt"></span></div>
        </dl>
        <p class="muted" id="statSpan"></p>
      </div>
    </section>
  
    <section class="card">
      <div class="card-head">
        <h2>Trend</h2>
        <div class="seg" role="group" aria-label="Trend range">
          <button type="button" data-range="2h">2 hours</button>
          <button type="button" data-range="day">Today</button>
        </div>
      </div>
      <div class="canvas-wrap" id="chartWrap"><canvas id="chart" aria-label="Trend chart"></canvas><div id="tip" class="tip" hidden></div></div>
    </section>
  
    <section class="card page" id="pagePanel">
      <div class="card-head">
        <div>
          <h2>SCADA page</h2>
          <a id="srcLink" class="page-link" target="_blank" rel="noopener"></a>
        </div>
        <button id="togglePage" type="button" class="ghost" aria-expanded="false" aria-controls="pageBody">Show SCADA page</button>
      </div>
      <div class="page-body" id="pageBody">
        <iframe id="scadaFrame" title="Samator SCADA chart page" src="about:blank"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"></iframe>
      </div>
      <p id="frameNote" class="muted note" hidden>The SCADA page could not be shown here, so the dashboard reads it directly in the background instead.</p>
    </section>
  
    <section class="controls">
      <div class="box">
        <h2>Refresh</h2>
        <div class="inline">
          <label>Refresh every (seconds)<input id="refreshSec" type="number" min="10" step="5" inputmode="numeric"></label>
          <button id="applyRefresh" type="button">Save</button>
        </div>
        <p class="saved" id="refreshSaved"></p>
        <p class="muted">After midnight the date in the SCADA link changes to the new day by itself.</p>
        <p class="muted">Keep this tab open. It can stay in the background.</p>
      </div>
  
      <div class="box">
        <h2>Limit and alarm</h2>
        <div class="inline">
          <label>Maximum limit (<span id="limitUnit">ppm</span>)<input id="limit" type="number" step="0.01" min="0" inputmode="decimal"></label>
          <button id="saveLimit" type="button">Save</button>
        </div>
        <p class="saved" id="limitSaved"></p>
        <label class="check"><input id="alarmOn" type="checkbox"> Alarm when the reading is above the limit</label>
        <label>Alarm sound
          <select id="sound">
            <option value="siren">Siren (default)</option>
            <option value="beep">Double beep</option>
            <option value="chime">Chime</option>
            <option value="voice">Spoken warning</option>
            <option value="custom">My own sound file</option>
            <option value="none">No sound</option>
          </select>
        </label>
        <div id="customRow" hidden>
          <label>Sound file<input id="customFile" type="file" accept="audio/*"></label>
          <p class="muted" id="customName"></p>
        </div>
        <label class="check"><input id="flashOn" type="checkbox"> Flash the reading panel</label>
        <label class="check"><input id="notifyOn" type="checkbox"> Show a desktop notification</label>
        <div class="row">
          <button id="testAlarm" type="button" class="ghost">Test alarm</button>
          <button id="silence" type="button" class="danger" disabled>Silence alarm</button>
        </div>
      </div>
  
      <div class="box">
        <h2>Alarm log</h2>
        <ol id="log" class="log"></ol>
        <p id="logEmpty" class="empty">No alarms yet.</p>
      </div>
    </section>
  </div>`;
  
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
    document.documentElement.lang = "en";
    document.head.innerHTML =
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>N₂ impurity monitor</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600&display=swap" rel="stylesheet">';
    var styleEl = document.createElement("style");
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    var newBody = document.createElement("body");
    newBody.innerHTML = MARKUP;
    document.documentElement.replaceChild(newBody, document.body);
  
    /* ---------- helpers ---------- */
    var $ = function (id) { return document.getElementById(id); };
    var DEFAULTS = {refreshSec: 60, limit: 1.00, alarmOn: true, sound: "siren",
                    flashOn: true, notifyOn: false, range: "2h", customName: ""};
    var TWO_HOURS = 2 * 3600 * 1000;
    var STALE_MIN = 10;
  
    function loadJSON(key, dflt) {
      try {
        var v = JSON.parse(localStorage.getItem(key) || "null");
        if (v === null) return Array.isArray(dflt) ? [] : Object.assign({}, dflt);
        return Array.isArray(dflt) ? v : Object.assign({}, dflt, v);
      } catch (e) { return Array.isArray(dflt) ? [] : Object.assign({}, dflt); }
    }
    function saveJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  
    var settings = loadJSON("n2mon.settings", DEFAULTS);
    var events = loadJSON("n2mon.log", []);
    var customSrc = null;
    try { customSrc = localStorage.getItem("n2mon.customSound"); } catch (e) {}
    function saveSettings() { saveJSON("n2mon.settings", settings); }
  
    function fmt(v) { return (v == null || isNaN(v)) ? "--" : Number(v).toFixed(2); }
    function hhmm(iso) { return iso ? iso.slice(11, 16) : ""; }
    function clock() { return new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", second: "2-digit"}); }
    function pad2(n) { return (n < 10 ? "0" : "") + n; }
    function ymd(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
    function chartUrl(day) { return location.origin + "/Chart/Chart?cnlNums=" + CHANNEL + "&startDate=" + day; }
  
    var data = {points: [], channelName: "", unit: "ppm", statuses: {}, gapMs: 90000, url: "", serverStatus: ""};
    var pointMap = new Map();
    var finalDays = new Set();
    var hasData = false;
    function unit() { return data.unit || "ppm"; }
    function latest() { return data.points.length ? data.points[data.points.length - 1] : null; }
  
    /* ---------- reading the SCADA chart page ---------- */
    function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    function jsStr(html, name) {
      var m = html.match(new RegExp("\\b" + escapeRe(name) + "\\s*=\\s*'((?:\\\\.|[^'\\\\])*)'"));
      return m ? m[1].replace(/\\'/g, "'") : "";
    }
    function parseDisplayNumber(text) {
      var s = text.replace(/[\s\u00a0]/g, "");
      if (!s) return null;
      if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
      var v = parseFloat(s);
      return isNaN(v) ? null : v;
    }
    function isChartPage(html) { return /var\s+chartData\s*=/.test(html); }
  
    function parseChart(html) {
      var tm = html.match(/chartData\.timePoints\s*=\s*\[([\s\S]*?)\]\s*;/);
      var pm = html.match(/trend0\.points\s*=\s*\[([\s\S]*?)\]\s*;/);
      var times = [], vals = [], m;
      var TIME_RE = /\[\s*(-?\d+)\s*,\s*'([^']*)'\s*\]/g;
      var POINT_RE = /\[\s*([^,\[\]]*?)\s*,\s*(-?\d+)\s*,\s*'([^']*)'\s*\]/g;
      if (tm) while ((m = TIME_RE.exec(tm[1]))) times.push(m);
      if (pm) while ((m = POINT_RE.exec(pm[1]))) vals.push(m);
      var points = [];
      var n = Math.min(times.length, vals.length);
      for (var k = 0; k < n; k++) {
        var status = parseInt(vals[k][2], 10);
        if (status === 0) continue;                       // no data for that minute
        var v = parseDisplayNumber(vals[k][3]);           // the value shown on the chart
        if (v === null) {
          var raw = parseFloat(vals[k][1]);
          if (isNaN(raw)) continue;
          v = Math.round(raw * 100) / 100;
        }
        points.push([parseInt(times[k][1], 10), times[k][2], v, status]);
      }
      var statuses = {}, sre = /CnlStatus\(\s*(-?\d+)\s*,\s*'([^']*)'/g;
      while ((m = sre.exec(html))) statuses[m[1]] = m[2];
      var cnl = html.match(/trend0\.cnlNum\s*=\s*(\d+)/);
      var gap = html.match(/gapBetweenPoints\s*=\s*(\d+)/);
      return {
        points: points,
        cnlNum: cnl ? parseInt(cnl[1], 10) : CHANNEL,
        channelName: jsStr(html, "trend0.cnlName"),
        unit: jsStr(html, "trend0.unitName"),
        serverStatus: jsStr(html, "chartStatus"),
        statuses: statuses,
        gapMs: gap ? parseInt(gap[1], 10) : 90000
      };
    }
  
    var frame = $("scadaFrame");
    var frameBlocked = false;
    var controlledLoad = false;
  
    function frameDoc() {
      try {
        var doc = frame.contentDocument;
        var href = frame.contentWindow.location.href;
        if (!doc || !doc.documentElement || href === "about:blank") return null;
        return doc;
      } catch (e) { return null; }
    }
    function classify(html, hasPassword) {
      if (isChartPage(html)) return {html: html};
      if (hasPassword) return {login: true};
      return {unexpected: true};
    }
  
    function loadInFrame(url) {
      return new Promise(function (resolve) {
        var done = false, timer;
        function finish(r) {
          if (done) return;
          done = true; controlledLoad = false;
          clearTimeout(timer);
          frame.removeEventListener("load", onLoad);
          resolve(r);
        }
        function onLoad() {
          var href;
          try { href = frame.contentWindow.location.href; }
          catch (e) { return finish({blocked: true}); }     // error page or refused to be framed
          if (href === "about:blank") return;                // the empty starting page
          var doc = frameDoc();
          if (!doc) return finish({blocked: true});
          finish(classify(doc.documentElement.innerHTML, !!doc.querySelector("input[type=password]")));
        }
        controlledLoad = true;
        frame.addEventListener("load", onLoad);
        timer = setTimeout(function () { finish({timeout: true}); }, 60000);
        try { frame.contentWindow.location.replace(url); }
        catch (e) { frame.src = url; }
      });
    }
  
    function fetchPage(url) {
      return fetch(url, {credentials: "same-origin", cache: "no-store"}).then(function (r) {
        return r.text().then(function (html) {
          var res = classify(html, /type\s*=\s*["']?password/i.test(html));
          if (res.unexpected) res.status = r.status;
          return res;
        });
      });
    }
  
    function loadDay(day) {
      var url = chartUrl(day);
      var p = frameBlocked ? Promise.resolve({blocked: true}) : loadInFrame(url);
      return p.then(function (r) {
        if (r.blocked) {
          frameBlocked = true;
          $("frameNote").hidden = false;
          return fetchPage(url);
        }
        return r;
      });
    }
  
    function ingest(parsed) {
      if (parsed.cnlNum !== CHANNEL) return;
      parsed.points.forEach(function (p) { pointMap.set(p[0], p); });
      var keys = Array.from(pointMap.keys()).sort(function (a, b) { return a - b; });
      var newest = keys[keys.length - 1];
      keys.forEach(function (k) { if (k < newest - 2.5 * 24 * 3600 * 1000) pointMap.delete(k); });
      data.points = keys.filter(function (k) { return pointMap.has(k); }).map(function (k) { return pointMap.get(k); });
      if (parsed.channelName) data.channelName = parsed.channelName;
      if (parsed.unit) data.unit = parsed.unit;
      data.statuses = parsed.statuses;
      data.gapMs = parsed.gapMs;
      data.serverStatus = parsed.serverStatus;
      hasData = true;
    }
  
    /* ---------- refresh cycle ---------- */
    var busy = false, waitingLogin = false, pollTimer = null, nextAt = 0;
  
    function refresh() {
      if (busy) return;
      busy = true;
      clearTimeout(pollTimer);
      setConn("busy", "Updating…");
      var now = new Date();
      var today = ymd(now);
      var yesterday = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
      var days = [];
      if (now.getHours() < 3 && !finalDays.has(yesterday)) days.push(yesterday);   // 2-hour window across midnight
      days.push(today);
      data.url = chartUrl(today);
      $("srcLink").href = data.url;
      $("srcLink").textContent = data.url;
  
      var chain = Promise.resolve(null);
      days.forEach(function (day) {
        chain = chain.then(function (stop) {
          if (stop) return stop;
          return loadDay(day).then(function (r) {
            if (r.login) return "login";
            if (r.timeout) throw new Error("The SCADA page took more than 60 seconds to load.");
            if (r.unexpected) throw new Error("The SCADA site returned an unexpected page" + (r.status ? " (HTTP " + r.status + ")" : "") + ". Showing the previous data.");
            ingest(parseChart(r.html));
            if (day < today) finalDays.add(day);
            return null;
          });
        });
      });
  
      chain.then(function (stop) {
        if (stop === "login") { enterLogin(); return; }
        leaveLogin();
        hideBanner();
        render();
        setConn("ok", "Updated " + clock() + (data.serverStatus ? ". SCADA: " + data.serverStatus : ""));
      }).catch(function (e) {
        var msg = (e && e.message) || String(e);
        if (/Failed to fetch|NetworkError/i.test(msg)) msg = "Cannot reach the SCADA website. Check the network connection.";
        showBanner(msg);
        setConn("bad", "Last update failed at " + clock());
      }).then(function () {
        busy = false;
        if (!waitingLogin) schedule();
      });
    }
  
    function schedule() {
      clearTimeout(pollTimer);
      var ms = Math.max(10, Number(settings.refreshSec) || 60) * 1000;
      nextAt = Date.now() + ms;
      pollTimer = setTimeout(refresh, ms);
    }
  
    function enterLogin() {
      waitingLogin = true;
      clearTimeout(pollTimer);
      $("loginBanner").hidden = false;
      setConn("bad", "Waiting for you to sign in to SCADA");
      if (frameBlocked) {
        $("showLogin").textContent = "Open SCADA sign-in";
      } else {
        setPageOpen(true);
      }
    }
    function leaveLogin() {
      if (!waitingLogin) return;
      waitingLogin = false;
      $("loginBanner").hidden = true;
      setPageOpen(false);
    }
  
    // Watch the nested page while waiting for sign-in.
    frame.addEventListener("load", function () {
      if (controlledLoad || !waitingLogin) return;
      var doc = frameDoc();
      if (doc && !doc.querySelector("input[type=password]")) {
        setTimeout(refresh, 300);
      }
    });
    window.addEventListener("focus", function () {
      if (waitingLogin && frameBlocked) refresh();
    });
  
    $("showLogin").addEventListener("click", function () {
      if (frameBlocked) window.open(chartUrl(ymd(new Date())), "_blank");
      else { setPageOpen(true); $("pagePanel").scrollIntoView({behavior: "smooth", block: "start"}); }
    });
    $("refreshNow").addEventListener("click", function () { refresh(); });
  
    function setPageOpen(open) {
      $("pagePanel").classList.toggle("open", open);
      $("togglePage").setAttribute("aria-expanded", String(open));
      $("togglePage").textContent = open ? "Hide SCADA page" : "Show SCADA page";
    }
    $("togglePage").addEventListener("click", function () {
      var open = !$("pagePanel").classList.contains("open");
      if (open && frameBlocked) { frameBlocked = false; $("frameNote").hidden = true; }
      setPageOpen(open);
    });
  
    setInterval(function () {
      if (waitingLogin) $("countdown").textContent = "Paused until you sign in";
      else if (busy) $("countdown").textContent = "Updating…";
      else $("countdown").textContent = "Next update in " + Math.max(0, Math.round((nextAt - Date.now()) / 1000)) + " s";
      renderAge();
    }, 1000);
  
    function setConn(kind, text) { $("connDot").className = "dot " + kind; $("connText").textContent = text; }
    function showBanner(t) { $("banner").textContent = t; $("banner").hidden = false; }
    function hideBanner() { $("banner").hidden = true; }
  
    /* ---------- rendering ---------- */
    function render() {
      $("chanTitle").textContent = data.channelName ? "[" + CHANNEL + "] " + data.channelName : "Channel " + CHANNEL;
      $("unit").textContent = unit();
      $("limitUnit").textContent = unit();
      var last = latest();
      $("curVal").textContent = last ? fmt(last[2]) : "--";
      renderAge();
      renderStats();
      renderGauge();
      drawChart();
      evaluateAlarm();
    }
  
    function renderAge() {
      var el = $("curTime"), last = latest();
      if (!hasData) return;
      if (!last) { el.textContent = "No readings yet for today."; el.className = "muted"; return; }
      var status = data.statuses && data.statuses[last[3]];
      var age = Math.round((Date.now() - new Date(last[1]).getTime()) / 60000);
      if (age >= STALE_MIN && age < 24 * 60) {
        el.textContent = "No new reading for " + age + " min (last at " + hhmm(last[1]) + "). The SCADA data may have stopped.";
        el.className = "stale";
        return;
      }
      var text = "Reading at " + hhmm(last[1]);
      if (age >= 0 && age < 24 * 60) text += age < 1 ? ", just now" : ", " + age + " min ago";
      if (status) text += ". Status: " + status;
      el.textContent = text;
      el.className = "muted";
    }
  
    function windowStats() {
      var pts = data.points;
      if (!pts.length) return null;
      var end = pts[pts.length - 1][0];
      var w = pts.filter(function (p) { return p[0] > end - TWO_HOURS; });
      var sum = 0, max = w[0], min = w[0];
      w.forEach(function (p) {
        sum += p[2];
        if (p[2] >= max[2]) max = p;
        if (p[2] <= min[2]) min = p;
      });
      return {avg: sum / w.length, max: max, min: min, n: w.length, from: w[0][1], to: w[w.length - 1][1]};
    }
  
    function renderStats() {
      var s = windowStats();
      if (!s) {
        ["avg", "max", "min"].forEach(function (id) { $(id).textContent = "--"; });
        $("maxAt").textContent = $("minAt").textContent = "";
        $("statSpan").textContent = "No readings in the last 2 hours.";
        return;
      }
      $("avg").textContent = fmt(s.avg);
      $("max").textContent = fmt(s.max[2]);
      $("min").textContent = fmt(s.min[2]);
      $("max").classList.toggle("over", settings.alarmOn && s.max[2] > settings.limit);
      $("maxAt").textContent = "at " + hhmm(s.max[1]);
      $("minAt").textContent = "at " + hhmm(s.min[1]);
      $("statSpan").textContent = s.n + " readings, " + hhmm(s.from) + " to " + hhmm(s.to) + " (" + unit() + ")";
    }
  
    function renderGauge() {
      var last = latest(), lim = Number(settings.limit);
      if (!last) { $("gaugeFill").style.width = "0"; $("gaugeCaption").textContent = ""; return; }
      var scale = Math.max(lim * 1.25, last[2] * 1.1, 0.01);
      $("gaugeFill").style.width = Math.min(100, last[2] / scale * 100) + "%";
      $("gaugeLimit").style.left = "calc(" + Math.min(100, lim / scale * 100) + "% - 1px)";
      var diff = lim - last[2];
      $("gaugeCaption").textContent = "Limit " + fmt(lim) + " " + unit() + ". " +
        (diff >= 0 ? fmt(diff) + " below the limit." : fmt(-diff) + " above the limit.");
    }
  
    /* ---------- chart ---------- */
    var geom = null;
    function niceStep(raw) {
      var p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
      return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    }
    function drawChart() {
      var wrap = $("chartWrap"), cv = $("chart");
      var W = wrap.clientWidth, H = wrap.clientHeight;
      if (!W || !H) return;
      var dpr = window.devicePixelRatio || 1;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
      var g = cv.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      var css = getComputedStyle(document.documentElement);
      var col = function (n) { return css.getPropertyValue(n).trim(); };
      g.font = "13px " + col("--sans");
  
      var all = data.points, last = all[all.length - 1];
      if (!last) {
        geom = null;
        g.fillStyle = col("--muted"); g.textAlign = "center";
        g.fillText(hasData ? "No readings yet." : "Waiting for data…", W / 2, H / 2);
        return;
      }
      var pts, xa, xb;
      if (settings.range === "2h") {
        xa = last[0] - TWO_HOURS; xb = last[0];
        pts = all.filter(function (p) { return p[0] > xa; });
      } else {
        var day = last[1].slice(0, 10);
        pts = all.filter(function (p) { return p[1].indexOf(day) === 0; });
        xa = pts[0][0]; xb = Math.max(last[0], xa + 3600000);
      }
  
      var L = 50, R = 14, T = 14, B = 28, pw = W - L - R, ph = H - T - B;
      var vals = pts.map(function (p) { return p[2]; });
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      var dmin = lo, lim = Number(settings.limit), span = Math.max(hi - lo, 0.05);
      var limitIn = lim <= hi + span * 2 && lim >= lo - span * 2;
      if (limitIn) { lo = Math.min(lo, lim); hi = Math.max(hi, lim); }
      var padV = Math.max((hi - lo) * 0.12, 0.02);
      lo -= padV; hi += padV;
      if (dmin >= 0 && lo < 0) lo = 0;
      var X = function (ms) { return L + (ms - xa) / (xb - xa) * pw; };
      var Y = function (v) { return T + (hi - v) / (hi - lo) * ph; };
  
      var step = niceStep((hi - lo) / 5);
      var dec = Math.max(2, -Math.floor(Math.log10(step)));
      g.lineWidth = 1; g.strokeStyle = col("--rule"); g.fillStyle = col("--muted");
      g.textAlign = "right"; g.textBaseline = "middle";
      for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
        var y = Math.round(Y(v)) + 0.5;
        g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke();
        g.fillText(v.toFixed(dec), L - 8, y);
      }
      var hours = (xb - xa) / 3600000;
      var tick = hours <= 3 ? 15 : hours <= 8 ? 60 : 120;
      g.textAlign = "center"; g.textBaseline = "top";
      var lastLabelX = -1e9;
      pts.forEach(function (p) {
        var m = +p[1].slice(11, 13) * 60 + +p[1].slice(14, 16);
        if (m % tick) return;
        var x = Math.round(X(p[0])) + 0.5;
        if (x - lastLabelX < 44) return;
        lastLabelX = x;
        g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke();
        g.fillText(hhmm(p[1]), x, T + ph + 7);
      });
  
      var gap = (data.gapMs || 90000) + 5000;
      var path = function () {
        g.beginPath();
        var prev = null;
        pts.forEach(function (p) {
          var x = X(p[0]), y = Y(p[2]);
          if (!prev || p[0] - prev[0] > gap) g.moveTo(x, y); else g.lineTo(x, y);
          prev = p;
        });
      };
      g.lineJoin = "round"; g.lineCap = "round";
      g.strokeStyle = col("--trend"); g.lineWidth = 2; path(); g.stroke();
  
      g.textAlign = "right"; g.textBaseline = "bottom"; g.fillStyle = col("--alarm");
      if (limitIn) {
        var ly = Math.round(Y(lim)) + 0.5;
        g.save(); g.setLineDash([6, 4]); g.strokeStyle = col("--alarm"); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(L, ly); g.lineTo(L + pw, ly); g.stroke(); g.restore();
        g.fillText("Limit " + fmt(lim), L + pw - 4, ly - 3);
        g.save(); g.beginPath(); g.rect(L, T - 4, pw, ly - T + 4); g.clip();
        g.strokeStyle = col("--alarm"); g.lineWidth = 2.5; path(); g.stroke(); g.restore();
      } else {
        g.textBaseline = "top";
        g.fillText("Limit " + fmt(lim) + (lim > hi ? " is above this range" : " is below this range"), L + pw - 4, T + 2);
      }
      var lp = pts[pts.length - 1];
      g.fillStyle = (settings.alarmOn && lp[2] > lim) ? col("--alarm") : col("--trend");
      g.beginPath(); g.arc(X(lp[0]), Y(lp[2]), 4.5, 0, Math.PI * 2); g.fill();
      geom = {pts: pts, X: X, Y: Y};
    }
  
    $("chartWrap").addEventListener("mousemove", function (ev) {
      if (!geom) return;
      var r = ev.currentTarget.getBoundingClientRect(), mx = ev.clientX - r.left;
      var best = null, bd = Infinity;
      geom.pts.forEach(function (p) { var d = Math.abs(geom.X(p[0]) - mx); if (d < bd) { bd = d; best = p; } });
      var tip = $("tip");
      if (!best || bd > 30) { tip.hidden = true; return; }
      tip.textContent = hhmm(best[1]) + "  " + fmt(best[2]) + " " + unit();
      tip.style.left = Math.min(Math.max(geom.X(best[0]), 60), r.width - 60) + "px";
      tip.style.top = geom.Y(best[2]) + "px";
      tip.hidden = false;
    });
    $("chartWrap").addEventListener("mouseleave", function () { $("tip").hidden = true; });
    window.addEventListener("resize", function () { drawChart(); });
    document.querySelectorAll(".seg button").forEach(function (b) {
      b.addEventListener("click", function () {
        settings.range = b.dataset.range; saveSettings(); syncControls(); drawChart();
      });
    });
  
    /* ---------- alarm ---------- */
    var alarm = {active: false, silenced: false, testing: false};
    var sound = {ctx: null, on: false, kind: null, timer: null, audio: null};
  
    function evaluateAlarm() {
      var last = latest();
      var over = !!(settings.alarmOn && last && last[2] > Number(settings.limit));
      if (over) {
        if (!alarm.active) {
          alarm.active = true; alarm.silenced = false;
          addEvent("a", "Above limit: " + fmt(last[2]) + " " + unit() + " at " + hhmm(last[1]) + " (limit " + fmt(settings.limit) + ")");
          notify(last);
        }
        if (!alarm.silenced) startSound();
      } else {
        if (alarm.active) {
          addEvent("n", last && settings.alarmOn
            ? "Back within limit: " + fmt(last[2]) + " " + unit() + " at " + hhmm(last[1])
            : "Alarm cleared");
        }
        alarm.active = false; alarm.silenced = false;
        if (!alarm.testing) stopSound();
      }
      renderAlarm();
    }
  
    function renderAlarm() {
      var panel = $("nowPanel"), st = $("alarmState");
      var sounding = (alarm.active && !alarm.silenced) || alarm.testing;
      panel.classList.toggle("over", alarm.active || alarm.testing);
      panel.classList.toggle("flash", sounding && settings.flashOn);
      $("silence").disabled = !sounding;
      if (alarm.testing) st.textContent = "Testing the alarm.";
      else if (!settings.alarmOn) st.textContent = "Alarm is off.";
      else if (!latest()) st.textContent = "";
      else if (alarm.active && !alarm.silenced) st.textContent = "Above the limit. Alarm is sounding.";
      else if (alarm.active) st.textContent = "Above the limit. Alarm silenced until the reading goes back below the limit.";
      else st.textContent = "Within the limit.";
      var last = latest();
      var base = last ? fmt(last[2]) + " " + unit() : "N₂ monitor";
      document.title = (alarm.active ? "ALARM " : "") + base + " | N₂ monitor";
      renderAudioHint();
    }
  
    $("silence").addEventListener("click", function () {
      if (alarm.testing) endTest();
      if (alarm.active) { alarm.silenced = true; addEvent("n", "Alarm silenced"); }
      stopSound(); renderAlarm();
    });
  
    var testTimer = null;
    $("testAlarm").addEventListener("click", function () {
      ensureAudio();
      alarm.testing = true; stopSound(); startSound(); renderAlarm();
      clearTimeout(testTimer);
      testTimer = setTimeout(endTest, 5000);
    });
    function endTest() {
      clearTimeout(testTimer);
      alarm.testing = false;
      if (!(alarm.active && !alarm.silenced)) stopSound();
      renderAlarm();
    }
  
    function addEvent(kind, text) {
      events.unshift({kind: kind, text: text, at: new Date().toISOString()});
      events = events.slice(0, 100);
      saveJSON("n2mon.log", events);
      renderLog();
    }
    function renderLog() {
      var ol = $("log");
      ol.textContent = "";
      events.forEach(function (e) {
        var li = document.createElement("li");
        var t = document.createElement("time");
        var d = new Date(e.at);
        t.textContent = d.toLocaleDateString([], {day: "2-digit", month: "2-digit"}) + " " +
                        d.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
        var s = document.createElement("span");
        s.textContent = e.text;
        if (e.kind === "a") s.className = "a";
        li.appendChild(t); li.appendChild(s); ol.appendChild(li);
      });
      $("logEmpty").hidden = events.length > 0;
    }
  
    function notify(last) {
      if (!settings.notifyOn || !("Notification" in window) || Notification.permission !== "granted") return;
      try {
        new Notification("N₂ impurity above limit", {
          body: fmt(last[2]) + " " + unit() + " at " + hhmm(last[1]) + " (limit " + fmt(settings.limit) + ")",
          requireInteraction: true, tag: "n2-alarm"
        });
      } catch (e) {}
    }
  
    /* ---------- sound ---------- */
    function ensureAudio() {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!sound.ctx && C) sound.ctx = new C();
      if (sound.ctx && sound.ctx.state === "suspended") sound.ctx.resume().then(renderAudioHint, function () {});
      renderAudioHint();
    }
    function renderAudioHint() {
      var needs = settings.alarmOn && settings.sound !== "none" && settings.sound !== "voice" &&
                  (!sound.ctx || sound.ctx.state !== "running");
      $("audioHint").hidden = !needs;
    }
    ["pointerdown", "keydown"].forEach(function (t) { document.addEventListener(t, ensureAudio); });
  
    function tone(from, to, dur, type, gain, at) {
      var ctx = sound.ctx;
      if (!ctx) return;
      var t = ctx.currentTime + (at || 0);
      var o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(from, t);
      o.frequency.linearRampToValueAtTime(to, t + dur);
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      gn.gain.setValueAtTime(gain, t + dur - 0.04);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    }
    function speak() {
      if (!("speechSynthesis" in window)) { PATTERNS.beep.play(); return; }
      var last = latest();
      var msg = last
        ? "Warning. Nitrogen impurity is " + fmt(last[2]) + " p p m. The limit is " + fmt(settings.limit) + "."
        : "Warning. Nitrogen impurity alarm.";
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(msg);
      u.rate = 0.95;
      speechSynthesis.speak(u);
    }
    var PATTERNS = {
      siren: {every: 1600, play: function () { tone(650, 1300, 0.8, "sawtooth", 0.12); tone(1300, 650, 0.8, "sawtooth", 0.12, 0.8); }},
      beep:  {every: 1000, play: function () { tone(880, 880, 0.18, "square", 0.1); tone(880, 880, 0.18, "square", 0.1, 0.3); }},
      chime: {every: 3000, play: function () { [660, 880, 1100].forEach(function (f, k) { tone(f, f, 0.45, "sine", 0.25, k * 0.22); }); }},
      voice: {every: 7000, play: speak}
    };
    function soundKind() {
      if (settings.sound === "custom" && !customSrc) return "siren";
      return settings.sound;
    }
    function startSound() {
      var kind = soundKind();
      if (sound.on && sound.kind === kind) return;
      stopSound();
      if (kind === "none") return;
      sound.on = true; sound.kind = kind;
      if (kind === "custom") {
        sound.audio = new Audio(customSrc);
        sound.audio.loop = true;
        sound.audio.play().catch(function () { $("audioHint").hidden = false; });
        return;
      }
      ensureAudio();
      PATTERNS[kind].play();
      sound.timer = setInterval(PATTERNS[kind].play, PATTERNS[kind].every);
    }
    function stopSound() {
      sound.on = false; sound.kind = null;
      clearInterval(sound.timer); sound.timer = null;
      if (sound.audio) { sound.audio.pause(); sound.audio = null; }
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    }
  
    /* ---------- settings ---------- */
    function flashSaved(id, text) {
      var el = $(id);
      el.textContent = text;
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.textContent = ""; }, 3000);
    }
    function syncControls() {
      $("refreshSec").value = settings.refreshSec;
      $("limit").value = Number(settings.limit).toFixed(2);
      $("alarmOn").checked = settings.alarmOn;
      $("sound").value = settings.sound;
      $("flashOn").checked = settings.flashOn;
      $("notifyOn").checked = settings.notifyOn && ("Notification" in window) && Notification.permission === "granted";
      $("customRow").hidden = settings.sound !== "custom";
      $("customName").textContent = customSrc
        ? "Using " + (settings.customName || "your sound file") + "."
        : settings.customName
          ? settings.customName + " was too large to remember. Choose it again; until then the siren plays."
          : "Choose a sound file. Until then the siren plays.";
      document.querySelectorAll(".seg button").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.range === settings.range));
      });
    }
  
    function applyRefresh() {
      var v = Math.round(Number($("refreshSec").value));
      if (!v || v < 10) {
        $("refreshSec").value = settings.refreshSec;
        flashSaved("refreshSaved", "Use 10 seconds or more.");
        return;
      }
      settings.refreshSec = v; saveSettings();
      flashSaved("refreshSaved", "Saved. Updating every " + v + " seconds.");
      if (!busy && !waitingLogin) schedule();
    }
    $("applyRefresh").addEventListener("click", applyRefresh);
    $("refreshSec").addEventListener("keydown", function (e) { if (e.key === "Enter") applyRefresh(); });
  
    function applyLimit() {
      var raw = $("limit").value, v = Number(raw);
      if (raw === "" || isNaN(v) || v < 0) {
        $("limit").value = Number(settings.limit).toFixed(2);
        flashSaved("limitSaved", "Enter a number of 0 or more.");
        return;
      }
      settings.limit = v; saveSettings();
      flashSaved("limitSaved", "Saved. Alarm above " + fmt(v) + " " + unit() + ".");
      if (hasData) { renderStats(); renderGauge(); drawChart(); evaluateAlarm(); }
    }
    $("saveLimit").addEventListener("click", applyLimit);
    $("limit").addEventListener("keydown", function (e) { if (e.key === "Enter") applyLimit(); });
  
    $("alarmOn").addEventListener("change", function (e) {
      settings.alarmOn = e.target.checked; saveSettings();
      if (hasData) { renderStats(); drawChart(); evaluateAlarm(); } else renderAlarm();
    });
    $("sound").addEventListener("change", function (e) {
      settings.sound = e.target.value; saveSettings(); syncControls();
      if (sound.on) { stopSound(); startSound(); }
      renderAudioHint();
    });
    $("flashOn").addEventListener("change", function (e) { settings.flashOn = e.target.checked; saveSettings(); renderAlarm(); });
    $("notifyOn").addEventListener("change", function (e) {
      if (!e.target.checked) { settings.notifyOn = false; saveSettings(); return; }
      if (!("Notification" in window)) { e.target.checked = false; return; }
      Notification.requestPermission().then(function (p) {
        settings.notifyOn = p === "granted"; saveSettings(); syncControls();
      });
    });
    $("customFile").addEventListener("change", function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        customSrc = rd.result;
        settings.customName = f.name; saveSettings();
        try { localStorage.setItem("n2mon.customSound", customSrc); }
        catch (err) { try { localStorage.removeItem("n2mon.customSound"); } catch (e2) {} }
        syncControls();
        if (sound.on) { stopSound(); startSound(); }
      };
      rd.readAsDataURL(f);
    });
  
    /* ---------- start ---------- */
    syncControls();
    renderLog();
    renderAlarm();
    drawChart();
    refresh();
  }
  

  var HASH = "#n2-monitor";
  function addLauncher() {
    if (document.getElementById("n2mon-launch") || !document.body) return;
    var a = document.createElement("a");
    a.id = "n2mon-launch";
    a.href = "/Chart/Chart?cnlNums=1649" + HASH;
    a.textContent = "Open N₂ monitor";
    a.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#1D2831;color:#fff;" +
      "padding:10px 14px;border-radius:6px;font:600 14px/1.2 system-ui,sans-serif;text-decoration:none;" +
      "box-shadow:0 2px 8px rgba(0,0,0,.25)";
    document.body.appendChild(a);
  }
  if (location.hash === HASH) {
    n2monStart();
  } else {
    addLauncher();
    window.addEventListener("hashchange", function () {
      if (location.hash === HASH) n2monStart();
    });
  }
})();
