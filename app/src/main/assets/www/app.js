(function () {
  'use strict';
  var A = window.Android || null;

  // ---------- Config ----------
  var DOCK_KEY = 'navy.dock.v2';
  var IDLE_MS = 5 * 60 * 1000;          // screensaver after 5 minutes idle
  var ROTATE_MS = 15 * 60 * 1000;       // new wallpaper every 15 minutes
  var SAVER_ROTATE_MS = 60 * 1000;      // faster while screensaver is on
  var LAT = -41.29, LON = 174.78;       // default location for weather
  var PS5_DEFAULT = 2;                  // fallback HDMI port for the PS5
  var AIRPLAY_PKGS = ['io.github.jqssun.airplay', 'com.ionitech.airscreen'];

  var KNOWN = [
    ['YouTube',    'com.google.android.youtube.tv',      'youtube.svg'],
    ['Spotify',    'com.spotify.tv.android',              'spotify.svg'],
    ['HBO Max',    'com.wbd.stream',                      'hbomax.png'],
    ['Disney+',    'com.disney.disneyplus',               'disneyplus.svg'],
    ['Netflix',    'com.netflix.ninja',                   'netflix.svg'],
    ['Prime Video','com.amazon.amazonvideo.livingroom',   'primevideo.svg'],
    ['Apple TV',   'com.apple.atve.androidtv.appletv',    'appletv.svg'],
    ['Stremio',    'com.stremio.one',                     'stremio.svg']
  ];
  var DEFAULT_DOCK = ['com.google.android.youtube.tv', 'com.spotify.tv.android', 'com.wbd.stream',
    'com.disney.disneyplus', 'com.netflix.ninja', 'com.amazon.amazonvideo.livingroom', 'com.apple.atve.androidtv.appletv'];

  function $(id) { return document.getElementById(id); }
  function knownFor(pkg) { for (var i = 0; i < KNOWN.length; i++) if (KNOWN[i][1] === pkg) return KNOWN[i]; return null; }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 4500);
  }
  function launch(pkg, name) {
    if (!A) { toast('Preview only: ' + name); return; }
    if (!A.launch(pkg)) toast(name + ' is not installed on this TV');
  }
  function installed(pkg) { return A ? A.isInstalled(pkg) : true; }

  // ---------- Dock state ----------
  var dock = loadDock();
  function loadDock() {
    try {
      var s = JSON.parse(localStorage.getItem(DOCK_KEY));
      if (Array.isArray(s) && s.length) return s.filter(function (x) { return x && x.pkg; });
    } catch (e) {}
    return defaultDock();
  }
  function defaultDock() {
    return DEFAULT_DOCK.map(function (p) { var k = knownFor(p); return { name: k[0], pkg: p, icon: k[2] }; });
  }
  function saveDock() { try { localStorage.setItem(DOCK_KEY, JSON.stringify(dock)); } catch (e) {} }
  function dockIndex(pkg) { for (var i = 0; i < dock.length; i++) if (dock[i].pkg === pkg) return i; return -1; }

  // ---------- Tiles ----------
  function tile(label, inner, sub, onActivate, missing) {
    var b = document.createElement('button');
    b.className = 'f tile' + (missing ? ' missing' : '');
    b.innerHTML = inner + '<div class="label"></div>' + (sub ? '<div class="sub"></div>' : '');
    b.querySelector('.label').textContent = label;
    if (sub) b.querySelector('.sub').textContent = sub;
    b.addEventListener('click', onActivate);
    return b;
  }

  function buildApps(focusIdx) {
    var row = $('rowApps'); row.innerHTML = '';
    dock.forEach(function (it, idx) {
      var inner;
      if (it.icon) inner = '<img src="icons/' + it.icon + '" class="' + (/\.png$/.test(it.icon) ? 'wide' : '') + '" alt="">';
      else { var src = A ? A.appLogo(it.pkg) : ''; inner = '<img class="native" alt="" ' + (src ? 'src="' + src + '"' : '') + '>'; }
      var t = tile(it.name, inner, '', function () { launch(it.pkg, it.name); }, !installed(it.pkg));
      t._long = function () { dockMenu(idx, t); };
      row.appendChild(t);
    });
    var add = tile('Add app', '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>', 'Hold OK on apps to edit', function () { openApps(true); });
    add.classList.add('addtile');
    row.appendChild(add);
    if (typeof focusIdx === 'number') {
      var tiles = row.querySelectorAll('.f');
      var t2 = tiles[Math.max(0, Math.min(focusIdx, tiles.length - 1))];
      if (t2) t2.focus();
    }
  }

  function renameDialog(idx) {
    var it = dock[idx];
    var wrap = document.createElement('div'); wrap.id = 'rename';
    wrap.innerHTML = '<div class="rbox"><div class="rt">Rename app</div><input id="rin" type="text" maxlength="18"><div class="rh">Type a name, then press OK on the keyboard. Back to cancel.</div></div>';
    document.body.appendChild(wrap);
    var inp = wrap.querySelector('input'); inp.value = it.name; inp.focus(); inp.select();
    function done(save) {
      if (save && inp.value.trim()) { it.name = inp.value.trim(); saveDock(); }
      document.body.removeChild(wrap); buildApps(idx);
    }
    inp.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); done(true); }
      else if (e.key === 'Escape' || e.key === 'Backspace' && !inp.value && false) { e.preventDefault(); done(false); }
    });
    wrap._cancel = function () { done(false); };
    window._renameOpen = wrap;
  }

  function dockMenu(idx, from) {
    var it = dock[idx];
    var acts = [
      { label: 'Open', fn: function () { launch(it.pkg, it.name); } },
      { label: 'Move left', fn: function () { if (idx > 0) { var x = dock.splice(idx, 1)[0]; dock.splice(idx - 1, 0, x); saveDock(); buildApps(idx - 1); } } },
      { label: 'Move right', fn: function () { if (idx < dock.length - 1) { var x = dock.splice(idx, 1)[0]; dock.splice(idx + 1, 0, x); saveDock(); buildApps(idx + 1); } } },
      { label: 'Rename', fn: function () { renameDialog(idx); } },
      { label: 'Remove from home', fn: function () { dock.splice(idx, 1); saveDock(); buildApps(idx); toast(it.name + ' removed. Add it back from Apps (hold OK on it).'); } },
      { label: 'Reset to default', fn: function () { dock = defaultDock(); saveDock(); buildApps(0); toast('Home apps reset'); } }
    ];
    openMenu(it.name, acts, from);
  }

  // ---------- Inputs row ----------
  var ICON_MONITOR = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/></svg>';
  var ICON_MIRROR = '<svg viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="12" rx="1.5"/><path d="M7 20h10M9 20l3-4 3 4"/></svg>';
  var ICON_CAST = '<svg viewBox="0 0 24 24"><path d="M3 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M3 12a9 9 0 0 1 9 9M3 16a5 5 0 0 1 5 5M3 20h.01"/></svg>';
  function airPkg() { if (!A) return AIRPLAY_PKGS[0]; for (var i = 0; i < AIRPLAY_PKGS.length; i++) if (A.isInstalled(AIRPLAY_PKGS[i])) return AIRPLAY_PKGS[i]; return null; }

  function buildInputs() {
    var row = $('rowInputs'); row.innerHTML = '';
    var list = [];
    try { list = A ? JSON.parse(A.hdmiInputs()) : [{ id: 'a', label: 'HDMI 1' }, { id: 'b', label: 'HDMI 2' }, { id: 'c', label: 'HDMI 3' }]; } catch (e) {}
    function portNum(x) { var m = /(\d+)/.exec(x.label || ''); if (m) return +m[1]; m = /(\d+)/.exec(x.custom || ''); return m ? +m[1] : 99; }
    list.sort(function (p, q) { return portNum(p) - portNum(q); });
    function open(inp, name) {
      if (!A) { toast('Preview only: ' + name); return; }
      if (!A.openInput(inp.id)) toast('Could not open ' + name + '. Use the TV remote Source button.');
    }
    // PS5 = input whose name says PlayStation/PS5, else the port you chose (hold OK on a tile), else the default
    var ps5 = null, ps5n = PS5_DEFAULT;
    try { var sv = parseInt(localStorage.getItem('navy.ps5port'), 10); if (sv) ps5n = sv; } catch (e) {}
    list.forEach(function (x) { if (/playstation|ps\s?5|ps\s?4/i.test((x.label || '') + ' ' + (x.custom || ''))) { ps5 = x; ps5n = portNum(x); } });
    if (!ps5) list.forEach(function (x) { if (portNum(x) === ps5n) ps5 = x; });
    function setPs5(n) { try { localStorage.setItem('navy.ps5port', String(n)); } catch (e) {} buildInputs(); toast('PS5 set to HDMI ' + n); }
    if (ps5) { var pt = tile('PS5', ICON_MONITOR, 'HDMI ' + ps5n, function () { open(ps5, 'PS5'); }); pt._long = function () {
      var opts = []; [1, 2, 3].forEach(function (n) { opts.push({ label: 'PS5 is on HDMI ' + n, fn: function () { setPs5(n); } }); });
      openMenu('PS5 input', opts, pt);
    };
    row.appendChild(pt); }
    var air = airPkg(), airInstalled = !!air;
    row.appendChild(tile('AirPlay', ICON_MIRROR, airInstalled ? 'Mirror Mac' : 'Install receiver', function () {
      if (!A) { toast('Preview only'); return; }
      if (airInstalled) A.launch(air); else A.openStore(AIRPLAY_PKGS[0]);
    }, !airInstalled));
    list.forEach(function (inp) {
      var n = portNum(inp);
      if (n > 3 || n === 99 || n === ps5n) return;
      var name = 'HDMI ' + n;
      var ht = tile(name, ICON_MONITOR, inp.custom || '', function () { open(inp, name); });
      ht._long = function () { openMenu(name, [{ label: 'This is my PS5', fn: function () { setPs5(n); } }], ht); };
      row.appendChild(ht);
    });
    row.appendChild(tile('Cast', ICON_CAST, 'Chromecast', function () {
      toast('Chromecast is built in. Open Cast in any app or Chrome and pick this TV.');
    }));
  }

  // ---------- All apps overlay ----------
  var overlayOpen = false;
  var pickMode = false;
  function openApps(pick) {
    pickMode = pick === true;
    var grid = $('grid'); grid.innerHTML = '';
    var list = [];
    try { list = A ? JSON.parse(A.listApps()) : []; } catch (e) {}
    list.forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'f app';
      b.innerHTML = '<img alt=""><span></span>';
      b.querySelector('span').textContent = a.label;
      b.addEventListener('click', function () {
        if (pickMode) {
          if (dockIndex(a.pkg) < 0) { var k = knownFor(a.pkg); dock.push({ name: k ? k[0] : a.label, pkg: a.pkg, icon: k ? k[2] : null }); saveDock(); buildApps(); toast(a.label + ' added to home'); }
          else toast(a.label + ' is already on home');
          closeApps(); return;
        }
        launch(a.pkg, a.label);
      });
      b._long = function () { appMenu(a, b); };
      grid.appendChild(b);
    });
    $('overlay').hidden = false; overlayOpen = true;
    if (pickMode) toast('Pick an app to add to home');
    var imgs = grid.querySelectorAll('img'), i = 0;
    (function next() {
      if (i >= imgs.length || !overlayOpen) return;
      var src = A ? A.appIcon(list[i].pkg) : '';
      if (src) imgs[i].src = src;
      i++; setTimeout(next, 12);
    })();
    var first = grid.querySelector('.f'); if (first) first.focus();
  }
  function closeApps() { $('overlay').hidden = true; overlayOpen = false; pickMode = false; $('btnApps').focus(); }
  function appMenu(a, from) {
    var on = dockIndex(a.pkg) >= 0, k = knownFor(a.pkg);
    var acts = [{ label: 'Open', fn: function () { launch(a.pkg, a.label); } }];
    if (on) acts.push({ label: 'Remove from home', fn: function () { dock.splice(dockIndex(a.pkg), 1); saveDock(); buildApps(); toast(a.label + ' removed from home'); } });
    else acts.push({ label: 'Add to home', fn: function () {
      dock.push({ name: k ? k[0] : a.label, pkg: a.pkg, icon: k ? k[2] : null }); saveDock(); buildApps();
      toast(a.label + ' added to home');
    } });
    openMenu(a.label, acts, from);
  }


  // ---------- Quick panel (rebuild of the native side menu) ----------
  var panelOpen = false, panelReturn = null;
  var IC = {
    inputs: '<svg viewBox="0 0 24 24"><path d="M3 12h11M10 7l5 5-5 5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/></svg>',
    picture: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><circle cx="12" cy="10" r="2.6"/><path d="M8 20h8"/></svg>',
    wifi: '<svg viewBox="0 0 24 24"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19.2" r=".8"/></svg>',
    bt: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10-5 4V3l5 4L7 17"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>',
    access: '<svg viewBox="0 0 24 24"><circle cx="12" cy="4.5" r="1.8"/><path d="M5 8.5l7 1.3 7-1.3M12 9.8V15M9 21l3-6 3 6"/></svg>',
    saver: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"/></svg>'
  };
  var QUICK = [
    { label: 'Picture',   icon: IC.picture, act: 'android.settings.DISPLAY_SETTINGS' },
    { label: 'Bluetooth', icon: IC.bt,      act: 'android.settings.BLUETOOTH_SETTINGS' },
    { label: 'Wi-Fi',     icon: IC.wifi,    act: 'android.settings.WIFI_SETTINGS' },
    { label: 'Settings',  icon: IC.gear,    act: 'android.settings.SETTINGS' }
  ];
  function buildPanel() {
    var g = $('pGrid'); g.innerHTML = '';
    QUICK.forEach(function (q) {
      var b = document.createElement('button');
      b.className = 'f ptile';
      b.innerHTML = q.icon + '<span></span>';
      b.querySelector('span').textContent = q.label;
      b.addEventListener('click', function () {
        closePanel(true);
        if (q.fn) { q.fn(); return; }
        if (!A) { toast('Preview only: ' + q.label); return; }
        var ok = q.pkg ? A.startActionPkg(q.act, q.pkg) : A.startAction(q.act);
        if (!ok) { toast(q.label + ' is not available on this TV'); }
      });
      g.appendChild(b);
    });
  }

  // ---------- Notifications (shown in the quick panel) ----------
  function ago(ms) {
    var m = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (m < 1) return 'now'; if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    return Math.round(h / 24) + ' d ago';
  }
  var lastNotif = { enabled: false, items: [] };
  function readNotifs() {
    try { if (A) lastNotif = JSON.parse(A.getNotifications()); } catch (e) {}
    return lastNotif;
  }
  function groupNotifs(items) {
    var m = {}, order = [];
    items.forEach(function (it) {
      var k = it.pkg || it.app;
      if (!m[k]) { m[k] = { pkg: it.pkg, app: it.app, items: [] }; order.push(k); }
      m[k].items.push(it);
    });
    return order.map(function (k) { return m[k]; });
  }
  function paintNotifs() {
    var box = $('nList'); box.innerHTML = '';
    var d = readNotifs();
    if (!A) { box.innerHTML = '<div class="nempty">Preview only</div>'; return; }
    if (!d.enabled) { box.innerHTML = '<div class="nempty">Notification access is off. Turn it on in Settings > Notifications.</div>'; return; }
    if (!d.items.length) { box.innerHTML = '<div class="nempty">All caught up</div>'; return; }
    var clr = document.createElement('button');
    clr.className = 'f nclear'; clr.textContent = 'Clear all (' + d.items.length + ')';
    clr.addEventListener('click', function () { A.dismissAll(); setTimeout(function () { paintNotifs(); var f = $('pGrid').querySelector('.f'); if (f) f.focus(); }, 300); });
    box.appendChild(clr);
    groupNotifs(d.items).slice(0, 8).forEach(function (g) {
      var it = g.items[0], b = document.createElement('button');
      b.className = 'f nitem';
      b.innerHTML = '<div class="na"></div><div class="nt"></div><div class="nx"></div>';
      b.querySelector('.na').textContent = g.app + (g.items.length > 1 ? '  \u00B7  ' + g.items.length + ' new' : '') + '  \u00B7  ' + ago(it.time);
      b.querySelector('.nt').textContent = it.title;
      b.querySelector('.nx').textContent = it.text;
      b.addEventListener('click', function () { closePanel(true); if (!A.openNotification(it.key)) toast('Could not open that notification'); });
      b._long = function () {
        openMenu(g.app, [
          { label: 'Open', fn: function () { closePanel(true); A.openNotification(it.key); } },
          { label: 'Dismiss all from ' + g.app, fn: function () { A.dismissApp(g.pkg); setTimeout(function () { paintNotifs(); var f = $('nList').querySelector('.f') || $('pGrid').querySelector('.f'); if (f) f.focus(); }, 300); } }
        ], b);
      };
      box.appendChild(b);
    });
  }
  setInterval(readNotifs, 20000); setTimeout(readNotifs, 1500);

  function openPanel() {
    if (panelOpen) return;
    if (menuOpen) closeMenu(true);
    if (overlayOpen) { $('overlay').hidden = true; overlayOpen = false; }
    panelReturn = document.activeElement;
    paintNotifs();
    $('panel').hidden = false; panelOpen = true;
    requestAnimationFrame(function () { document.body.classList.add('panel'); });
    var f = $('pGrid').querySelector('.f'); if (f) f.focus();
  }
  function closePanel(skipFocus) {
    if (!panelOpen) return;
    panelOpen = false; document.body.classList.remove('panel');
    setTimeout(function () { if (!panelOpen) $('panel').hidden = true; }, 250);
    if (!skipFocus && panelReturn && panelReturn.isConnected) panelReturn.focus();
  }
  function togglePanel() { if (panelOpen) closePanel(); else openPanel(); }
  buildPanel();

  // ---------- Popup menu ----------
  var menuOpen = false, menuReturn = null;
  function openMenu(title, actions, from) {
    $('menuTitle').textContent = title;
    var box = $('menuBtns'); box.innerHTML = '';
    actions.forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'f mbtn'; b.textContent = a.label;
      b.addEventListener('click', function () { closeMenu(true); a.fn(); });
      box.appendChild(b);
    });
    menuReturn = from || null; $('menu').hidden = false; menuOpen = true;
    box.querySelector('.f').focus();
  }
  function closeMenu(skipFocus) {
    $('menu').hidden = true; menuOpen = false;
    if (!skipFocus && menuReturn && menuReturn.isConnected) menuReturn.focus();
  }

  // ---------- Wallpapers ----------
  var BUILTIN_WALLS = ['alpine','amber','bridge','cove','forest','goldcoast','golden','mint','misty','night','peaks','ridge','summit','sydney','valley'];
  // Your own wallpapers (made by add-wallpapers.sh) replace the built-in ones when present.
  var WALLS = (window.CUSTOM_WALLS && window.CUSTOM_WALLS.length) ? window.CUSTOM_WALLS : BUILTIN_WALLS;
  var cur = Math.floor(Math.random() * WALLS.length), front = 'a';
  function show(name) {
    var next = document.querySelector('#bg .layer.' + (front === 'a' ? 'b' : 'a'));
    var prev = document.querySelector('#bg .layer.' + front);
    var img = new Image();
    img.onload = function () {
      next.style.backgroundImage = 'url(wallpapers/' + name + '.jpg)';
      next.classList.add('on'); prev.classList.remove('on');
      front = front === 'a' ? 'b' : 'a';
      setTimeout(function () { if (!prev.classList.contains('on')) prev.style.backgroundImage = 'none'; }, 2000);
    };
    img.src = 'wallpapers/' + name + '.jpg';
  }
  function rotate() { cur = (cur + 1) % WALLS.length; show(WALLS[cur]); }
  show(WALLS[cur]);
  setInterval(rotate, ROTATE_MS);

  // ---------- Clock ----------
  function tick() {
    var d = new Date(), h = d.getHours() % 12 || 12, m = ('0' + d.getMinutes()).slice(-2);
    var t = h + ':' + m + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');
    var ds = d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' });
    $('clock').textContent = t; $('date').textContent = ds;
    $('pClock').textContent = t; $('pDate').textContent = ds;
    $('saverClock').textContent = t; $('saverDate').textContent = ds;
  }
  tick(); setInterval(tick, 10000);

  // ---------- Weather (Open-Meteo) ----------
  function wxInfo(code) {
    if (code === 0) return ['☀️', 'Clear'];
    if (code <= 2) return ['⛅', 'Partly cloudy'];
    if (code === 3) return ['☁️', 'Cloudy'];
    if (code === 45 || code === 48) return ['🌫️', 'Fog'];
    if (code >= 51 && code <= 57) return ['🌦️', 'Drizzle'];
    if (code >= 61 && code <= 67) return ['🌧️', 'Rain'];
    if (code >= 71 && code <= 77) return ['❄️', 'Snow'];
    if (code >= 80 && code <= 82) return ['🌦️', 'Showers'];
    if (code >= 85 && code <= 86) return ['❄️', 'Snow showers'];
    if (code >= 95) return ['⛈️', 'Storm'];
    return ['🌡️', ''];
  }
  function paintWx(o) {
    if (!o) return;
    var html = '<span class="wxi">' + o.icon + '</span><span><span class="wxt">' + o.temp + '°</span><span class="wxd">' + o.text + '</span></span>';
    $('wx').innerHTML = html; $('wx').hidden = false;
    $('saverWx').textContent = o.icon + '  ' + o.temp + '°  ' + o.text;
  }
  var WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON + '&current=temperature_2m,weather_code&timezone=auto';
  var wxRetry = null;
  function wxOk(txt) {
    try {
      var j = JSON.parse(txt), c = j.current, w = wxInfo(c.weather_code);
      var o = { icon: w[0], text: w[1], temp: Math.round(c.temperature_2m) };
      try { localStorage.setItem('navy.wx', JSON.stringify(o)); } catch (e) {}
      paintWx(o); clearTimeout(wxRetry);
    } catch (e) { wxFail(String(e)); }
  }
  function wxFail() { clearTimeout(wxRetry); wxRetry = setTimeout(loadWx, 60 * 1000); }
  window.__wx = wxOk; window.__wxErr = wxFail;
  function loadWx() {
    try { paintWx(JSON.parse(localStorage.getItem('navy.wx'))); } catch (e) {}
    if (A && A.fetchUrl) { A.fetchUrl(WX_URL, '__wx'); return; }
    fetch(WX_URL).then(function (r) { return r.text(); }).then(wxOk).catch(wxFail);
  }
  loadWx(); setInterval(loadWx, 30 * 60 * 1000);

  // ---------- Screensaver ----------
  var idleT = null, saverOn = false, saverWallT = null;
  function resetIdle() { clearTimeout(idleT); idleT = setTimeout(enterSaver, IDLE_MS); }
  function enterSaver() {
    if (menuOpen) closeMenu(true);
    closePanel(true);
    if (overlayOpen) { $('overlay').hidden = true; overlayOpen = false; }
    saverOn = true; document.body.classList.add('saver');
    clearInterval(saverWallT); saverWallT = setInterval(rotate, SAVER_ROTATE_MS);
  }
  function wake() {
    saverOn = false; document.body.classList.remove('saver');
    clearInterval(saverWallT); resetIdle();
  }
  resetIdle();

  // ---------- Top bar ----------
  $('btnArt').addEventListener('click', function () { enterSaver(); });
  $('btnApps').addEventListener('click', function () { openApps(false); });
  $('btnSettings').addEventListener('click', function () { if (A) A.openSettings(); else toast('Preview only: Settings'); });

  // ---------- D-pad navigation + long-press ----------
  function scope() { return menuOpen ? $('menu') : panelOpen ? $('panel') : overlayOpen ? $('overlay') : document; }
  function focusables() {
    return Array.prototype.slice.call(scope().querySelectorAll('.f')).filter(function (e) { return e.offsetParent !== null; });
  }
  function move(dir) {
    var all = focusables(), cur = document.activeElement;
    if (!cur || all.indexOf(cur) < 0) { if (all[0]) all[0].focus(); return; }
    var r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, best = null, bs = 1e12;
    all.forEach(function (e) {
      if (e === cur) return;
      var q = e.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2, dx = x - cx, dy = y - cy, p, s;
      if (dir === 'left' && dx < -4) { p = Math.abs(dy); s = -dx; }
      else if (dir === 'right' && dx > 4) { p = Math.abs(dy); s = dx; }
      else if (dir === 'up' && dy < -4) { p = Math.abs(dx); s = -dy; }
      else if (dir === 'down' && dy > 4) { p = Math.abs(dx); s = dy; }
      else return;
      var score = s + p * 2.5;
      if (score < bs) { bs = score; best = e; }
    });
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); }
  }

  // Wake the screensaver first; the key that wakes it does nothing else.
  document.addEventListener('keydown', function (e) {
    if (saverOn) { e.preventDefault(); e.stopPropagation(); wake(); return; }
    resetIdle();
  }, true);
  ['mousemove', 'mousedown', 'touchstart'].forEach(function (n) {
    document.addEventListener(n, function () { if (saverOn) wake(); else resetIdle(); }, true);
  });

  var pressTimer = null, longFired = false, pressTarget = null;
  document.addEventListener('keydown', function (e) {
    var k = e.key, map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[k]) { e.preventDefault(); move(map[k]); return; }
    if (k === 'Enter' || k === ' ') {
      var a = document.activeElement;
      if (!a || !a.classList.contains('f')) return;
      e.preventDefault();
      if (e.repeat) return;
      if (a._long) {
        pressTarget = a; longFired = false;
        pressTimer = setTimeout(function () { longFired = true; pressTimer = null; a._long(); }, 650);
      } else a.click();
      return;
    }
    if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); window.onBack(); }
  });
  document.addEventListener('keyup', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (pressTimer) {
      clearTimeout(pressTimer); pressTimer = null;
      if (!longFired && pressTarget && pressTarget.isConnected) { e.preventDefault(); pressTarget.click(); }
    }
    pressTarget = null;
  });

  // ---------- Hooks called from the Android shell ----------
  window.onBack = function () {
    if (window._renameOpen && window._renameOpen.parentNode) { window._renameOpen._cancel(); window._renameOpen = null; return; }
    if (saverOn) { wake(); return; }
    if (menuOpen) closeMenu(); else if (panelOpen) closePanel(); else if (overlayOpen) closeApps();
  };
  window.togglePanel = togglePanel;
  function homeReset() {
    if (saverOn) wake();
    if (menuOpen) closeMenu(true);
    closePanel(true);
    if (overlayOpen) { $('overlay').hidden = true; overlayOpen = false; }
    var t = document.querySelector('#rowApps .f'); if (t) t.focus();
  }
  window.onHome = function () { homeReset(); };
  window.onShown = function () {
    if (saverOn) wake(); else resetIdle();
    buildApps(); buildInputs(); tick();
    if (!document.activeElement || document.activeElement === document.body) homeReset();
  };

  buildApps(); buildInputs(); homeReset();
})();
