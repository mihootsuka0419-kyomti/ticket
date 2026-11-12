/* GitHub だけで動かす保存アダプタ
 * データはリポジトリの data/db.json に保存します（GitHub を簡易データベースとして利用）。
 *  - お客さん: 読み取りのみ（raw.githubusercontent.com から取得。反映まで最大1分ほど）
 *  - スタッフ: GitHubトークンでログインすると、発行・もぎりが data/db.json へのコミットとして保存される
 *  - お客さんのコスネーム／受取は、その端末内にだけ保存される（ホスト側には反映されない）
 * 注意: data/db.json は公開リポジトリでは誰でも読めます。 */
(function () {
  var C = window.UKA_GITHUB || {};
  var m = location.hostname.match(/^([^.]+)\.github\.io$/);
  var owner = C.owner || (m && m[1]);
  var repo = C.repo || (m && location.pathname.split('/')[1]);
  if (!owner || !repo) return;               // 未設定ならローカル保存(local.js)にフォールバック
  var branch = C.branch || 'main', path = C.path || 'data/db.json';
  var api = 'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path;
  var TK = 'uka-token', OV = 'uka-overlay', token = null;
  try { token = localStorage.getItem(TK); } catch (e) {}
  var data = {}, loaded = false, listeners = [], isStaff = false, started = false;

  function ovLoad() { try { return JSON.parse(localStorage.getItem(OV) || '{}'); } catch (e) { return {}; } }
  function b64dec(s) { var b = atob(s.replace(/\n/g, '')), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new TextDecoder().decode(u); }
  function b64enc(s) { var u = new TextEncoder().encode(s), r = ''; for (var i = 0; i < u.length; i++) r += String.fromCharCode(u[i]); return btoa(r); }
  function hdr() { var h = { Accept: 'application/vnd.github+json' }; if (token) h.Authorization = 'Bearer ' + token; return h; }
  function fire() { listeners.slice().forEach(function (l) { l.fn(); }); }

  async function fetchRemote() {
    if (token) {   // スタッフ: API（最新・sha付き）
      var r = await fetch(api + '?ref=' + branch + '&t=' + Date.now(), { headers: hdr(), cache: 'no-store' });
      if (r.status === 404) return { data: {}, sha: null };
      if (!r.ok) throw { code: 'http_' + r.status };
      var j = await r.json();
      return { data: JSON.parse(b64dec(j.content) || '{}'), sha: j.sha };
    }
    var u = 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + branch + '/' + path + '?t=' + Math.floor(Date.now() / 30000);
    var r2 = await fetch(u, { cache: 'no-store' });
    if (r2.status === 404) return { data: {}, sha: null };
    if (!r2.ok) throw { code: 'http_' + r2.status };
    return { data: await r2.json(), sha: null };
  }
  async function refresh() {
    if (document.hidden && loaded) return;
    try { var c = await fetchRemote(); data = c.data; loaded = true; fire(); }
    catch (e) { if (!loaded) listeners.slice().forEach(function (l) { if (l.err) l.err(e); }); }
  }
  var chain = Promise.resolve();
  function mutate(fn) {
    var p = chain.then(async function () {
      if (!isStaff) throw { code: 'permission_denied', message: 'スタッフ用トークンが必要です' };
      for (var i = 0; i < 4; i++) {
        var cur = await fetchRemote(), next = JSON.parse(JSON.stringify(cur.data));
        fn(next);
        var body = { message: 'update db', content: b64enc(JSON.stringify(next, null, 1)), branch: branch };
        if (cur.sha) body.sha = cur.sha;
        var r = await fetch(api, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, hdr()), body: JSON.stringify(body) });
        if (r.ok) { data = next; loaded = true; fire(); return; }
        if (r.status !== 409 && r.status !== 422) throw { code: 'http_' + r.status };
      }
      throw { code: 'conflict' };
    });
    chain = p.catch(function () {});
    return p;
  }

  function snap(p) {
    var v = data[p], ov = ovLoad()[p];
    if (v !== undefined && ov) v = Object.assign({}, v, ov);
    return { id: p.split('/').pop(), exists: v !== undefined, data: function () { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); } };
  }
  function listen(fn, err) {
    var l = { fn: fn, err: err }; listeners.push(l);
    if (loaded) setTimeout(fn, 0);
    return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
  }
  function docRef(p) {
    return {
      path: p,
      get: function () { return Promise.resolve(snap(p)); },
      set: function (o) { return mutate(function (d) { d[p] = o; }); },
      update: function (o) {
        if (!isStaff) {   // お客さん: コスネーム・受取だけ端末内に保存
          var ks = Object.keys(o), ok = ks.every(function (k) { return k === 'cos' || k === 'receivedAt'; });
          if (!ok) return Promise.reject({ code: 'permission_denied', message: 'スタッフのみ操作できます' });
          var ov = ovLoad(); ov[p] = Object.assign(ov[p] || {}, o);
          try { localStorage.setItem(OV, JSON.stringify(ov)); } catch (e) {}
          setTimeout(fire, 0); return Promise.resolve();
        }
        return mutate(function (d) { if (!d[p]) throw { code: 'not_found' }; d[p] = Object.assign({}, d[p], o); });
      },
      delete: function () { return mutate(function (d) { delete d[p]; }); },
      onSnapshot: function (next, err) { return listen(function () { next(snap(p)); }, err); }
    };
  }
  function colRef(name, order) {
    return {
      doc: function (id) { return docRef(name + '/' + id); },
      orderBy: function (f) { return colRef(name, f); },
      onSnapshot: function (next, err) {
        return listen(function () {
          var docs = Object.keys(data).filter(function (k) { return k.indexOf(name + '/') === 0 && k.split('/').length === 2; }).map(snap);
          if (order) docs.sort(function (a, b) { return (a.data()[order] || 0) - (b.data()[order] || 0); });
          next({ docs: docs, size: docs.length, empty: !docs.length });
        }, err);
      }
    };
  }
  var db = { doc: docRef, collection: function (n) { return colRef(n); } };
  var user = { isOwner: function () { return isStaff; }, canEdit: function () { return isStaff; } };
  var downloads = { save: function (o) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([o.data], { type: 'text/csv' }));
    a.download = o.filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    return Promise.resolve();
  } };

  var staffP = (async function () {
    if (!token) return;
    try {
      var r = await fetch('https://api.github.com/repos/' + owner + '/' + repo, { headers: hdr() });
      if (!r.ok) { token = null; localStorage.removeItem(TK); return; }
      var j = await r.json(); isStaff = !!(j.permissions && (j.permissions.push || j.permissions.admin));
    } catch (e) {}
  })();
  function start() {
    if (started) return; started = true;
    refresh(); setInterval(refresh, isStaff ? 15000 : 60000);
  }
  window.claude = { use: function (n) { return staffP.then(function () { if (n === 'db') start(); return { db: db, user: user, downloads: downloads }[n] || null; }); } };

  window.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('button');
    b.textContent = token ? 'スタッフログアウト' : 'スタッフログイン'; b.className = 'ghost';
    b.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:40;opacity:.8';
    b.onclick = function () {
      if (token) { localStorage.removeItem(TK); location.reload(); return; }
      var t = prompt('GitHubのトークン（Fine-grained token / Contents: Read and write）を貼り付けてください');
      if (t && t.trim()) { localStorage.setItem(TK, t.trim()); location.reload(); }
    };
    document.body.appendChild(b);
  });
})();
