/* =====================================================================
   UI — helpers, cards, modal, toast
   ===================================================================== */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------------- toast ---------------- */
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2800);
  }

  /* ---------------- modal ---------------- */
  function openModal(innerHTML, opts) {
    opts = opts || {};
    closeModal();
    var back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = '<div class="modal ' + (opts.className || '') + '" role="dialog" aria-modal="true">' +
      '<button class="modal-x" aria-label="Fechar">&times;</button>' + innerHTML + '</div>';
    back.addEventListener('click', function (e) {
      if (e.target === back || e.target.classList.contains('modal-x')) closeModal();
    });
    document.getElementById('modalRoot').appendChild(back);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onEsc);
    return back;
  }
  function onEsc(e) { if (e.key === 'Escape') closeModal(); }
  function closeModal() {
    var root = document.getElementById('modalRoot');
    if (root) root.innerHTML = '';
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onEsc);
  }

  /* ---------------- ilustração padrão do pod ---------------- */
  // cada instância precisa de um id próprio: o mesmo produto pode ser desenhado
  // em abas ocultas, e o url(#id) resolveria para o gradiente que não é pintado
  var phSeq = 0;
  function podPlaceholder(color, label) {
    var c = color || '#E24A12';
    var initial = esc((label || 'S').trim().charAt(0).toUpperCase());
    var gid = 'pod-g-' + (++phSeq);
    return '' +
      '<svg viewBox="0 0 140 210" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;padding:14px">' +
        '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="' + c + '" stop-opacity=".55"/>' +
        '<stop offset=".45" stop-color="' + c + '"/>' +
        '<stop offset="1" stop-color="' + c + '" stop-opacity=".6"/></linearGradient></defs>' +
        '<ellipse cx="70" cy="198" rx="42" ry="7" fill="#2E2019" opacity=".14"/>' +
        '<rect x="56" y="8" width="28" height="30" rx="10" fill="#2E2019" opacity=".8"/>' +
        '<rect x="26" y="32" width="88" height="162" rx="24" fill="url(#' + gid + ')"/>' +
        '<rect x="96" y="48" width="12" height="130" rx="6" fill="#2E2019" opacity=".18"/>' +
        '<rect x="34" y="46" width="9" height="134" rx="5" fill="#FFF6E6" opacity=".35"/>' +
        '<text x="70" y="130" text-anchor="middle" font-family="Lilita One, Impact, sans-serif" font-size="52" fill="#FFF6E6" opacity=".85">' + initial + '</text>' +
      '</svg>';
  }

  function imgOrPlaceholder(p) {
    if (p.imagem) {
      return '<img src="' + esc(p.imagem) + '" alt="' + esc(p.nome) + '" loading="lazy" ' +
        'onerror="this.outerHTML=UI.podPlaceholder(\'' + esc(p.cor) + '\',\'' + esc(p.marca || p.nome) + '\')">';
    }
    return podPlaceholder(p.cor, p.marca || p.nome);
  }

  /* ---------------- card de produto ---------------- */
  function productCard(p) {
    var promo = Store.hasPromo(p);
    var stock = Store.inStock(p);
    var open = Store.settings.storeOpen;
    var badges = '';
    if (promo) badges += '<span>-' + Store.discountOf(p) + '%</span>';
    if (p.maisVendido) badges += '<span class="b-best">Mais vendido</span>';
    if (!stock) badges += '<span class="b-out">Esgotado</span>';

    var tags = [];
    if (p.puffs) tags.push(p.puffs.toLocaleString('pt-BR') + ' puffs');
    if (p.sabores[0]) tags.push(p.sabores[0]);
    if (p.tags[0]) tags.push(p.tags[0]);

    return '' +
    '<article class="card' + (stock ? '' : ' is-out') + '" data-id="' + esc(p.id) + '">' +
      '<div class="card-img" data-open="' + esc(p.id) + '">' +
        (badges ? '<div class="badge">' + badges + '</div>' : '') +
        imgOrPlaceholder(p) +
      '</div>' +
      '<div class="card-body">' +
        (p.marca ? '<span class="card-brand">' + esc(p.marca) + '</span>' : '') +
        '<h3 class="card-name" data-open="' + esc(p.id) + '">' + esc(p.nome) + '</h3>' +
        '<div class="card-tags">' + tags.map(function (t) { return '<i>' + esc(t) + '</i>'; }).join('') + '</div>' +
        '<div class="card-price">' +
          (promo ? '<span class="price-old">' + Store.fmt(p.preco) + '</span>' : '') +
          '<span class="price-now' + (promo ? ' on-sale' : '') + '">' + Store.fmt(Store.priceOf(p)) + '</span>' +
        '</div>' +
        (open && stock
          ? '<a class="btn btn-zap" href="' + Store.zapLink(p) + '" target="_blank" rel="noopener">Pedir no Zap</a>'
          : '<button class="btn btn-ghost" disabled>' + (stock ? 'Loja fechada' : 'Sem estoque') + '</button>') +
      '</div>' +
    '</article>';
  }

  /* ---------------- modal do produto ---------------- */
  function openProduct(id) {
    var p = Store.byId(id);
    if (!p) return;
    var promo = Store.hasPromo(p);
    var stock = Store.inStock(p);
    var specs = [];
    if (p.puffs) specs.push(p.puffs.toLocaleString('pt-BR') + ' puffs');
    p.sabores.forEach(function (s) { specs.push(s); });
    p.tags.forEach(function (t) { specs.push(t); });

    openModal('' +
      '<div class="pm-grid">' +
        '<div class="pm-img">' + imgOrPlaceholder(p) + '</div>' +
        '<div class="pm-info">' +
          (p.marca ? '<span class="card-brand">' + esc(p.marca) + '</span>' : '') +
          '<h2>' + esc(p.nome) + '</h2>' +
          (p.descricao ? '<p class="pm-desc">' + esc(p.descricao) + '</p>' : '') +
          '<div class="pm-specs">' + specs.map(function (s) { return '<i>' + esc(s) + '</i>'; }).join('') + '</div>' +
          // preço e botão ficam num rodapé fixo: no celular eles não podem
          // depender de rolagem pra aparecer
          '<div class="pm-foot">' +
            '<div class="pm-price">' +
              (promo ? '<span class="price-old">' + Store.fmt(p.preco) + '</span>' : '') +
              '<span class="price-now' + (promo ? ' on-sale' : '') + '">' + Store.fmt(Store.priceOf(p)) + '</span>' +
              (promo ? '<span class="pm-off">-' + Store.discountOf(p) + '% OFF</span>' : '') +
            '</div>' +
            (Store.settings.storeOpen && stock
              ? '<a class="btn btn-zap btn-lg" href="' + Store.zapLink(p) + '" target="_blank" rel="noopener">Pedir no WhatsApp</a>'
              : '<button class="btn btn-ghost btn-lg" disabled>' + (stock ? 'Loja fechada no momento' : 'Produto esgotado') + '</button>') +
            '<p class="hint">Combinamos entrega e pagamento direto na conversa.</p>' +
          '</div>' +
        '</div>' +
      '</div>');
  }

  /* clique delegado para abrir produto */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-open]') : null;
    if (t) { e.preventDefault(); openProduct(t.getAttribute('data-open')); }
  });

  /* ---------------- links do WhatsApp ---------------- */
  function refreshZapLinks() {
    $$('.js-zap').forEach(function (a) {
      a.href = Store.zapLink(null);
      a.target = '_blank';
      a.rel = 'noopener';
    });
    var insta = $('#footInsta');
    if (insta) {
      var h = String(Store.settings.instagram || '').replace('@', '');
      insta.href = h ? 'https://instagram.com/' + h : '#';
      insta.textContent = Store.settings.instagram || 'Instagram';
    }
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  global.UI = {
    esc: esc, $: $, $$: $$,
    toast: toast,
    openModal: openModal, closeModal: closeModal,
    podPlaceholder: podPlaceholder, imgOrPlaceholder: imgOrPlaceholder,
    productCard: productCard, openProduct: openProduct,
    refreshZapLinks: refreshZapLinks,
    download: download
  };
})(window);
