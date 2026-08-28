/* =====================================================================
   SHOP — aba Pods: busca, filtros por tag, mais vendidos e grade
   ===================================================================== */
(function (global) {
  'use strict';

  var $ = UI.$, $$ = UI.$$;

  var state = {
    q: '',
    sort: 'destaque',
    sel: { puffs: [], sabores: [], marcas: [], tags: [] }
  };

  // busca sem acento: decompõe e descarta os sinais diacríticos (U+0300–U+036F)
  function norm(s) {
    var d = String(s == null ? '' : s).normalize('NFD');
    var out = '';
    for (var i = 0; i < d.length; i++) {
      var c = d.charCodeAt(i);
      if (c < 768 || c > 879) out += d[i];
    }
    return out.toLowerCase().trim();
  }

  function anyFilter() {
    return !!state.q || Object.keys(state.sel).some(function (k) { return state.sel[k].length; });
  }

  /* ---------------- chips ---------------- */
  var GROUPS = [
    { key: 'puffs',   label: 'Puffs' },
    { key: 'sabores', label: 'Sabores' },
    { key: 'marcas',  label: 'Marcas' },
    { key: 'tags',    label: 'Tipo' }
  ];

  var LIMIT = 8;
  var expanded = {};

  function renderChips() {
    var f = Store.facets();
    var box = $('#chipGroups');
    if (!box) return;
    box.innerHTML = GROUPS.map(function (g) {
      var values = f[g.key] || [];
      if (!values.length) return '';
      // mantém visíveis os filtros já marcados mesmo com a lista recolhida
      var open = expanded[g.key];
      var shown = open ? values : values.filter(function (v, i) {
        return i < LIMIT || state.sel[g.key].indexOf(v) >= 0;
      });
      var rest = values.length - shown.length;
      var html = '<div class="chip-row"><b>' + g.label + '</b>' + shown.map(function (v) {
        var on = state.sel[g.key].indexOf(v) >= 0;
        return '<button class="chip' + (on ? ' is-on' : '') + '" data-g="' + g.key + '" data-v="' + UI.esc(v) + '">' + UI.esc(v) + '</button>';
      }).join('');
      if (rest > 0) html += '<button class="chip chip-more" data-more="' + g.key + '">+' + rest + '</button>';
      else if (open && values.length > LIMIT) html += '<button class="chip chip-more" data-less="' + g.key + '">− menos</button>';
      return html + '</div>';
    }).join('');
  }

  function countSel() {
    return Object.keys(state.sel).reduce(function (n, k) { return n + state.sel[k].length; }, 0);
  }

  function renderActive() {
    var box = $('#activeFilters');
    var chips = [];
    var n = countSel();
    var badge = $('#fcount');
    badge.hidden = !n;
    badge.textContent = n;
    Object.keys(state.sel).forEach(function (g) {
      state.sel[g].forEach(function (v) {
        chips.push('<button class="tag-x" data-g="' + g + '" data-v="' + UI.esc(v) + '">' + UI.esc(v) + ' ×</button>');
      });
    });
    if (!chips.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = chips.join('') + '<button class="tag-x" data-clear="1">limpar tudo</button>';
  }

  /* ---------------- filtragem ---------------- */
  function matches(p) {
    if (state.q) {
      var q = norm(state.q);
      var hay = norm([p.nome, p.marca, p.descricao, p.sabores.join(' '), p.tags.join(' '), p.puffs + ' puffs'].join(' '));
      var words = q.split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
    }
    if (state.sel.marcas.length && state.sel.marcas.indexOf(p.marca) < 0) return false;
    if (state.sel.puffs.length && state.sel.puffs.indexOf(Store.puffBucket(p.puffs)) < 0) return false;
    if (state.sel.sabores.length && !state.sel.sabores.some(function (s) { return p.sabores.indexOf(s) >= 0; })) return false;
    if (state.sel.tags.length && !state.sel.tags.some(function (t) { return p.tags.indexOf(t) >= 0; })) return false;
    return true;
  }

  function sortList(list) {
    var l = list.slice();
    switch (state.sort) {
      case 'menor': l.sort(function (a, b) { return Store.priceOf(a) - Store.priceOf(b); }); break;
      case 'maior': l.sort(function (a, b) { return Store.priceOf(b) - Store.priceOf(a); }); break;
      case 'az':    l.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }); break;
      case 'puffs': l.sort(function (a, b) { return b.puffs - a.puffs; }); break;
      default:
        l.sort(function (a, b) {
          var s = (b.maisVendido ? 1 : 0) - (a.maisVendido ? 1 : 0);
          if (s) return s;
          var pr = (Store.hasPromo(b) ? 1 : 0) - (Store.hasPromo(a) ? 1 : 0);
          if (pr) return pr;
          return a.ordem - b.ordem;
        });
    }
    // sem estoque vai pro fim
    return l.sort(function (a, b) { return (Store.inStock(b) ? 1 : 0) - (Store.inStock(a) ? 1 : 0); });
  }

  /* ---------------- render ---------------- */
  function render() {
    var all = Store.products();
    var filtering = anyFilter();

    // linhas de sessão só aparecem sem filtro
    var best = Store.bySessao('maisVendidos');
    var promos = Store.bySessao('promocoes');

    var bBest = $('#blockBest'), bPromo = $('#blockPromo');
    bBest.hidden = filtering || !best.length;
    bPromo.hidden = filtering || !promos.length;
    if (!bBest.hidden) $('#railBest').innerHTML = best.map(UI.productCard).join('');
    if (!bPromo.hidden) $('#railPromo').innerHTML = promos.map(UI.productCard).join('');

    var list = sortList(all.filter(matches));
    $('#gridTitle').textContent = filtering ? 'Resultados da busca' : 'Todos os produtos';
    $('#gridCount').textContent = list.length + (list.length === 1 ? ' produto' : ' produtos');
    $('#grid').innerHTML = list.map(UI.productCard).join('');
    $$('#grid .card').forEach(function (c, i) { c.style.animationDelay = Math.min(i * 26, 420) + 'ms'; });
    $('#emptyState').hidden = list.length > 0;
    $('#grid').hidden = list.length === 0;

    renderActive();
    $('#searchClear').hidden = !state.q;

    // com filtro ativo as linhas somem, então o carrossel também para
    if (filtering) pararTrilhos(); else iniciarTrilhos();
  }

  /* ------- no celular as duas linhas de destaque andam sozinhas ------- */
  var mqCel = global.matchMedia ? matchMedia('(max-width: 760px)') : null;
  var trilhos = [];

  function emTela(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 60 && r.top < global.innerHeight - 40;
  }

  function passoDoTrilho(rail) {
    var card = rail.querySelector('.card');
    if (!card) return 0;
    var cs = getComputedStyle(rail);
    var gap = parseFloat(cs.columnGap || cs.gap) || 20;
    return card.getBoundingClientRect().width + gap;
  }

  function pararTrilhos() {
    trilhos.forEach(function (t) {
      clearInterval(t.timer);
      t.rail.removeEventListener('touchstart', t.pausa);
      t.rail.removeEventListener('pointerdown', t.pausa);
    });
    trilhos = [];
  }

  function iniciarTrilhos() {
    pararTrilhos();
    if (!mqCel || !mqCel.matches) return;   // no desktop as linhas ficam paradas

    ['railBest', 'railPromo'].forEach(function (id) {
      var rail = document.getElementById(id);
      if (!rail || rail.children.length < 2) return;
      var bloco = rail.closest('.row-block');
      if (bloco && bloco.hidden) return;

      var pausadoAte = 0;
      var pausa = function () { pausadoAte = Date.now() + 6000; };   // quem tocou manda

      var timer = setInterval(function () {
        if (Date.now() < pausadoAte || !emTela(rail)) return;
        var passo = passoDoTrilho(rail);
        if (!passo) return;
        var fim = rail.scrollWidth - rail.clientWidth - 4;
        var alvo = rail.scrollLeft + passo >= fim ? 0 : rail.scrollLeft + passo;
        rail.scrollTo({ left: alvo, behavior: 'smooth' });
      }, 3200);

      rail.addEventListener('touchstart', pausa, { passive: true });
      rail.addEventListener('pointerdown', pausa);
      trilhos.push({ timer: timer, rail: rail, pausa: pausa });
    });
  }

  function setActive(on) { on ? iniciarTrilhos() : pararTrilhos(); }

  function refresh() { renderChips(); render(); }

  function clearAll() {
    state.q = '';
    state.sel = { puffs: [], sabores: [], marcas: [], tags: [] };
    var s = $('#search'); if (s) s.value = '';
    refresh();
  }

  /* ---------------- eventos ---------------- */
  function init() {
    var s = $('#search');
    var deb;
    s.addEventListener('input', function () {
      clearTimeout(deb);
      deb = setTimeout(function () { state.q = s.value; render(); }, 130);
    });
    $('#searchClear').addEventListener('click', function () { s.value = ''; state.q = ''; s.focus(); render(); });
    $('#sortBy').addEventListener('change', function () { state.sort = this.value; render(); });

    $('#chipGroups').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      if (b.dataset.more) { expanded[b.dataset.more] = true; return renderChips(); }
      if (b.dataset.less) { expanded[b.dataset.less] = false; return renderChips(); }
      var g = b.dataset.g, v = b.dataset.v;
      var i = state.sel[g].indexOf(v);
      if (i >= 0) state.sel[g].splice(i, 1); else state.sel[g].push(v);
      b.classList.toggle('is-on');
      render();
    });

    $('#activeFilters').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.clear) return clearAll();
      var i = state.sel[b.dataset.g].indexOf(b.dataset.v);
      if (i >= 0) state.sel[b.dataset.g].splice(i, 1);
      renderChips(); render();
    });

    $('#clearAll').addEventListener('click', clearAll);

    $('#toggleFilters').addEventListener('click', function () {
      var panel = $('#chipsPanel');
      var open = panel.hidden;
      panel.hidden = !open;
      this.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  global.Shop = { init: init, refresh: refresh, clearAll: clearAll, setActive: setActive };
})(window);
