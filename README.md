# Sunset Pod — vitrine

Site de vitrine da Sunset Pod: o cliente navega, escolhe o pod e o pedido é fechado no
WhatsApp. Três abas — **Início**, **Pods** e **Adm** — em HTML, CSS e JavaScript puros,
sem build e sem servidor.

---

## Rodando na sua máquina

Basta abrir o `index.html` com dois cliques. Para ver igual ao que vai pro ar (com
caminhos absolutos funcionando), suba o servidor local:

```bash
node dev-server.mjs
```

Depois acesse `http://localhost:5173`.

---

## As três abas

**Início** — hero com o pod flutuando no pôr do sol carioca (Dois Irmãos à esquerda, Pão
de Açúcar à direita). Logo abaixo vem a sessão escura de promoções, com o botão
**Conferir loja** e o carrossel passando um a um, o card do meio em destaque.

**Pods** — a loja. Barra de busca fixa no topo (procura por nome, marca, sabor, tag ou
puffs, e ignora acentos), botão **Filtros** que abre o painel de tags agrupadas por puffs,
sabores, marcas e tipo, e ordenação. Abaixo vêm as linhas *Os mais vendidos*, *Promoções*
e a grade com todos os produtos. Clicar num produto abre a ficha completa; o botão leva
pro WhatsApp com a mensagem já escrita.

**Adm** — o painel de gestão (senha padrão `sunset`).

---

## Painel Adm

| Aba | O que faz |
|---|---|
| **Produtos** | Cadastra, edita, duplica e exclui. Preço, promoção, puffs e estoque dá pra editar direto na tabela. |
| **Sessões** | Arrasta pra ordenar *Os mais vendidos* e as *Promoções* do carrossel, e liga/desliga produtos de cada sessão. |
| **Configurações** | Número do WhatsApp, mensagem padrão do pedido, Instagram, textos da home, aviso da loja, loja aberta/fechada e troca de senha. |
| **Publicar** | Exporta e importa os dados, restaura o catálogo original ou limpa tudo. |

No cadastro de produto, as **tags** são o que vira filtro na loja — vale a pena usar sempre
os mesmos termos (`Descartável`, `Recarregável`, `Gelado`…). A imagem pode ser uma URL ou
um arquivo enviado do computador (é reduzido pra 720px automaticamente).

---

## Publicando as alterações

O painel salva tudo no **navegador** (localStorage), então as mudanças ainda não aparecem
para os clientes. Para publicar:

1. **Adm → Publicar → Exportar dados** — baixa um arquivo `seed.js`.
2. Substitua o `data/seed.js` do projeto por esse arquivo baixado.
3. Suba a pasta para a hospedagem.

O campo `version` sobe sozinho a cada exportação. Quando o cliente abre o site com uma
versão maior que a guardada no navegador dele, o catálogo novo entra automaticamente.

> Se depois de publicar você ainda vir o catálogo antigo, é cache do navegador segurando o
> `seed.js`. Um refresh forçado (`Ctrl + F5`) resolve.

### Onde hospedar

Qualquer hospedagem de site estático serve — Netlify, Vercel, GitHub Pages, Hostinger.
É só arrastar a pasta inteira. Não precisa de banco de dados nem de backend.

---

## Estrutura

```
index.html            as três abas
css/style.css         identidade visual (bege, laranja, marrom)
js/store.js           dados: catálogo, configurações, importar/exportar
js/ui.js              cards, ficha do produto, avisos
js/hero.js            sol e horizonte da hero, carrossel e faixa animada
js/shop.js            busca, filtros e grade da loja
js/admin.js           painel administrativo
js/app.js             navegação entre as abas
data/seed.js          catálogo publicado  ← é este que você troca ao publicar
assets/               logo e fotos dos produtos
dev-server.mjs        servidor local pra testar
```

---

## Pontos de atenção

- **A senha do painel é client-side.** Ela impede que um curioso mexa na vitrine, mas
  qualquer pessoa com conhecimento técnico consegue lê-la no código. Não use a mesma senha
  de outros serviços. Se um dia o site precisar de proteção de verdade, o caminho é ligar
  um backend (Supabase, Firebase) — a camada `js/store.js` foi escrita pensando nisso.
- **Imagens enviadas pelo painel** ficam embutidas nos dados. O navegador guarda uns 5 MB
  no total, então prefira URLs de imagem quando o catálogo crescer.
- **Trocar o número do WhatsApp:** Adm → Configurações → Número do WhatsApp (com DDI e DDD,
  só números — hoje `5521987390771`). Vale para todos os botões do site de uma vez.
- O rodapé traz o aviso legal de venda proibida para menores de 18 anos e de presença de
  nicotina — recomendo manter, é exigência da Anvisa para esse tipo de produto.
