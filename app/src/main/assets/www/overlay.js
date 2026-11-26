(function () {
  var A = window.Android;
  function $(i) { return document.getElementById(i); }
  var IC = {
    picture: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><circle cx="12" cy="10" r="2.6"/><path d="M8 20h8"/></svg>',
    wifi: '<svg viewBox="0 0 24 24"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19.2" r=".8"/></svg>',
    bt: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10-5 4V3l5 4L7 17"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>'
  };
  var QUICK = [
    { label: 'Picture', icon: IC.picture, act: 'android.settings.DISPLAY_SETTINGS' },
    { label: 'Bluetooth', icon: IC.bt, act: 'android.settings.BLUETOOTH_SETTINGS' },
    { label: 'Wi-Fi', icon: IC.wifi, act: 'android.settings.WIFI_SETTINGS' },
    { label: 'Settings', icon: IC.gear, act: 'android.settings.SETTINGS' }
  ];
  function tick() {
    var d = new Date(), h = d.getHours() % 12 || 12, m = ('0' + d.getMinutes()).slice(-2);
    $('clock').textContent = h + ':' + m + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');
    $('date').textContent = d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function ago(ms) {
    var m = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (m < 1) return 'now'; if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    return Math.round(h / 24) + ' d ago';
  }
  function build() {
    var g = $('pGrid'); g.innerHTML = '';
    QUICK.forEach(function (q) {
      var b = document.createElement('button'); b.className = 'f ptile';
      b.innerHTML = q.icon + '<span>' + q.label + '</span>';
      b.addEventListener('click', function () { A.startAction(q.act); A.close(); });
      g.appendChild(b);
    });
    var box = $('nList'); box.innerHTML = '';
    var d = {}; try { d = JSON.parse(A.getNotifications()); } catch (e) {}
    if (!d.enabled) { box.innerHTML = '<div class="nempty">Notification access is off.</div>'; return; }
    if (!d.items.length) { box.innerHTML = '<div class="nempty">All caught up</div>'; return; }
    var clr = document.createElement('button');
    clr.className = 'f nclear'; clr.textContent = 'Clear all (' + d.items.length + ')';
    clr.addEventListener('click', function () { A.dismissAll(); setTimeout(function () { build(); var f = document.querySelector('.f'); if (f) f.focus(); }, 300); });
    box.appendChild(clr);
    var m = {}, order = [];
    d.items.forEach(function (it) { var k = it.pkg || it.app; if (!m[k]) { m[k] = { pkg: it.pkg, app: it.app, items: [] }; order.push(k); } m[k].items.push(it); });
    order.slice(0, 8).forEach(function (k) {
      var g = m[k], it = g.items[0], b = document.createElement('button'); b.className = 'f nitem';
      b.innerHTML = '<div class="na"></div><div class="nt"></div><div class="nx"></div>';
      b.querySelector('.na').textContent = g.app + (g.items.length > 1 ? '  \u00B7  ' + g.items.length + ' new' : '') + '  \u00B7  ' + ago(it.time);
      b.querySelector('.nt').textContent = it.title;
      b.querySelector('.nx').textContent = it.text;
      b.addEventListener('click', function () { A.openNotification(it.key); A.close(); });
      b._long = function () { A.dismissApp(g.pkg); setTimeout(build, 300); };
      box.appendChild(b);
    });
  }
  function focusables() { return Array.prototype.slice.call(document.querySelectorAll('.f')); }
  function move(dir) {
    var f = focusables(), cur = document.activeElement, i = f.indexOf(cur);
    if (i < 0) { if (f[0]) f[0].focus(); return; }
    var n = i;
    if (i < 4) {                      // 2x2 tile grid
      if (dir === 'left' && i % 2 === 1) n = i - 1;
      else if (dir === 'right' && i % 2 === 0) n = i + 1;
      else if (dir === 'up' && i >= 2) n = i - 2;
      else if (dir === 'down') n = i < 2 ? i + 2 : (f[4] ? 4 : i);
    } else {
      if (dir === 'up') n = i === 4 ? 2 : i - 1;
      else if (dir === 'down' && f[i + 1]) n = i + 1;
    }
    if (f[n]) { f[n].focus(); f[n].scrollIntoView({ block: 'nearest' }); }
  }
  var pressT = null, longFired = false, target = null;
  document.addEventListener('keydown', function (e) {
    var k = e.key, map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[k]) { e.preventDefault(); move(map[k]); return; }
    if (k === 'Enter' || k === ' ') {
      var a = document.activeElement; if (!a || !a.classList.contains('f')) return;
      e.preventDefault(); if (e.repeat) return;
      if (a._long) { target = a; longFired = false; pressT = setTimeout(function () { longFired = true; pressT = null; a._long(); }, 650); }
      else a.click();
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (pressT) { clearTimeout(pressT); pressT = null; if (!longFired && target) target.click(); }
    target = null;
  });
  window.show = function () {
    tick(); build(); document.body.classList.add('on');
    var f = focusables()[0]; if (f) f.focus();
  };
  window.hide = function () { document.body.classList.remove('on'); };
  setInterval(tick, 10000);
})();
