/* =====================================================================
   APP — roteamento por abas, boot e integração entre módulos
   ===================================================================== */
(function (global) {
  'use strict';

  var $ = UI.$, $$ = UI.$$;
  var VIEWS = ['inicio', 'pods', 'adm'];
  var current = null;

  function routeName() {
    var h = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return VIEWS.indexOf(h) >= 0 ? h : 'inicio';
  }

  function go(name, keepScroll) {
    if (name === current) return;
    current = name;

    VIEWS.forEach(function (v) {
      var el = document.getElementById('view-' + v);
      if (el) el.hidden = v !== name;
    });
    $$('.tab').forEach(function (t) { t.classList.toggle('is-on', t.dataset.tab === name); });
    document.body.dataset.view = name;
    document.body.classList.remove('menu-open');

    Hero.setActive(name === 'inicio');
    Shop.setActive(name === 'pods');
    if (name === 'pods') Shop.refresh();
    if (name === 'adm') Admin.paintAuth();

    if (!keepScroll) global.scrollTo(0, 0);
    document.title = name === 'pods' ? 'Pods · Sunset Pod'
      : name === 'adm' ? 'Painel · Sunset Pod'
      : 'Sunset Pod — Vapes com energia carioca';
  }

  /* ---------------- boot ---------------- */
  function boot() {
    Store.load();

    $('#year').textContent = new Date().getFullYear();

    Hero.init();
    Shop.init();
    Admin.init();
    UI.refreshZapLinks();

    // quando os dados mudam, a vitrine acompanha
    Store.subscribe(function () {
      UI.refreshZapLinks();
      Hero.refresh();
      Shop.refresh();
    });

    $('#burger').addEventListener('click', function () {
      document.body.classList.toggle('menu-open');
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('.tab')) document.body.classList.remove('menu-open');
    });

    global.addEventListener('hashchange', function () { go(routeName()); });
    go(routeName(), true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.App = { go: go };
})(window);
