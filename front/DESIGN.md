---
name: Fotoville
description: Loja de revelação fotográfica com a linguagem do envelope de laboratório.
colors:
  paper: "#f3f5f7"
  surface: "#fcfdfe"
  ink: "#1b1f33"
  ink-2: "#4e546a"
  ink-3: "#5f6579"
  rule: "#d3d7e0"
  field: "#7b8197"
  action: "#4f5d9e"
  action-strong: "#3e4a85"
  action-soft: "#e5e8f3"
  blade-olive: "#6f8d3a"
  blade-mustard: "#b39340"
  blade-rust: "#a5593f"
  blade-plum: "#60344c"
  blade-indigo: "#4f5d9e"
  blade-teal: "#316665"
  success: "#2f6b2f"
  success-soft: "#e6f1e3"
  warning: "#7a5300"
  warning-soft: "#fbf1d6"
  danger: "#a3261d"
  danger-soft: "#fbe9e7"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.15rem to 3rem"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.02em"
    fontStretch: "118%"
  display-md:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem to 2.25rem"
    fontWeight: 750
    lineHeight: 1.1
    letterSpacing: "-0.01em"
    fontStretch: "112%"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
rounded:
  print: "2px"
  badge: "3px"
  control: "6px"
  panel: "10px"
spacing:
  gutter: "16px"
  gutter-sm: "24px"
  section: "64px"
  section-lg: "96px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.action-strong}"
  button-outline:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  print:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.print}"
  badge:
    rounded: "{rounded.badge}"
---

# Fotoville: sistema de design

Escrito depois da construção, a partir do código em `src/app/globals.css` e dos componentes. Contrato de direção em
`design/DIRECTION.md`, verdade do produto em `design/PRODUCT.md`. Sombras, movimento e foco ficam em
`.impeccable/design.json`.

## Overview

O site é o envelope de revelação do laboratório: o cliente marca tamanho e cópias como nos quadradinhos
do envelope, sobre papel fotográfico branco e frio, com tinta índigo. As seis lâminas do diafragma do logo aparecem
como campos inteiros de cor (régua de tamanhos em petróleo, pacotes em mostarda) e como preenchimento das fotos
desenhadas.
O elemento memorável é a régua de tamanhos, com as fotos lado a lado na escala real e um celular de referência.
Tema único claro, escolhido pela cena de uso: a borda branca da foto precisa ler como papel.

## Colors

- **Superfícies:** `paper` é o fundo da página; `surface` é o branco dos impressos, painéis e campos.
- **Tinta:** `ink` para texto e títulos, `ink-2` para texto secundário, `ink-3` para texto de exemplo nos campos.
- **Ação:** `action` é a única cor de controle no site (botões, links, foco, seleção). `action-strong` no hover,
  `action-soft` para fundo de item selecionado.
- **Lâminas:** só como campo de seção ou foto desenhada. Nunca em botão, link ou ícone. Texto sobre petróleo,
  ferrugem, ameixa e índigo é `surface`; sobre mostarda é `ink`. Sobre oliva não vai texto.
- **Estados:** `success`, `warning` e `danger`, cada um com fundo `-soft`.
- **Contraste medido:** texto principal 14,9:1, secundário 6,9:1, texto de exemplo 5,7:1, borda de campo 3,8:1,
  botão 6,1:1, petróleo com texto claro 4,9:1, mostarda com tinta 5,6:1.

## Typography

Uma família, Archivo variável, com duas vozes pelo eixo de largura. Títulos em `display` (800, largura 118%) e
subtítulos e números de destaque em `display-md` / `font-display` (largura 112%). Texto em 400, rótulos em 600.
Corpo nunca abaixo de 16px, linhas de até 60 a 68 caracteres, títulos com `text-wrap: balance`. Preços sempre com
`tabular-nums`. Frases em caixa normal, sem rótulos em maiúsculas.

## Layout

Contêiner de 1200px com respiro lateral de 16px (24px a partir de 640px). Seções com 64px de altura de respiro
(80 a 96px nas seções principais da home).

**Home, nesta ordem:** topo em duas colunas no desktop (foto até a borda esquerda; título, uma frase, botão "Enviar
fotos" e link "Ver preços" à direita); régua "Compare os tamanhos" no campo petróleo; pacotes no campo mostarda, com
título em cima e os quatro canhotos numa fileira no desktop; a loja (desde quando, papel, endereço de retirada);
perguntas frequentes. Sem faixa "Como funciona" com números grandes: as etapas do pedido já ensinam o fluxo. O título da
página é o maior da home; títulos de seção ficam em `text-3xl`.

**Fluxo:** o tamanho se escolhe no passo seguinte ao botão (`/enviar`), nunca antes. Escolha do tamanho em cartões
só tipográficos, sem foto nem desenho de proporção (pedido do usuário, out/2026: a foto ali ficava brega): a medida
em destaque ("10 × 15", com o × em `ink-3`), "cm" pequeno, uma linha opcional ("Foto-placa", "Mínimo de 2 fotos"), picote
tracejado e o preço no pé. Grade `repeat(auto-fill, minmax(9.5rem, 1fr))`: duas colunas a 360 px, seis no desktop, uma
coluna quando a fonte do sistema está aumentada. Cartões da mesma linha com a mesma altura.

**Telas estreitas:** testar a 360 px e com a fonte da página 30% e 50% maior (o Android aumenta a fonte junto com a
configuração do sistema). Larguras mínimas em rem, `min-w-0` em itens de grade e em `fieldset`, linhas de valor com
`flex-wrap`. O nome FOTOVILLE do cabeçalho é logotipo: tamanho em px.

**Telas de tarefa** (envio, carrinho, pagamento): coluna principal com resumo fixo à direita no desktop (20 a 22rem,
`lg:sticky`) e, no celular, barra fixa embaixo, opaca, com o valor e a próxima ação. Nelas o botão flutuante do
WhatsApp some, e o link "Dúvidas? Falar no WhatsApp" fica no fim do resumo.

**Páginas de informação** (prazos, contato, quem somos): fatos em linhas ou em duas colunas de peso diferente (o canal
principal maior), nunca três colunas iguais de ícone, título e texto.

## Elevation & Depth

Profundidade só onde há objeto físico: a foto impressa (`shadow-print`, sombra curta deslocada, tingida com a tinta)
e o menu do celular (`shadow-lift`). Painéis de tarefa são planos, com borda `rule` e sem
sombra.

## Shapes

- Controles (botões, campos, menus, contador de cópias): 6px.
- Painéis e canhotos: 10px.
- Fotos impressas: 2px.
- Etiquetas: 3px, retas.
- Círculo apenas no botão flutuante do WhatsApp e nos marcadores de etapa do pedido.

## Components

- **Etapas do pedido** (`order-steps`): Tamanho, Fotos, Carrinho, Entrega e pagamento, no topo de cada tela do fluxo.
  Etapas já feitas são links; a atual é sublinhada. No celular vira uma linha: "Etapa 2 de 4: Fotos".
- **Área de envio** (`uploader`): vazia, mostra o papel do tamanho escolhido e "Selecionar fotos"; com fotos, encolhe
  numa faixa com "Adicionar fotos". Sem escolha de acabamento: é um só e não aparece no site. Cópias digitáveis de 1
  a 10.000 (`copies-input`), por foto e "Cópias de cada" para todas. Enquadramento rápido (`quick-frame`): arrastar a
  miniatura move o corte e grava; com mouse sempre, no toque só com o modo "Enquadrar" ligado, para não brigar com a
  rolagem. Clique sem arrastar abre o editor completo, que tem "Salvar e próxima". Ações em lote confirmam com um
  aviso visível de 3,5 s.
- **Tabela de preços** (`/precos`): pontilhado entre nome e preço, como a tabela do balcão; desconto progressivo
  em tabela de faixas com etiqueta verde de porcentagem.
- **Foto desenhada** (`print-shape`): papel branco com fio de 2px (a foto comum sai sem borda; o fio só faz o
  desenho ler como papel) e, dentro, uma foto de exemplo real (a lâmina
  do logo aparece só enquanto a imagem carrega); Polaroid e Mini Polaroid com a moldura do filme
  original (`INSTANT_FRAMES` em `src/lib/crop.ts`), a mesma do arquivo de impressão. Escala em px por cm, por
  propriedade ou pela variável `--cm`. Escala real só na régua da home (6 px/cm, 4 no celular), com a mesma foto em
  todos os tamanhos. Não aparece na escolha do tamanho. Origem e licença em `design/IMAGES.md`.
- **Régua de tamanhos** (`size-board`): fotos alinhadas pela base, celular tracejado de 7,2 x 15 cm como referência,
  rolagem horizontal no celular. Na home fica sobre o campo petróleo (`onColor`: texto claro, foco claro).
- **Canhoto de pacote** (`package-card`): número grande, preço, economia em texto e picote com meia-lua da cor do
  fundo (`--perforation-bg`). Os quatro iguais, sem selo de "recomendado": o preço por foto já ordena.
- **Botões:** `btn-accent` e `btn-primary` são a mesma ação; `btn-outline` para alternativa; `btn-ghost` para ação
  de texto. Todos com alvo de 44px e retorno de 1px ao apertar.
- **Faixa das lâminas:** 3px sob o cabeçalho.
- **Ícones:** Phosphor, traço regular, um só conjunto.

## Do's and Don'ts

- Faça: uma cor de ação em todos os controles; lâminas só em campos inteiros.
- Faça: o título da seção falar sozinho, sem rótulo acima dele.
- Faça: numerar só sequências reais (passos de pedido).
- Faça: remoções com "Desfazer" antes de apagar de verdade.
- Faça: fotos de exemplo sem rosto reconhecível, ou fotos de clientes com autorização por escrito.
- Não faça: fundo creme, destaque terracota, gradiente em texto, seta no fim do texto do botão.
- Não faça: cartões iguais de ícone, título e texto como estrutura de seção.
- Não faça: faixa colorida lateral em itens de lista, sombra dura deslocada, travessão ou ponto médio como separador.
- Não faça: afirmar o que a loja não afirmou (depoimentos, números de clientes, "preço de atacado").
- Não faça: janela (modal) para uma escolha que cabe na própria tela.
- Não faça: selo "Recomendado" ou "Mais pedido" sem um motivo que a loja possa sustentar.
- Não faça: lista de três vantagens com fios, nem números grandes 1-2-3 como enfeite de seção.
- Não faça: mensagem técnica para o cliente (código HTTP, erro do banco, "neste ambiente"). Erro diz o problema e o que fazer.
