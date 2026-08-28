/* =====================================================================
   STORE — camada de dados (localStorage + seed publicado)
   ===================================================================== */
(function (global) {
  'use strict';

  var KEY = 'sunsetpod:data:v1';
  var subs = [];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function defaultSeed() {
    return { version: 0, settings: {}, products: [], sessoes: { maisVendidos: [], promocoes: [] } };
  }

  var SEED = global.SUNSET_SEED ? clone(global.SUNSET_SEED) : defaultSeed();

  var DEFAULT_SETTINGS = {
    whatsapp: '5521987390771',
    msgTemplate: 'Olá! Vim pelo site da Sunset Pod. Quero saber sobre: *{produto}* — {preco}.',
    instagram: '@sunsetpodrj',
    heroTitle: 'O pôr do sol',
    heroTitleHl: 'cabe no bolso',
    heroSub: 'Pods e vapes selecionados, veja as promoções',
    showcaseKicker: 'A fumaça baixou. A promoção apareceu.',
    tickerItems: 'Entrega no mesmo dia,Só produto original,Pix e cartão,Atendimento pelo Zap',
    storeOpen: true,
    shopNotice: 'Escolhe o teu, chama no Zap e recebe hoje.',
    passHash: 'sunset'
  };

  /* ---------------- normalização ---------------- */
  function normalizeProduct(p, i) {
    return {
      id: p.id || ('p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)),
      nome: p.nome || 'Sem nome',
      marca: p.marca || '',
      descricao: p.descricao || '',
      preco: num(p.preco, 0),
      precoPromo: p.precoPromo === '' || p.precoPromo == null ? null : num(p.precoPromo, null),
      puffs: num(p.puffs, 0),
      sabores: arr(p.sabores),
      tags: arr(p.tags),
      imagem: p.imagem || '',
      cor: p.cor || '#E24A12',
      estoque: p.estoque === '' || p.estoque == null ? 1 : num(p.estoque, 0),
      maisVendido: !!p.maisVendido,
      promo: !!p.promo,
      ativo: p.ativo === undefined ? true : !!p.ativo,
      ordem: num(p.ordem, i + 1)
    };
  }
  function num(v, fb) { var n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? fb : n; }
  function arr(v) {
    if (Array.isArray(v)) return v.map(function (s) { return String(s).trim(); }).filter(Boolean);
    if (typeof v === 'string') return v.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return [];
  }

  function normalize(data) {
    var d = data || {};
    var out = {
      version: num(d.version, 1),
      settings: Object.assign({}, DEFAULT_SETTINGS, d.settings || {}),
      products: (d.products || []).map(normalizeProduct),
      sessoes: {
        maisVendidos: arr((d.sessoes || {}).maisVendidos),
        promocoes: arr((d.sessoes || {}).promocoes)
      }
    };
    var ids = {};
    out.products.forEach(function (p) { ids[p.id] = true; });
    // sessões só apontam pra produtos existentes
    out.sessoes.maisVendidos = out.sessoes.maisVendidos.filter(function (id) { return ids[id]; });
    out.sessoes.promocoes = out.sessoes.promocoes.filter(function (id) { return ids[id]; });
    // flags e listas caminham juntas
    out.products.forEach(function (p) {
      if (p.maisVendido && out.sessoes.maisVendidos.indexOf(p.id) < 0) out.sessoes.maisVendidos.push(p.id);
      if (!p.maisVendido) out.sessoes.maisVendidos = out.sessoes.maisVendidos.filter(function (id) { return id !== p.id; });
      if (p.promo && out.sessoes.promocoes.indexOf(p.id) < 0) out.sessoes.promocoes.push(p.id);
      if (!p.promo) out.sessoes.promocoes = out.sessoes.promocoes.filter(function (id) { return id !== p.id; });
    });
    return out;
  }

  /* ---------------- carregar / salvar ---------------- */
  var state = null;

  function load() {
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { stored = null; }
    var seed = normalize(SEED);
    if (!stored) { state = seed; return state; }
    var s = normalize(stored);
    // catálogo publicado mais novo que o local vence
    if (seed.version > s.version) {
      state = seed;
      persist();
      return state;
    }
    state = s;
    return state;
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Não foi possível salvar (armazenamento cheio?)', e);
      if (global.UI && UI.toast) UI.toast('Armazenamento cheio — use imagens por URL em vez de upload.');
      return false;
    }
    return true;
  }

  function commit(silent) {
    state = normalize(state);
    var ok = persist();
    if (!silent) subs.forEach(function (fn) { try { fn(state); } catch (e) { console.error(e); } });
    return ok;
  }

  /* ---------------- consultas ---------------- */
  function products(includeInactive) {
    return state.products
      .filter(function (p) { return includeInactive ? true : p.ativo; })
      .slice()
      .sort(function (a, b) { return a.ordem - b.ordem; });
  }

  function byId(id) {
    for (var i = 0; i < state.products.length; i++) if (state.products[i].id === id) return state.products[i];
    return null;
  }

  function bySessao(nome) {
    var list = state.sessoes[nome] || [];
    return list.map(byId).filter(function (p) { return p && p.ativo; });
  }

  function hasPromo(p) { return p.precoPromo != null && p.precoPromo > 0 && p.precoPromo < p.preco; }
  function priceOf(p) { return hasPromo(p) ? p.precoPromo : p.preco; }
  function discountOf(p) { return hasPromo(p) ? Math.round((1 - p.precoPromo / p.preco) * 100) : 0; }
  function inStock(p) { return p.estoque === null || p.estoque === undefined || p.estoque > 0; }

  function fmt(v) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /* facetas para os filtros da loja */
  function facets() {
    var marcas = {}, sabores = {}, tags = {}, puffs = {};
    products().forEach(function (p) {
      if (p.marca) marcas[p.marca] = (marcas[p.marca] || 0) + 1;
      p.sabores.forEach(function (s) { sabores[s] = (sabores[s] || 0) + 1; });
      p.tags.forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
      if (p.puffs) { var b = puffBucket(p.puffs); puffs[b] = (puffs[b] || 0) + 1; }
    });
    return {
      marcas: keysSorted(marcas),
      sabores: keysSorted(sabores),
      tags: keysSorted(tags),
      puffs: Object.keys(puffs).sort(function (a, b) { return bucketMin(a) - bucketMin(b); })
    };
  }
  function keysSorted(o) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a] || a.localeCompare(b); }); }
  function puffBucket(n) {
    if (n < 3000) return 'até 3.000 puffs';
    if (n < 8000) return '3.000 a 8.000 puffs';
    if (n < 12000) return '8.000 a 12.000 puffs';
    if (n < 20000) return '12.000 a 20.000 puffs';
    return '20.000+ puffs';
  }
  function bucketMin(b) {
    if (b.indexOf('até') === 0) return 0;
    return parseInt(b.replace(/\./g, ''), 10) || 0;
  }

  /* ---------------- WhatsApp ---------------- */
  function zapLink(product) {
    var n = String(state.settings.whatsapp || '').replace(/\D/g, '');
    var msg;
    if (product) {
      msg = (state.settings.msgTemplate || '')
        .replace(/\{produto\}/g, product.nome + (product.marca ? ' (' + product.marca + ')' : ''))
        .replace(/\{preco\}/g, fmt(priceOf(product)));
    } else {
      msg = 'Olá! Vim pelo site da Sunset Pod e quero fazer um pedido.';
    }
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg);
  }

  /* ---------------- senha ---------------- */
  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return 'h:' + h.toString(36);
  }
  function checkPass(input) {
    var stored = state.settings.passHash || 'sunset';
    return stored.indexOf('h:') === 0 ? hash(input) === stored : input === stored;
  }

  /* ---------------- export / import ---------------- */
  function exportText() {
    var data = clone(state);
    data.version = (data.version || 1) + 1;
    state.version = data.version;
    commit(true);
    return '/* Sunset Pod — catálogo publicado em ' + new Date().toLocaleString('pt-BR') + ' */\n' +
      'window.SUNSET_SEED = ' + JSON.stringify(data, null, 2) + ';\n';
  }

  function importText(text) {
    var t = String(text).trim();
    var i = t.indexOf('{');
    var j = t.lastIndexOf('}');
    if (i < 0 || j < 0) throw new Error('Arquivo inválido.');
    var data = JSON.parse(t.slice(i, j + 1));
    if (!data.products) throw new Error('Arquivo sem produtos.');
    state = normalize(data);
    commit();
    return state;
  }

  function resetToSeed() { state = normalize(SEED); commit(); }
  function wipe() { try { localStorage.removeItem(KEY); } catch (e) {} state = normalize(SEED); commit(); }

  /* ---------------- API ---------------- */
  global.Store = {
    load: load,
    get state() { return state; },
    get settings() { return state.settings; },
    commit: commit,
    subscribe: function (fn) { subs.push(fn); },
    products: products,
    byId: byId,
    bySessao: bySessao,
    normalizeProduct: normalizeProduct,
    hasPromo: hasPromo,
    priceOf: priceOf,
    discountOf: discountOf,
    inStock: inStock,
    fmt: fmt,
    facets: facets,
    puffBucket: puffBucket,
    zapLink: zapLink,
    hash: hash,
    checkPass: checkPass,
    exportText: exportText,
    importText: importText,
    resetToSeed: resetToSeed,
    wipe: wipe,
    newId: function () { return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  };
})(window);
