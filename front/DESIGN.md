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

O site é o envelope de revelação do laboratório: o cliente marca tamanho, acabamento e cópias como nos quadradinhos
do envelope, sobre papel fotográfico branco e frio, com tinta índigo. As seis lâminas do diafragma do logo aparecem
como campos inteiros de cor (faixa dos passos, seção de pacotes) e como preenchimento das fotos desenhadas em escala.
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
(96px nas seções principais da home). Topo da home em duas colunas no desktop: foto até a borda esquerda da tela,
título, botão "Enviar fotos" e link "Ver preços" à direita. O tamanho se escolhe no passo seguinte (`/enviar`), nunca
antes do botão. Seções com título à esquerda e conteúdo à direita (1fr / 2.2fr) nos campos
de cor; a seção de pacotes da home é a exceção: título em cima e os quatro pacotes numa fileira no desktop. Escolha do tamanho (`/enviar`) em grade de 2, 3 ou 5 cartões iguais: foto na proporção do papel, todas com a
mesma altura, nome e preço embaixo. Nada que mude a altura de um cartão só (linha extra de desconto, observação). Telas de tarefa (envio,
carrinho, pagamento, conta) em coluna principal com resumo fixo de 22rem à direita.

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
- **Tabela de preços** (`/precos`): pontilhado entre nome e preço, como a tabela do balcão; desconto por quantidade
  em tabela de faixas com etiqueta verde de porcentagem.
- **Foto em escala** (`print-shape`): papel branco com borda de 5% e, dentro, uma foto de exemplo real (a lâmina
  do logo aparece só enquanto a imagem carrega); Polaroid com borda inferior de 20%. Escala em px por cm, por
  propriedade ou pela variável `--cm`. Escala real só na régua da home (6 px/cm, 4 no celular), com a mesma foto em
  todos os tamanhos. Na escolha do tamanho a foto não fica em escala: todas com 112 px de altura, porque a escala
  real ali dava fotos minúsculas ao lado de grandes e deixava a grade torta (pedido do usuário, out/2026). Origem e licença em `design/IMAGES.md`.
- **Régua de tamanhos** (`size-board`): fotos alinhadas pela base, celular tracejado de 7,2 x 15 cm como referência,
  rolagem horizontal no celular.
- **Canhoto de pacote** (`package-card`): número grande, preço, economia em texto e picote com meia-lua da cor do
  fundo (`--perforation-bg`).
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
