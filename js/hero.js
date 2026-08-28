/* =====================================================================
   HERO — pôr do sol, pod gigante, fumaça em canvas e carrossel de promos
   ===================================================================== */
(function (global) {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  var stage, hero, showcase, showInner, sky, sun, sea, copy, podWrap, cue, canvas, ctx;
  var active = false, raf = null, progress = 0;
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

  /* ================= fumaça ================= */
  var parts = [], W = 0, H = 0, DPR = 1, lastT = 0, emitAcc = 0, cristaAcc = 0;

  function sizeCanvas() {
    if (!canvas) return;
    DPR = Math.min(global.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // onde fica o bocal dentro da foto do pod (fração da largura/altura)
  var TIP = { x: 0.55, y: 0.235 };

  // a boca acompanha o giro do pod: em pé fica no topo, virado fica embaixo
  function emitter() {
    if (!podWrap) return { x: W / 2, y: H * 0.3 };
    var r = podWrap.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = (TIP.x - 0.5) * podWrap.offsetWidth;
    var dy = (TIP.y - 0.5) * podWrap.offsetHeight;
    var a = podRot * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    return {
      x: cx + podScale * (dx * cos - dy * sin),
      y: cy + podScale * (dx * sin + dy * cos)
    };
  }

  // três origens: 'jato' (a ponta do pod), 'crista' (bufos na borda do banco
  // de fumaça) e 'ambiente' (fiapos soltos rolando na sessão escura)
  function spawn(p, tipo) {
    var e, vx, vy, r, grow, max, a, push;
    var REF = Math.min(W, H) || 800;   // baliza de tamanho: 375px e 1500px pedem puffs diferentes

    if (tipo === 'crista') {
      e = { x: Math.random() * (W + 200) - 100, y: bankTop + 40 + Math.random() * 90 };
      vx = (Math.random() - 0.5) * 1.4;
      vy = -(0.5 + Math.random() * 1.1);
      r = REF * 0.10 + Math.random() * REF * 0.11;
      grow = REF * (0.0006 + Math.random() * 0.0006);
      max = 1500 + Math.random() * 900;
      a = 0.075 + Math.random() * 0.07;
      push = (Math.random() < 0.5 ? -1 : 1) * (0.0008 + Math.random() * 0.002);
    } else if (tipo === 'ambiente') {
      e = { x: Math.random() * W, y: H + 60 };
      vx = (Math.random() - 0.5) * 0.4;
      vy = -(0.18 + Math.random() * 0.25);
      r = REF * 0.18 + Math.random() * REF * 0.22;
      grow = 0.3;
      max = 1000;
      a = 0.05 + Math.random() * 0.05;
      push = 0;
    } else {
      // o jato acompanha o giro: ponta pra cima sobe, ponta pra baixo desce
      e = emitter();
      var dir = lerp(-1, 1, podRot / 180);
      vx = (Math.random() - 0.5) * lerp(0.8, 3.4, p);
      vy = dir * (lerp(1.8, 3.6, p) + Math.random() * 1.4);
      r = REF * lerp(0.02, 0.042, p) + Math.random() * REF * 0.018;
      grow = REF * lerp(0.0005, 0.0011, p);
      max = lerp(360, 620, p);
      a = 0.10 + Math.random() * 0.11;
      push = (Math.random() < 0.5 ? -1 : 1) * (0.001 + Math.random() * 0.004);
    }

    parts.push({
      x: e.x + (Math.random() - 0.5) * (tipo ? 0 : 30),
      y: e.y + (Math.random() - 0.5) * 14,
      vx: vx, vy: vy, r: r, grow: grow,
      life: 0, max: max, a: a, push: push,
      wob: Math.random() * Math.PI * 2,
      crista: tipo === 'crista',
      ember: !tipo && Math.random() < 0.04
    });
    if (parts.length > 240) parts.splice(0, parts.length - 240);
  }

  // o "banco" é a massa de fumaça que sobe do rodapé e engole a cena.
  // bankTop guarda a altura da crista pra soltar bufos exatamente nela.
  var bank = 0, bankTop = 0, cristas = 0;
  var canBlur = (function () {
    try { var c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; return c.filter !== 'none'; }
    catch (e) { return false; }
  })();

  function smoothstep(t) { return t * t * (3 - 2 * t); }

  function updateBank(p) {
    bank = smoothstep(clamp((p - 0.24) / 0.64, 0, 1));
    bankTop = H * (1.08 - bank * 1.24);
  }

  function drawParticles(dt, opacity) {
    var vivos = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var s = parts[i];
      s.life += dt;
      if (s.life > s.max) { parts.splice(i, 1); continue; }
      if (s.crista) vivos++;
      var t = s.life / s.max;
      s.wob += dt * 0.004;
      s.vx += s.push * dt;               // vai abrindo pros lados
      s.x += (s.vx + Math.sin(s.wob) * 0.55) * dt * 0.06;
      s.y += s.vy * dt * 0.06;
      s.vy *= 0.984;                     // perde impulso e fica boiando
      s.r += s.grow * dt * 0.06;

      var fade = t < 0.16 ? t / 0.16 : 1 - (t - 0.16) / 0.84;
      var alpha = s.a * fade * opacity;
      if (alpha <= 0.002) continue;

      var g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      if (s.ember) {
        g.addColorStop(0, 'rgba(255,170,80,' + (alpha * 1.5) + ')');
        g.addColorStop(0.4, 'rgba(226,74,18,' + (alpha * 0.5) + ')');
        g.addColorStop(1, 'rgba(226,74,18,0)');
      } else {
        // vapor morno, cor de areia clara — nunca branco puro
        g.addColorStop(0, 'rgba(243,228,205,' + alpha + ')');
        g.addColorStop(0.42, 'rgba(236,218,192,' + (alpha * 0.5) + ')');
        g.addColorStop(1, 'rgba(232,212,186,0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    cristas = vivos;
  }

  // massa de fumaça com a crista ondulando — é ela que cobre a cena e
  // entrega a cor da sessão 2, no lugar de um fade chapado
  function drawBank(alpha, tsec) {
    if (alpha <= 0.004) return;

    // uma passada só monta a silhueta; o desenho usa ela duas vezes
    var amp = Math.min(H, W) * 0.06;
    ctx.beginPath();
    ctx.moveTo(-80, H + 140);
    for (var x = -80; x <= W + 80; x += 14) {
      var crista =
        Math.sin(x * 0.0057 + tsec * 0.55) * amp * 0.7 +
        Math.sin(x * 0.0131 - tsec * 0.85) * amp * 0.32 +
        Math.sin(x * 0.0029 + tsec * 0.31) * amp;
      ctx.lineTo(x, bankTop + crista);
    }
    ctx.lineTo(W + 80, H + 140);
    ctx.closePath();

    // 1) a massa escura, que entrega a cor da sessão 2
    ctx.save();
    if (canBlur) ctx.filter = 'blur(26px)';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#241710';
    ctx.fill();
    ctx.restore();

    // 2) a borda iluminada pelo pôr do sol — é ela que faz virar fumaça
    //    aos olhos, e não um simples escurecimento
    ctx.save();
    if (canBlur) ctx.filter = 'blur(20px)';
    ctx.globalAlpha = Math.min(1, alpha * 0.62);
    ctx.strokeStyle = 'rgba(247,229,199,0.85)';
    ctx.lineWidth = Math.max(26, Math.min(H, W) * 0.07);
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawSmoke(dt, p, opacity, veilFade, tsec) {
    ctx.clearRect(0, 0, W, H);
    if (opacity <= 0.001) { parts.length = 0; return; }
    drawParticles(dt, opacity);
    drawBank(bank * 0.97 * opacity * veilFade, tsec);
  }

  /* ================= animação por scroll ================= */
  // marcos da coreografia: o pod desce e vira a ponta pra baixo (0 → VIRA),
  // a fumaça começa a sair da ponta (FUMA) e só então o céu escurece
  var VIRA = 0.22, FUMA = 0.09, ESCURECE = 0.24;
  var podRot = 0, podScale = 1;

  function easeOut(t) { return 1 - Math.pow(1 - t, 2.2); }

  // quanto de fumaça já saiu (0 a 1) — comanda o escurecimento
  function smokeAmount(p) { return clamp((p - FUMA) / ESCURECE, 0, 1); }

  function applyHero(p) {
    var vh = global.innerHeight;
    var fuma = smokeAmount(p);

    // céu só entardece quando a fumaça aparece
    sky.style.filter = 'brightness(' + (1 - fuma * 0.34).toFixed(3) + ') saturate(' + (1 + fuma * 0.18).toFixed(2) + ')';

    // sol se põe atrás dos morros
    var sunP = easeOut(clamp(p / 0.7, 0, 1));
    sun.style.transform = 'translate(-50%,-50%) translateY(' + (sunP * vh * 0.6) + 'px) scale(' + (1 - sunP * 0.18).toFixed(3) + ')';
    sun.style.opacity = clamp(1 - sunP * 1.15, 0, 1);

    // texto sobe e some
    var cOut = clamp(p / 0.26, 0, 1);
    copy.style.transform = 'translateY(' + (-cOut * 140) + 'px)';
    copy.style.opacity = (1 - cOut).toFixed(3);

    // pod: desce girando até ficar de ponta-cabeça, com a ponta pra baixo
    var turn = easeOut(clamp(p / VIRA, 0, 1));
    podRot = turn * 180;
    var podY = turn * vh * 0.17 + clamp((p - VIRA) / (1 - VIRA), 0, 1) * vh * 0.06;
    podScale = 1 + turn * 0.12 - clamp((p - 0.6) / 0.4, 0, 1) * 0.12;
    podWrap.style.transform =
      'translate(-50%,-50%) translateY(' + podY.toFixed(1) + 'px) scale(' + podScale.toFixed(3) + ') rotate(' + podRot.toFixed(1) + 'deg)';
    podWrap.style.opacity = clamp(1 - (p - 0.82) / 0.12, 0, 1).toFixed(3);

    // mar
    sea.style.transform = 'translateY(' + (fuma * vh * 0.18) + 'px)';
    sea.style.opacity = clamp(1 - (fuma - 0.4) / 0.4, 0, 1);

    cue.style.opacity = clamp(1 - p * 7, 0, 1);
  }

  function smokeOpacity(p) {
    var vh = global.innerHeight;
    var r = showcase.getBoundingClientRect();
    var fadeOut = clamp(r.bottom / (vh * 0.7), 0, 1);
    return smokeAmount(p) * fadeOut;
  }

  function loop(now) {
    if (!active) { raf = null; return; }
    var dt = Math.min(now - (lastT || now), 60);
    lastT = now;

    var total = Math.max(1, stage.offsetHeight - global.innerHeight);
    var p = clamp(-stage.getBoundingClientRect().top / total, 0, 1);
    progress = p;

    applyHero(p);
    updateBank(p);

    var op = smokeOpacity(p);
    canvas.style.opacity = op.toFixed(3);

    // a massa escura só existe na virada; assim que a sessão 2 encosta no topo
    // ela sai e devolve a textura de ondas do fundo
    var shRect = showcase.getBoundingClientRect();
    var veilFade = clamp(shRect.top / (global.innerHeight * 0.45), 0, 1);

    if (!reduced && op > 0.01) {
      // enquanto o pod está em cena o jato manda; depois sobram os fiapos
      if (p < 0.86) {
        emitAcc += dt * (0.55 + p * 0.9) * 0.075;
        while (emitAcc >= 1) { spawn(p, null); emitAcc -= 1; }
      }
      // bufos na crista, pra massa subir encaracolada e não como uma régua
      if (bank > 0.02 && bank < 0.99 && cristas < 15) {
        cristaAcc += dt * 0.007;
        while (cristaAcc >= 1) { spawn(p, 'crista'); cristaAcc -= 1; }
      }
      if (p > 0.9 && parts.length < 26) spawn(p, 'ambiente');
    }
    drawSmoke(dt, p, op, veilFade, now * 0.001);

    // a sessão 2 nasce de dentro da fumaça
    var entra = clamp(1 - shRect.top / (global.innerHeight * 0.62), 0, 1);
    showInner.style.opacity = entra.toFixed(3);
    showInner.style.transform = 'translateY(' + ((1 - entra) * 46).toFixed(1) + 'px)';

    // nav escura sobre a sessão 2
    var shTop = showcase.getBoundingClientRect().top;
    var shBot = showcase.getBoundingClientRect().bottom;
    document.body.classList.toggle('nav-dark', shTop < 80 && shBot > 80);
    document.body.classList.toggle('hero-logo', p < 0.30);

    raf = requestAnimationFrame(loop);
  }

  function setActive(on) {
    active = on;
    if (on) {
      sizeCanvas();
      lastT = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    } else {
      document.body.classList.remove('nav-dark');
      document.body.classList.remove('hero-logo');
      if (showInner) { showInner.style.opacity = ''; showInner.style.transform = ''; }
      if (canvas) canvas.style.opacity = 0;
      parts.length = 0;
      if (ctx) ctx.clearRect(0, 0, W, H);
    }
  }

  /* ================= carrossel de promoções ================= */
  var car = { index: 0, timer: null, cards: [], step: 0, perView: 1, len: 0 };

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

  // carrossel centralizado: um card por vez no meio, vizinhos espiando dos
  // lados. Alinhado à esquerda o último card sempre ficava cortado pela metade.
  var GAP = 22;

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

  /* ================= textos configuráveis ================= */
  function applyTexts() {
    var s = Store.settings;
    var h = $('#heroTitle');
    if (h) h.innerHTML = UI.esc(s.heroTitle) + '<br><span>' + UI.esc(s.heroTitleHl) + '</span>';
    var sub = $('#heroSub'); if (sub) sub.textContent = s.heroSub;
    var k = $('#showcaseKicker'); if (k) k.textContent = s.showcaseKicker;
    var n = $('#shopNotice'); if (n) n.textContent = s.shopNotice;
  }

  /* ================= init ================= */
  function init() {
    stage = $('#stage'); hero = $('#hero'); showcase = $('#showcase');
    showInner = showcase.querySelector('.showcase-inner');
    sky = $('#heroSky'); sun = $('#heroSun'); sea = $('#heroSea');
    copy = $('#heroCopy'); podWrap = $('#podWrap'); cue = $('#scrollCue');
    canvas = $('#smoke');
    if (!stage || !canvas) return;
    ctx = canvas.getContext('2d');

    buildSun('sunRays', 94, 188, 15, 200, 200);

    sizeCanvas();
    fitSea();
    if (mqEstreito && mqEstreito.addEventListener) mqEstreito.addEventListener('change', fitSea);
    bindCarousel();
    refresh();

    var rz;
    global.addEventListener('resize', function () {
      clearTimeout(rz);
      rz = setTimeout(function () { sizeCanvas(); fitSea(); measure(); renderDots(); go(car.index); }, 160);
    });
  }

  function refresh() {
    applyTexts();
    buildTicker();
    buildCarousel();
  }

  global.Hero = { init: init, refresh: refresh, setActive: setActive };
})(window);
