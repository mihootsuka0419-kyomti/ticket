/* ローカル保存アダプタ（デモ・1台運用向け）
 * ブラウザの localStorage にデータを保存します。他の端末とは共有されません。
 * window.claude を差し替える形で app.js に db / user / downloads を提供します。 */
(function () {
  if (window.claude) return;
  var KEY = 'uka-db', listeners = [];
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function fire() { listeners.slice().forEach(function (f) { f(); }); }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); fire(); }
  window.addEventListener('storage', function (e) { if (e.key === KEY) fire(); });
  function snap(path, d) {
    var v = d[path];
    return { id: path.split('/').pop(), exists: v !== undefined,
      data: function () { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); } };
  }
  function listen(fn) {
    listeners.push(fn); setTimeout(fn, 0);
    return function () { listeners = listeners.filter(function (x) { return x !== fn; }); };
  }
  function docRef(path) {
    return {
      path: path,
      get: function () { return Promise.resolve(snap(path, load())); },
      set: function (o) { var d = load(); d[path] = o; save(d); return Promise.resolve(); },
      update: function (o) {
        var d = load();
        if (!d[path]) return Promise.reject({ code: 'not_found', message: 'document not found' });
        d[path] = Object.assign({}, d[path], o); save(d); return Promise.resolve();
      },
      delete: function () { var d = load(); delete d[path]; save(d); return Promise.resolve(); },
      onSnapshot: function (next) { return listen(function () { next(snap(path, load())); }); }
    };
  }
  function colRef(name, order) {
    return {
      doc: function (id) { return docRef(name + '/' + id); },
      orderBy: function (f) { return colRef(name, f); },
      onSnapshot: function (next) {
        return listen(function () {
          var d = load();
          var docs = Object.keys(d).filter(function (k) { return k.indexOf(name + '/') === 0 && k.split('/').length === 2; })
            .map(function (k) { return snap(k, d); });
          if (order) docs.sort(function (a, b) { return (a.data()[order] || 0) - (b.data()[order] || 0); });
          next({ docs: docs, size: docs.length, empty: !docs.length });
        });
      }
    };
  }
  var db = { doc: docRef, collection: function (n) { return colRef(n); } };
  var user = { isOwner: function () { return true; }, canEdit: function () { return true; } };
  var downloads = { save: function (o) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([o.data], { type: 'text/csv' }));
    a.download = o.filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    return Promise.resolve();
  } };
  window.claude = { use: function (n) { return Promise.resolve({ db: db, user: user, downloads: downloads }[n] || null); } };
})();
