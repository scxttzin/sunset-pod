/* =====================================================================
   HERO — pôr do sol, pod flutuante e carrossel de promoções

   A hero é estática: nada aqui reage ao scroll além da barra do topo.
   A antiga coreografia por rolagem (pod girando, fumaça em canvas e a
   sessão 2 nascendo dela) foi retirada a pedido.
   ===================================================================== */
(function (global) {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  var showcase, ativo = false;
  var reduced = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= sol estilo logo ================= */
  function buildSun(groupId, inner, outer, count, cx, cy) {
    var g = document.getElementById(groupId);
    if (!g) return;
    var d = '<g transform="translate(' + cx + ',' + cy + ')">';
    for (var i = 0; i < count; i++) {
      // raio em forma de chama, com a ponta virada pro lado (igual ao sol do logo)
      var a = (360 / count) * i;
      var w = inner * 0.30;
      d += '<path transform="rotate(' + a + ')" d="' +
        'M ' + (-w) + ' ' + (-inner * 0.94) + ' ' +
        'C ' + (-w * 1.35) + ' ' + (-inner * 1.5) + ' ' + (-w * 1.1) + ' ' + (-outer * 0.86) + ' ' + (w * 0.55) + ' ' + (-outer) + ' ' +
        'C ' + (-w * 0.1) + ' ' + (-outer * 0.8) + ' ' + (w * 0.35) + ' ' + (-outer * 0.7) + ' ' + (w * 1.25) + ' ' + (-outer * 0.6) + ' ' +
        'C ' + (w * 1.5) + ' ' + (-inner * 1.2) + ' ' + (w * 1.2) + ' ' + (-inner * 1.0) + ' ' + w + ' ' + (-inner * 0.92) + ' Z"/>';
    }
    g.innerHTML = d + '</g>';
  }

  /* ================= foto do pod sem fundo =================
     A foto vem com fundo branco e uma sombra de estudio em volta. Antes ela
     era encaixada no ceu com mix-blend-mode: multiply, mas isso arrastava
     essa sombra sobre o sol e, no Safari do iPhone, embaralhava a cor do
     fundo inteiro. Aqui o fundo e removido de verdade, por preenchimento a
     partir das bordas, preservando o branco de dentro do aparelho.        */
  function recortarPod() {
    var el = document.getElementById('podPhoto');
    if (!el) return;
    var origem = new Image();
    origem.onload = function () {
      var url = semFundo(origem);
      if (url) el.src = url;
      el.style.opacity = '1';
    };
    origem.onerror = function () { el.style.opacity = '1'; };
    origem.src = el.getAttribute('src');
  }

  function semFundo(img) {
    var W = img.naturalWidth, H = img.naturalHeight;
    if (!W || !H) return null;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);

    var dados;
    try { dados = cx.getImageData(0, 0, W, H); } catch (e) { return null; }
    var px = dados.data;
    var visto = new Uint8Array(W * H);
    var pilha = [];
    var i, p;

    function claro(n) { var o = n * 4; return Math.min(px[o], px[o + 1], px[o + 2]) >= 190; }

    for (i = 0; i < W; i++) pilha.push(i, (H - 1) * W + i);
    for (i = 0; i < H; i++) pilha.push(i * W, i * W + W - 1);

    while (pilha.length) {
      p = pilha.pop();
      if (visto[p]) continue;
      visto[p] = 1;
      if (!claro(p)) continue;
      px[p * 4 + 3] = 0;
      var x = p % W, y = (p / W) | 0;
      if (x > 0) pilha.push(p - 1);
      if (x < W - 1) pilha.push(p + 1);
      if (y > 0) pilha.push(p - W);
      if (y < H - 1) pilha.push(p + W);
    }

    // suaviza o serrilhado: pixel claro encostado no vazio perde opacidade
    for (var yy = 1; yy < H - 1; yy++) {
      for (var xx = 1; xx < W - 1; xx++) {
        var k = yy * W + xx;
        if (px[k * 4 + 3] === 0) continue;
        if (px[(k - 1) * 4 + 3] && px[(k + 1) * 4 + 3] && px[(k - W) * 4 + 3] && px[(k + W) * 4 + 3]) continue;
        var lum = 0.299 * px[k * 4] + 0.587 * px[k * 4 + 1] + 0.114 * px[k * 4 + 2];
        if (lum > 150) px[k * 4 + 3] = Math.max(0, Math.round(255 - (lum - 150) * 3.4));
      }
    }

    cx.putImageData(dados, 0, 0);
    return cv.toDataURL('image/png');
  }

  /* ================= barra do topo ================= */
  // único efeito ligado ao scroll: a barra escurece sobre a sessão de
  // promoções e a logo cresce enquanto o topo da hero está em cena
  function onScroll() {
    if (!ativo || !showcase) return;
    var r = showcase.getBoundingClientRect();
    document.body.classList.toggle('nav-dark', r.top < 80 && r.bottom > 80);
    document.body.classList.toggle('hero-logo', global.scrollY < 60);
  }

  /* ================= horizonte ================= */
  // sem preserveAspectRatio="none" não há distorção: o quadro larga/estreita
  // troca junto com a arte, e o SVG preenche a faixa exatamente
  var mqEstreito = global.matchMedia ? matchMedia('(max-width: 760px)') : null;

  function fitSea() {
    var svg = document.getElementById('seaSvg');
    if (!svg) return;
    var estreito = mqEstreito && mqEstreito.matches;
    svg.setAttribute('viewBox', estreito ? '0 0 760 300' : '0 0 1440 260');
    svg.parentNode.classList.toggle('is-narrow', !!estreito);
  }

  /* ================= carrossel de promoções ================= */
  // centralizado: um card por vez no meio, vizinhos espiando dos lados
  var car = { index: 0, timer: null, cards: [], step: 0, card: 0, vp: 0, len: 0, pausadoAte: 0 };
  var GAP = 22;

  function buildCarousel() {
    var track = $('#carTrack'), dots = $('#carDots');
    if (!track) return;
    var list = Store.bySessao('promocoes');
    if (!list.length) list = Store.products().filter(Store.hasPromo);

    if (!list.length) {
      track.innerHTML = '<p class="promo-empty">Nenhuma promoção ativa no momento — dá uma olhada na loja completa.</p>';
      dots.innerHTML = '';
      $('#carPrev').hidden = $('#carNext').hidden = true;
      return;
    }
    $('#carPrev').hidden = $('#carNext').hidden = false;

    track.innerHTML = list.map(function (p) {
      var promo = Store.hasPromo(p);
      return '' +
      '<article class="promo-card" data-open="' + UI.esc(p.id) + '">' +
        (promo ? '<div class="pc-off">-' + Store.discountOf(p) + '%</div>' : '') +
        '<div class="pc-img">' + UI.imgOrPlaceholder(p) + '</div>' +
        (p.marca ? '<span class="pc-brand">' + UI.esc(p.marca) + '</span>' : '') +
        '<h3>' + UI.esc(p.nome) + '</h3>' +
        '<div class="pc-prices">' +
          (promo ? '<span class="pc-old">' + Store.fmt(p.preco) + '</span>' : '') +
          '<span class="pc-new">' + Store.fmt(Store.priceOf(p)) + '</span>' +
        '</div>' +
        (p.puffs ? '<span class="pc-puffs">' + p.puffs.toLocaleString('pt-BR') + ' puffs</span>' : '') +
      '</article>';
    }).join('');

    car.cards = Array.prototype.slice.call(track.children);
    car.len = car.cards.length;
    car.index = 0;
    measure();
    renderDots();
    go(0);
    restart();
  }

  function measure() {
    var vp = $('#carViewport');
    if (!vp || !car.cards.length) return;
    // offsetWidth e não getBoundingClientRect: os cards fora do centro estão
    // com scale(.84), e o rect devolveria a largura já encolhida
    car.card = car.cards[0].offsetWidth;
    car.step = car.card + GAP;
    car.vp = vp.clientWidth;
  }

  function renderDots() {
    var dots = $('#carDots');
    if (!dots) return;
    var html = '';
    for (var i = 0; i < car.len; i++) html += '<button data-i="' + i + '" aria-label="Ir para ' + (i + 1) + '"></button>';
    dots.innerHTML = html;
  }

  function go(i) {
    if (!car.len || !car.step) return;
    car.index = ((i % car.len) + car.len) % car.len;
    var track = $('#carTrack');
    var meio = car.vp / 2 - (car.index * car.step + car.card / 2);
    track.style.transform = 'translateX(' + meio.toFixed(1) + 'px)';
    car.cards.forEach(function (c, n) { c.classList.toggle('is-active', n === car.index); });
    UI.$$('#carDots button').forEach(function (b, n) { b.classList.toggle('is-on', n === car.index); });
  }

  // pausa só quando alguém mexe de fato. Pausar no mouseenter travava o
  // carrossel na prática: ele ocupa o meio da tela, então o cursor vive em cima
  function segura() { car.pausadoAte = Date.now() + 6000; }

  function restart() {
    clearInterval(car.timer);
    if (reduced || car.len < 2) return;
    car.timer = setInterval(function () {
      if (Date.now() < (car.pausadoAte || 0)) return;
      go(car.index + 1);
    }, 3000);
  }

  function bindCarousel() {
    var vp = $('#carViewport');
    if (!vp) return;
    $('#carPrev').addEventListener('click', function () { segura(); go(car.index - 1); });
    $('#carNext').addEventListener('click', function () { segura(); go(car.index + 1); });
    $('#carDots').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) { segura(); go(+b.dataset.i); }
    });

    var x0 = null;
    vp.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; segura(); }, { passive: true });
    vp.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(car.index + (dx < 0 ? 1 : -1));
      x0 = null; segura();
    });
  }

  /* ================= faixa animada ================= */
  function buildTicker() {
    var t = $('#tickerTrack');
    if (!t) return;
    var items = String(Store.settings.tickerItems || '').split(',')
      .map(function (s) { return s.trim(); }).filter(Boolean);
    if (!items.length) items = ['Sunset Pod'];
    var one = items.map(function (s) { return '<span>' + UI.esc(s) + '</span>'; }).join('');
    t.innerHTML = one + one;
  }

  /* ================= textos configuráveis ================= */
  function applyTexts() {
    var s = Store.settings;
    var h = $('#heroTitle');
    if (h) h.innerHTML = UI.esc(s.heroTitle) + '<br><span>' + UI.esc(s.heroTitleHl) + '</span>';
    var sub = $('#heroSub'); if (sub) sub.textContent = s.heroSub;
    var k = $('#showcaseKicker'); if (k) k.textContent = s.showcaseKicker;
    var n = $('#shopNotice'); if (n) n.textContent = s.shopNotice;
  }

  /* ================= ciclo de vida ================= */
  function setActive(on) {
    ativo = on;
    if (on) { onScroll(); }
    else {
      document.body.classList.remove('nav-dark');
      document.body.classList.remove('hero-logo');
    }
  }

  function init() {
    showcase = $('#showcase');
    if (!showcase) return;

    buildSun('sunRays', 94, 188, 15, 200, 200);
    recortarPod();
    fitSea();
    if (mqEstreito && mqEstreito.addEventListener) mqEstreito.addEventListener('change', fitSea);
    bindCarousel();
    refresh();

    global.addEventListener('scroll', onScroll, { passive: true });

    var rz;
    global.addEventListener('resize', function () {
      clearTimeout(rz);
      rz = setTimeout(function () { fitSea(); measure(); renderDots(); go(car.index); }, 160);
    });
  }

  function refresh() {
    applyTexts();
    buildTicker();
    buildCarousel();
  }

  global.Hero = { init: init, refresh: refresh, setActive: setActive };
})(window);
