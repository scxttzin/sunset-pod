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
      var url = semFundo(origem, true);
      if (url) el.src = url;
      el.style.opacity = '1';
      // a versão sem o tom do sol serve de camada revelada pelo rastro
      trilhaMorph(el, semFundo(origem, false));
    };
    origem.onerror = function () { el.style.opacity = '1'; };
    origem.src = el.getAttribute('src');
  }

  function semFundo(img, tingir) {
    var W = img.naturalWidth, H = img.naturalHeight;
    if (!W || !H) return null;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var cx = cv.getContext('2d', { willReadFrequently: true });
    // mesmo realce que existia no CSS antes do multiply: e ele que mantem o
    // corpo preto e estoura o branco do logo, em vez de tudo virar marrom
    try { cx.filter = 'brightness(1.3) contrast(1.6) saturate(0.92)'; } catch (e) {}
    cx.drawImage(img, 0, 0);
    cx.filter = 'none';

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

    // Devolve o brilho quente que o multiply dava: ali o branco do aparelho
    // pegava a cor do sol atrás. Agora esse laranja é pintado na própria
    // imagem, então o visual é o mesmo sem depender do fundo.
    // É a mesma conta que o multiply fazia contra o sol — cor x sol / 255 —
    // só que aplicada de uma vez na imagem. O aparelho inteiro pega o tom
    // quente, o branco de dentro vira laranja e o corpo escuro segue escuro.
    var SOL = [235, 95, 30];
    if (tingir) {
      for (var n = 0; n < W * H; n++) {
        var o = n * 4;
        if (px[o + 3] === 0) continue;
        px[o]     = (px[o]     * SOL[0]) / 255;
        px[o + 1] = (px[o + 1] * SOL[1]) / 255;
        px[o + 2] = (px[o + 2] * SOL[2]) / 255;
      }
    }

    cx.putImageData(dados, 0, 0);
    return cv.toDataURL('image/png');
  }

  /* ================= rastro que revela o pod (só desktop) =================
     Passar o mouse abre um rastro de bolhas orgânicas que perfura o pod
     tingido de pôr do sol e mostra, no mesmo formato, a cor natural dele.
     Constantes e matemática das bolhas conforme o efeito de referência.   */
  var PONTOS_MAX = 60, CABECA_R = 140, RUIDO = 44,
      LADOS = 24, ESVAI = 0.92, PASSO_AMOSTRA = 8;

  function trilhaMorph(frente, urlRevelada) {
    if (!urlRevelada || reduced) return;
    // apenas em telas grandes com mouse de verdade
    var ok = global.matchMedia &&
      matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)').matches;
    if (!ok) return;

    var palco = $('.hero'), berco = frente.parentNode;
    if (!palco || !berco) return;

    var revelada = new Image();
    revelada.className = frente.className + ' pod-photo--reveal';
    revelada.alt = '';
    revelada.setAttribute('aria-hidden', 'true');
    // .pod-photo nasce com opacity:0 (fade do recorte); sem isso a camada
    // revelada fica invisivel e o rastro só abre buracos no pod
    revelada.style.opacity = '1';
    revelada.src = urlRevelada;
    berco.appendChild(revelada);

    var cvFrente = document.createElement('canvas');
    var cvRevela = document.createElement('canvas');
    var ctxF = cvFrente.getContext('2d'), ctxR = cvRevela.getContext('2d');

    var pontos = [], raio = 0, sobre = false, tempo = 0;
    var mx = 0, my = 0, ultX = null, ultY = null, quadro = null;

    function medir() {
      var r = berco.getBoundingClientRect();
      var l = Math.max(1, Math.round(Math.min(r.width, 640)));
      if (cvFrente.width !== l) { cvFrente.width = cvFrente.height = l; cvRevela.width = cvRevela.height = l; }
      return r;
    }

    // bolha organica: 24 pontos com tres senoides somadas, fechada em curvas
    function bolha(ctx, cx, cy, r, t, semente) {
      if (r < 2) return;
      var pts = [], i, a, n1, n2, n3, ruido, raioP;
      for (i = 0; i < LADOS; i++) {
        a = (i / LADOS) * Math.PI * 2;
        n1 = Math.sin(a * 3 + t * 1.4 + semente) * 0.45;
        n2 = Math.sin(a * 5 - t * 0.9 + semente * 2.3) * 0.3;
        n3 = Math.cos(a * 2 + t * 1.8 + semente * 0.7) * 0.25;
        ruido = (n1 + n2 + n3) * RUIDO * (r / CABECA_R);
        raioP = r + ruido;
        pts.push([cx + Math.cos(a) * raioP, cy + Math.sin(a) * raioP]);
      }
      ctx.beginPath();
      var mX = (pts[LADOS - 1][0] + pts[0][0]) / 2, mY = (pts[LADOS - 1][1] + pts[0][1]) / 2;
      ctx.moveTo(mX, mY);
      for (i = 0; i < LADOS; i++) {
        var p = pts[i], q = pts[(i + 1) % LADOS];
        ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      ctx.closePath();
      ctx.fill();
    }

    function desenhar(ctx, inverter) {
      var l = ctx.canvas.width;
      ctx.clearRect(0, 0, l, l);
      if (!inverter) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, l, l); }
      ctx.globalCompositeOperation = inverter ? 'source-over' : 'destination-out';
      ctx.fillStyle = '#fff';
      for (var i = 0; i < pontos.length; i++) {
        var p = pontos[i];
        ctx.globalAlpha = p.alpha;
        bolha(ctx, p.x, p.y, p.r, tempo, p.seed);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function aplicar(el, ctx) {
      var u = 'url(' + ctx.canvas.toDataURL() + ')';
      el.style.webkitMaskImage = u; el.style.maskImage = u;
      el.style.webkitMaskSize = '100% 100%'; el.style.maskSize = '100% 100%';
      el.style.webkitMaskRepeat = 'no-repeat'; el.style.maskRepeat = 'no-repeat';
    }

    function limpar() {
      frente.style.webkitMaskImage = frente.style.maskImage = '';
      revelada.style.webkitMaskImage = revelada.style.maskImage = 'linear-gradient(#0000,#0000)';
    }

    function passo() {
      var r = medir();
      var escala = cvFrente.width / (r.width || 1);
      var alvo = sobre ? CABECA_R : 0;
      raio += (alvo - raio) * (sobre ? 0.14 : 0.04);

      if (sobre && raio > 5) {
        var cx = (mx - r.left) * escala, cy = (my - r.top) * escala;
        if (ultX === null || Math.hypot(cx - ultX, cy - ultY) > PASSO_AMOSTRA) {
          pontos.push({ x: cx, y: cy, r: raio, alpha: 1, seed: Math.random() * 100 });
          if (pontos.length > PONTOS_MAX) pontos.shift();
          ultX = cx; ultY = cy;
        }
      }

      for (var i = pontos.length - 1; i >= 0; i--) {
        pontos[i].alpha *= ESVAI;
        pontos[i].r *= 0.995;
        if (pontos[i].alpha < 0.01) pontos.splice(i, 1);
      }
      tempo += 0.016;

      if (!pontos.length && raio < 1) { limpar(); quadro = null; return; }

      desenhar(ctxF, false);
      desenhar(ctxR, true);
      aplicar(frente, ctxF);
      aplicar(revelada, ctxR);
      quadro = requestAnimationFrame(passo);
    }

    function acordar() { if (!quadro) quadro = requestAnimationFrame(passo); }

    palco.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; sobre = true; acordar(); });
    palco.addEventListener('mouseenter', function (e) { mx = e.clientX; my = e.clientY; sobre = true; acordar(); });
    palco.addEventListener('mouseleave', function () { sobre = false; ultX = ultY = null; acordar(); });

    limpar();
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

  /* ================= botão elástico ("Conferir loja") =================
     Mola de verdade: velocidade e amortecimento a cada quadro, em vez de
     uma curva pronta. Ela oscila e assenta sozinha.                     */
  function molaBotao() {
    var btn = $('.btn-big');
    if (!btn || reduced) return;

    var escala = 1, vel = 0, alvo = 1, quadro = null, visivel = true;

    function passo() {
      var forca = (alvo - escala) * 0.22;   // rigidez da mola
      vel = (vel + forca) * 0.72;           // amortecimento
      escala += vel;

      // assentou: encosta no alvo e dorme, pra não segurar um rAF eterno
      if (Math.abs(vel) < 0.0003 && Math.abs(alvo - escala) < 0.001) {
        escala = alvo; quadro = null;
        btn.style.transform = alvo === 1 ? '' : 'scale(' + alvo + ')';
        return;
      }
      btn.style.transform = 'scale(' + escala.toFixed(4) + ')';
      quadro = requestAnimationFrame(passo);
    }

    function acordar() { if (!quadro && visivel) quadro = requestAnimationFrame(passo); }
    function mira(v) { alvo = v; acordar(); }

    btn.addEventListener('pointerenter', function () { mira(1.14); });
    btn.addEventListener('pointerleave', function () { mira(1); });
    btn.addEventListener('pointerdown', function () { mira(0.9); });
    btn.addEventListener('pointerup', function () { mira(1.14); });
    btn.addEventListener('pointercancel', function () { mira(1); });

    // só gasta quadro enquanto o botão está em cena
    if (global.IntersectionObserver) {
      new IntersectionObserver(function (e) {
        visivel = e[0].isIntersecting;
        if (visivel) acordar();
        else if (quadro) { cancelAnimationFrame(quadro); quadro = null; }
      }, { threshold: 0 }).observe(btn);
    }
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
    molaBotao();
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
