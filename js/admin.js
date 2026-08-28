/* =====================================================================
   ADMIN — CRUD de produtos, sessões, configurações e publicação
   ===================================================================== */
(function (global) {
  'use strict';

  var $ = UI.$, $$ = UI.$$;
  var SESSION = 'sunsetpod:adm';
  var filter = '';

  /* ================= login ================= */
  function isLogged() { try { return sessionStorage.getItem(SESSION) === '1'; } catch (e) { return false; } }
  function setLogged(v) { try { v ? sessionStorage.setItem(SESSION, '1') : sessionStorage.removeItem(SESSION); } catch (e) {} }

  function paintAuth() {
    var logged = isLogged();
    $('#admLogin').hidden = logged;
    $('#admPanel').hidden = !logged;
    if (logged) renderAll();
  }

  /* ================= estatísticas ================= */
  function renderStats() {
    var all = Store.products(true);
    var ativos = all.filter(function (p) { return p.ativo; });
    var promo = ativos.filter(Store.hasPromo);
    var sem = ativos.filter(function (p) { return !Store.inStock(p); });
    var medio = ativos.length
      ? ativos.reduce(function (s, p) { return s + Store.priceOf(p); }, 0) / ativos.length : 0;

    // quantas marcas diferentes existem no catálogo
    var marcas = {};
    all.forEach(function (p) { if (p.marca) marcas[p.marca] = true; });
    var diversos = Object.keys(marcas).length;

    $('#admStats').innerHTML = [
      ['Produtos', all.length],
      ['No ar', ativos.length],
      ['Em promoção', promo.length],
      ['Esgotados', sem.length],
      ['Ticket médio', Store.fmt(medio)],
      ['Produtos diversos', diversos]
    ].map(function (s) {
      return '<div class="stat"><b>' + UI.esc(s[1]) + '</b><span>' + s[0] + '</span></div>';
    }).join('');

    // a versão continua à mão na aba Publicar, que é onde ela importa
    var v = $('#versaoAtual');
    if (v) v.textContent = 'v' + Store.state.version;
  }

  /* ================= tabela de produtos ================= */
  function renderTable() {
    var f = filter.toLowerCase();
    var list = Store.products(true).filter(function (p) {
      return !f || (p.nome + ' ' + p.marca + ' ' + p.tags.join(' ') + ' ' + p.sabores.join(' ')).toLowerCase().indexOf(f) >= 0;
    });

    $('#admTbody').innerHTML = list.map(function (p) {
      var thumb = p.imagem
        ? '<img class="t-thumb" src="' + UI.esc(p.imagem) + '" alt="" onerror="this.style.visibility=\'hidden\'">'
        : '<div class="t-thumb">' + UI.podPlaceholder(p.cor, p.marca || p.nome) + '</div>';
      return '<tr data-id="' + UI.esc(p.id) + '">' +
        '<td>' + thumb + '</td>' +
        '<td class="t-name">' + UI.esc(p.nome) +
          (p.sabores.length ? '<small>' + UI.esc(p.sabores.join(' · ')) + '</small>' : '') + '</td>' +
        '<td>' + UI.esc(p.marca || '—') + '</td>' +
        '<td><input class="t-input narrow" type="number" min="0" step="100" value="' + p.puffs + '" data-f="puffs"></td>' +
        '<td><input class="t-input" type="number" min="0" step="0.01" value="' + p.preco + '" data-f="preco"></td>' +
        '<td><input class="t-input" type="number" min="0" step="0.01" placeholder="—" value="' + (p.precoPromo == null ? '' : p.precoPromo) + '" data-f="precoPromo"></td>' +
        '<td><input class="t-input narrow" type="number" min="0" step="1" value="' + p.estoque + '" data-f="estoque"></td>' +
        '<td>' +
          '<button class="flagbtn' + (p.maisVendido ? ' is-on' : '') + '" data-flag="maisVendido">Vendido</button>' +
          '<button class="flagbtn promo' + (p.promo ? ' is-on' : '') + '" data-flag="promo">Promo</button>' +
          '<button class="flagbtn off' + (!p.ativo ? ' is-on' : '') + '" data-flag="ativo">' + (p.ativo ? 'No ar' : 'Oculto') + '</button>' +
        '</td>' +
        '<td><div class="rowacts">' +
          '<button class="iconbtn" data-act="edit" title="Editar">✎</button>' +
          '<button class="iconbtn" data-act="dup" title="Duplicar">⧉</button>' +
          '<button class="iconbtn del" data-act="del" title="Excluir">🗑</button>' +
        '</div></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="9" style="padding:26px;text-align:center;color:#7A5540">Nenhum produto encontrado.</td></tr>';
  }

  function onTableInput(e) {
    var inp = e.target.closest('.t-input');
    if (!inp) return;
    var tr = inp.closest('tr');
    var p = Store.byId(tr.dataset.id);
    if (!p) return;
    var f = inp.dataset.f;
    var v = inp.value.trim();
    if (f === 'precoPromo') p.precoPromo = v === '' ? null : parseFloat(v);
    else p[f] = parseFloat(v) || 0;
    if (f === 'precoPromo') p.promo = Store.hasPromo(p);
    Store.commit();
    renderStats();
    if (f === 'precoPromo') renderTable();
  }

  function onTableClick(e) {
    var tr = e.target.closest('tr');
    if (!tr || !tr.dataset.id) return;
    var p = Store.byId(tr.dataset.id);
    if (!p) return;

    var flag = e.target.closest('.flagbtn');
    if (flag) {
      var k = flag.dataset.flag;
      p[k] = !p[k];
      if (k === 'promo' && p.promo && !Store.hasPromo(p)) {
        UI.toast('Defina um preço promocional menor que o preço cheio.');
        p.promo = false;
      }
      Store.commit();
      renderTable(); renderStats(); renderSessoes();
      return;
    }

    var act = e.target.closest('[data-act]');
    if (!act) return;
    var a = act.dataset.act;
    if (a === 'edit') openForm(p);
    if (a === 'dup') {
      var copy = JSON.parse(JSON.stringify(p));
      copy.id = Store.newId();
      copy.nome = p.nome + ' (cópia)';
      copy.ordem = Store.products(true).length + 1;
      copy.maisVendido = false; copy.promo = false;
      Store.state.products.push(copy);
      Store.commit();
      renderAll();
      UI.toast('Produto duplicado.');
    }
    if (a === 'del') {
      if (!confirm('Excluir "' + p.nome + '" definitivamente?')) return;
      Store.state.products = Store.state.products.filter(function (x) { return x.id !== p.id; });
      Store.commit();
      renderAll();
      UI.toast('Produto excluído.');
    }
  }

  /* ================= formulário de produto ================= */
  function openForm(p) {
    var isNew = !p;
    p = p || Store.normalizeProduct({ id: Store.newId(), ordem: Store.products(true).length + 1 }, 0);

    UI.openModal(
      '<form class="form-grid" id="prodForm">' +
        '<h2>' + (isNew ? 'Novo produto' : 'Editar produto') + '</h2>' +
        '<label class="full">Nome<input name="nome" required value="' + UI.esc(p.nome === 'Sem nome' ? '' : p.nome) + '"></label>' +
        '<label>Marca<input name="marca" list="marcasList" value="' + UI.esc(p.marca) + '"></label>' +
        '<label>Puffs<input name="puffs" type="number" min="0" step="100" value="' + p.puffs + '"></label>' +
        '<label>Preço (R$)<input name="preco" type="number" min="0" step="0.01" required value="' + p.preco + '"></label>' +
        '<label>Preço promocional (R$)<input name="precoPromo" type="number" min="0" step="0.01" placeholder="vazio = sem promoção" value="' + (p.precoPromo == null ? '' : p.precoPromo) + '"></label>' +
        '<label>Estoque (unidades)<input name="estoque" type="number" min="0" step="1" value="' + p.estoque + '"></label>' +
        '<label>Ordem na vitrine<input name="ordem" type="number" min="0" step="1" value="' + p.ordem + '"></label>' +
        '<label class="full">Sabores <small>separados por vírgula</small><input name="sabores" value="' + UI.esc(p.sabores.join(', ')) + '"></label>' +
        '<label class="full">Tags <small>ex.: Descartável, Recarregável, Gelado — viram filtros na loja</small><input name="tags" value="' + UI.esc(p.tags.join(', ')) + '"></label>' +
        '<label class="full">Descrição<textarea name="descricao" rows="3">' + UI.esc(p.descricao) + '</textarea></label>' +
        '<label class="full">Imagem' +
          '<div class="img-picker">' +
            '<div class="img-preview" id="imgPrev">' + (p.imagem ? '<img src="' + UI.esc(p.imagem) + '" style="width:100%;height:100%;object-fit:contain">' : UI.podPlaceholder(p.cor, p.marca || 'S')) + '</div>' +
            '<div style="flex:1">' +
              '<input name="imagem" placeholder="URL da imagem ou envie um arquivo" value="' + UI.esc(p.imagem) + '">' +
              '<div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap">' +
                '<button type="button" class="btn btn-ghost btn-sm" id="pickFile">Enviar imagem</button>' +
                '<button type="button" class="btn btn-ghost btn-sm" id="clearImg">Remover</button>' +
                '<input type="file" id="imgFile" accept="image/*" hidden>' +
                '<label style="margin:0;display:flex;align-items:center;gap:6px;font-size:.78rem">Cor base<input name="cor" type="color" value="' + UI.esc(p.cor) + '" style="width:42px;height:30px;padding:2px;margin:0"></label>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</label>' +
        '<div class="full" style="display:flex;gap:20px;flex-wrap:wrap;margin-top:4px">' +
          '<label class="row-check"><input type="checkbox" name="maisVendido"' + (p.maisVendido ? ' checked' : '') + '> <span>Mais vendido</span></label>' +
          '<label class="row-check"><input type="checkbox" name="promo"' + (p.promo ? ' checked' : '') + '> <span>Promoção (carrossel do início)</span></label>' +
          '<label class="row-check"><input type="checkbox" name="ativo"' + (p.ativo ? ' checked' : '') + '> <span>Visível no site</span></label>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button type="button" class="btn btn-ghost" id="cancelForm">Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">' + (isNew ? 'Cadastrar produto' : 'Salvar alterações') + '</button>' +
        '</div>' +
      '</form>' +
      '<datalist id="marcasList">' + Store.facets().marcas.map(function (m) { return '<option value="' + UI.esc(m) + '">'; }).join('') + '</datalist>'
    );

    var form = $('#prodForm');
    var imgInput = form.imagem;

    function paintPreview(src) {
      $('#imgPrev').innerHTML = src
        ? '<img src="' + UI.esc(src) + '" style="width:100%;height:100%;object-fit:contain">'
        : UI.podPlaceholder(form.cor.value, form.marca.value || 'S');
    }
    imgInput.addEventListener('input', function () { paintPreview(imgInput.value.trim()); });
    form.cor.addEventListener('input', function () { if (!imgInput.value.trim()) paintPreview(''); });
    $('#clearImg').addEventListener('click', function () { imgInput.value = ''; paintPreview(''); });
    $('#pickFile').addEventListener('click', function () { $('#imgFile').click(); });
    $('#imgFile').addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      shrinkImage(file, function (dataUrl) {
        imgInput.value = dataUrl;
        paintPreview(dataUrl);
        UI.toast('Imagem carregada.');
      });
    });
    $('#cancelForm').addEventListener('click', UI.closeModal);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        id: p.id,
        nome: form.nome.value.trim(),
        marca: form.marca.value.trim(),
        descricao: form.descricao.value.trim(),
        preco: form.preco.value,
        precoPromo: form.precoPromo.value,
        puffs: form.puffs.value,
        estoque: form.estoque.value,
        ordem: form.ordem.value,
        sabores: form.sabores.value,
        tags: form.tags.value,
        imagem: form.imagem.value.trim(),
        cor: form.cor.value,
        maisVendido: form.maisVendido.checked,
        promo: form.promo.checked,
        ativo: form.ativo.checked
      };
      var np = Store.normalizeProduct(data, 0);
      if (np.promo && !Store.hasPromo(np)) {
        np.promo = false;
        UI.toast('Sem preço promocional válido — produto salvo fora da promoção.');
      }
      var existing = Store.byId(p.id);
      if (existing) Object.assign(existing, np);
      else Store.state.products.push(np);
      Store.commit();
      UI.closeModal();
      renderAll();
      UI.toast(existing ? 'Produto atualizado.' : 'Produto cadastrado!');
    });
  }

  /* redimensiona a imagem antes de guardar (localStorage é pequeno) */
  function shrinkImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 720;
        var s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var out = c.toDataURL('image/webp', 0.85);
        if (out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/png');
        if (out.length > 900000) UI.toast('Imagem pesada — prefira usar uma URL.');
        cb(out);
      };
      img.onerror = function () { UI.toast('Não consegui ler essa imagem.'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ================= sessões ================= */
  function sessItem(p, draggable) {
    var thumb = p.imagem
      ? '<img src="' + UI.esc(p.imagem) + '" alt="">'
      : '<div style="width:34px;height:34px;flex:none">' + UI.podPlaceholder(p.cor, p.marca || p.nome) + '</div>';
    return '<li draggable="' + (draggable ? 'true' : 'false') + '" data-id="' + UI.esc(p.id) + '">' +
      '<span class="grip">⠿</span>' + thumb +
      '<span class="s-name">' + UI.esc(p.nome) + '</span>' +
      '<button class="iconbtn" data-remove="1" title="Tirar da sessão">×</button></li>';
  }

  function renderSessoes() {
    var best = Store.bySessao('maisVendidos');
    var promo = Store.bySessao('promocoes');
    $('#listBest').innerHTML = best.map(function (p) { return sessItem(p, true); }).join('')
      || '<li style="cursor:default;color:#7A5540">Nenhum produto marcado.</li>';
    $('#listPromo').innerHTML = promo.map(function (p) { return sessItem(p, true); }).join('')
      || '<li style="cursor:default;color:#7A5540">Nenhuma promoção ativa.</li>';

    $('#sessToggles').innerHTML = Store.products(true).map(function (p) {
      return '<div class="sess-item" data-id="' + UI.esc(p.id) + '">' +
        '<span class="s-name">' + UI.esc(p.nome) + '</span>' +
        '<button class="flagbtn' + (p.maisVendido ? ' is-on' : '') + '" data-flag="maisVendido">★</button>' +
        '<button class="flagbtn promo' + (p.promo ? ' is-on' : '') + '" data-flag="promo">%</button>' +
      '</div>';
    }).join('');
  }

  function bindSessoes() {
    ['listBest', 'listPromo'].forEach(function (id) {
      var ul = document.getElementById(id);
      var key = id === 'listBest' ? 'maisVendidos' : 'promocoes';
      var dragged = null;

      ul.addEventListener('dragstart', function (e) {
        var li = e.target.closest('li[data-id]');
        if (!li) return;
        dragged = li;
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', li.dataset.id); } catch (err) {}
      });
      ul.addEventListener('dragend', function () {
        if (dragged) dragged.classList.remove('dragging');
        $$('#' + id + ' li').forEach(function (l) { l.classList.remove('over'); });
        dragged = null;
      });
      ul.addEventListener('dragover', function (e) {
        e.preventDefault();
        var li = e.target.closest('li[data-id]');
        if (!li || li === dragged || !dragged) return;
        $$('#' + id + ' li').forEach(function (l) { l.classList.remove('over'); });
        li.classList.add('over');
        var r = li.getBoundingClientRect();
        var after = (e.clientY - r.top) > r.height / 2;
        ul.insertBefore(dragged, after ? li.nextSibling : li);
      });
      ul.addEventListener('drop', function (e) {
        e.preventDefault();
        Store.state.sessoes[key] = $$('#' + id + ' li[data-id]').map(function (l) { return l.dataset.id; });
        Store.commit();
        renderSessoes();
        UI.toast('Ordem atualizada.');
      });

      ul.addEventListener('click', function (e) {
        var b = e.target.closest('[data-remove]');
        if (!b) return;
        var li = b.closest('li');
        var p = Store.byId(li.dataset.id);
        if (!p) return;
        p[key === 'maisVendidos' ? 'maisVendido' : 'promo'] = false;
        Store.commit();
        renderSessoes(); renderTable();
      });
    });

    $('#sessToggles').addEventListener('click', function (e) {
      var b = e.target.closest('.flagbtn');
      if (!b) return;
      var p = Store.byId(b.closest('.sess-item').dataset.id);
      if (!p) return;
      var k = b.dataset.flag;
      p[k] = !p[k];
      if (k === 'promo' && p.promo && !Store.hasPromo(p)) {
        p.promo = false;
        UI.toast('Defina um preço promocional para esse produto.');
      }
      Store.commit();
      renderSessoes(); renderTable(); renderStats();
    });
  }

  /* ================= configurações ================= */
  function renderConfig() {
    var f = $('#cfgForm'), s = Store.settings;
    ['whatsapp', 'msgTemplate', 'instagram', 'heroTitle', 'heroTitleHl', 'heroSub', 'showcaseKicker', 'tickerItems', 'shopNotice']
      .forEach(function (k) { if (f[k]) f[k].value = s[k] || ''; });
    f.storeOpen.checked = !!s.storeOpen;
    f.newPass.value = '';
  }

  function bindConfig() {
    $('#cfgForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, s = Store.settings;
      ['whatsapp', 'msgTemplate', 'instagram', 'heroTitle', 'heroTitleHl', 'heroSub', 'showcaseKicker', 'tickerItems', 'shopNotice']
        .forEach(function (k) { s[k] = f[k].value; });
      s.whatsapp = s.whatsapp.replace(/\D/g, '');
      s.storeOpen = f.storeOpen.checked;
      if (f.newPass.value.trim()) s.passHash = Store.hash(f.newPass.value.trim());
      Store.commit();
      renderConfig();
      UI.toast('Configurações salvas.');
    });
  }

  /* ================= publicar / dados ================= */
  function bindData() {
    $('#btnExport').addEventListener('click', function () {
      UI.download('seed.js', Store.exportText());
      renderStats();
      UI.toast('Arquivo gerado — substitua data/seed.js no site.');
    });
    $('#btnImport').addEventListener('click', function () { $('#fileImport').click(); });
    $('#fileImport').addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          Store.importText(r.result);
          renderAll();
          UI.toast('Dados importados com sucesso.');
        } catch (err) {
          UI.toast('Arquivo inválido: ' + err.message);
        }
      };
      r.readAsText(file);
      this.value = '';
    });
    $('#btnReseed').addEventListener('click', function () {
      if (!confirm('Restaurar o catálogo original? Suas alterações locais serão perdidas.')) return;
      Store.resetToSeed(); renderAll(); UI.toast('Catálogo restaurado.');
    });
    $('#btnWipe').addEventListener('click', function () {
      if (!confirm('Apagar TODOS os dados salvos neste navegador?')) return;
      Store.wipe(); renderAll(); UI.toast('Dados apagados.');
    });
    $('#btnLogout').addEventListener('click', function () { setLogged(false); paintAuth(); });
  }

  /* ================= render geral ================= */
  function renderAll() {
    if (!isLogged()) return;
    renderStats();
    renderTable();
    renderSessoes();
    renderConfig();
  }

  /* ================= init ================= */
  function init() {
    $('#admLoginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('#admPass').value;
      if (Store.checkPass(v)) { setLogged(true); $('#admPass').value = ''; paintAuth(); UI.toast('Bem-vindo de volta!'); }
      else UI.toast('Senha incorreta.');
    });

    $$('.atab').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.atab').forEach(function (x) { x.classList.remove('is-on'); });
        $$('.apane').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        document.getElementById('apane-' + b.dataset.atab).classList.add('is-on');
      });
    });

    $('#btnNew').addEventListener('click', function () { openForm(null); });
    $('#admSearch').addEventListener('input', function () { filter = this.value; renderTable(); });
    $('#admTbody').addEventListener('change', onTableInput);
    $('#admTbody').addEventListener('click', onTableClick);

    bindSessoes();
    bindConfig();
    bindData();
  }

  global.Admin = { init: init, paintAuth: paintAuth, renderAll: renderAll };
})(window);
