# Levantamento do site atual — fotoville.com.br

Coletado em 02/10/2026 a partir do HTML baixado e de navegação no site ao vivo.

## Empresa

- **Nome:** Fotoville — "Revelação Fotográfica"
- **Proposta:** site de revelação de foto digital virtual. Cliente envia as fotos pelo site, edita/corta online e recebe em casa.
- **Slogan usado na página de login:** "Fácil de usar, fácil de comprar. Edição de fotos online, sem plugin, sem programas complicados."
- **Rodapé:** "Fotoville 2026. Todos os direitos reservados. Revendedor Oficial Indústria da Foto"
- **Papéis:** "Usamos apenas papéis Kodak e Fujifilm" (imagem home-papeis.png)
- **Atividade desde:** 2012 (política de privacidade: "Fotoville 2012-2026")

### Endereços encontrados
| Onde | Endereço |
|---|---|
| Home do site (atual) | Rua Vice Prefeito Luiz Carlos Garcia, 1125 - Sala 3, Costa e Silva, Joinville/SC |
| Termos de uso (antigo) | Rua Paraíba, 172, Anita Garibaldi, Joinville/SC, CEP 89203-530 |
| Listagens na web (loja física) | Garten Shopping, Av. Rolf Wiest, 333, Sala S16, Bom Retiro, Joinville/SC |

### Contatos
- WhatsApp: **(47) 3029-3792** — link `https://api.whatsapp.com/send?phone=554730293792&text=Mensagem%20pelo%20site%20Fotoville`
- E-mail (política de privacidade): fotoville.com.br@gmail.com

## Estrutura de páginas

| Rota | Conteúdo | Status |
|---|---|---|
| `/` | Home: logo, 3 botões, formulário de cupom, endereço. Sem rodapé. | ok |
| `/catalog` | Duas categorias: Revelação Fotográfica e Promoções | ok |
| `/catalog/15` | Revelação Fotográfica — 26 produtos (tabela abaixo) | ok |
| `/catalog/36` | Promoções — 4 pacotes de fotos 10x15 | ok |
| `/catalog/product/{id}` | Página do produto. Revelação exige login; promoções são públicas | ok |
| `/user/login` | Login (email, senha, lembrar, esqueci senha) | ok |
| `/user/register` | Cadastro: Email, WhatsApp, Senha, aceite de termos | ok |
| `/site/termosdeuso` | Termos de uso (contrato) | ok |
| `/site/politicadeprivacidade` | Política de privacidade | ok |
| `/info/page/prazos-e-frete` | Linkado no menu e rodapé | **404** |
| `/info/page/quem-somos` | Linkado no rodapé | **404** |
| `/info/page/termos-de-uso` | Linkado no rodapé (duplicado de /site/termosdeuso) | **404** |
| `/info/page/politica-de-privacidade` | Linkado no rodapé | **404** |
| `/account` | Linkado no menu | **404** (deslogado) |
| `/coupon/promo?slug=` | Validação de cupom | — |
| `/sitemap.xml` | — | 404 |

Rodapé das páginas internas: Quem Somos, Termos de Uso, Política de Privacidade, Prazos e Frete, Fale Conosco, selo "COMPRA SEGURA", faixa de bandeiras de pagamento.

## Tabela de preços — Revelação Fotográfica (catalog/15)

| Produto | Preço un. | ID |
|---|---|---|
| 10x13cm | R$ 1,99 | |
| 10x15 | R$ 1,99 | |
| 13x15cm | R$ 2,09 | |
| 13x18cm Fosco | R$ 5,00 | |
| 15x15cm | R$ 3,29 | |
| 15x21cm | R$ 3,99 | |
| 15x30 | R$ 6,59 | |
| 20x20cm | R$ 4,99 | |
| 20x25cm | R$ 5,99 | |
| 20x30cm | R$ 8,49 | |
| 20x45 | R$ 12,99 | |
| 25x25cm | R$ 7,49 | |
| 25x40cm | R$ 14,99 | |
| 25x45 | R$ 15,49 | |
| 25x50cm | R$ 15,99 | |
| 25x60cm | R$ 18,69 | |
| 28x35 | R$ 20,00 | |
| 30x25cm | R$ 8,69 | |
| 30x30cm | R$ 15,89 | |
| 30x35 | R$ 15,99 | |
| 30x40cm | R$ 18,99 | |
| 30x45cm | R$ 20,99 | |
| 30x50cm | R$ 23,99 | |
| 30x60cm | R$ 26,59 | |
| Foto-placa 20x30 | R$ 20,00 | |
| Polaroid | R$ 4,50 | |

IDs de produto na ordem da página: 114, 115, 116, 117, 118, 119, 134, 135, 136, 137, 259, 264, 266, 267, 275, 276, 277, 278, 291, 293, 312, 313, 314, 315, 316, 318. Botão: "ENVIAR FOTOS".

## Promoções (catalog/36) — "Compre agora, revele depois"

| Pacote | Preço | Por foto | ID |
|---|---|---|---|
| 100 fotos 10x15 | R$ 119,00 | R$ 1,19 (site mostra "R$ 119,00 cada foto" — bug) | 304 |
| 300 fotos 10x15 | R$ 327,00 | R$ 1,09 | 306 |
| 500 fotos 10x15 | R$ 495,00 | R$ 0,99 | 308 |
| 1000 fotos 10x15 | R$ 890,00 | R$ 0,89 | 310 |

Descrição padrão: papel fotográfico fosco; após aprovação da compra, contato pelo WhatsApp; cupom válido para um pedido. Funciona como crédito pré-pago: cliente compra o pacote, recebe um cupom e usa depois.

## Fluxo de compra (inferido do CSS e das páginas)

1. Escolhe o tamanho no catálogo → "Enviar fotos" (exige login).
2. Upload com arrastar e soltar (`panel-upload`, `dragover`), lista de miniaturas (`photos-list`, `photo-item`), tratamento de imagem quebrada.
3. Edição/corte online em modal (`edit-photo`, `crop-box`, `img-container`).
4. Carrinho (`cart-list`, `prices`, `prices-total`), cupom (`cupon-item`).
5. Checkout em passos numerados (`checkbox-steps`, `step-active/prev/next`), frete por CEP (`cep-loading`).
6. Pedido com imagem (`order-img`). Entrega via Correios.

Termos de uso citam: formatos JPEG/JPG/JPE; prazo de entrega de até 30 dias úteis após pagamento; taxa de R$ 9,90 por devolução dos Correios; fotos sofrem resize no upload; suporte por e-mail; pagamento via Bcash (Buscapé) e PagSeguro (ambos desatualizados).

## Pagamento (imagem payments.png)
Visa, Mastercard, American Express, Elo, Aura, Diners, Hipercard (12x/24x), Banco do Brasil, Bradesco, Itaú, HSBC, Banrisul, Boleto, Bcash. **Muito desatualizado** (HSBC não existe mais no Brasil, Bcash encerrou). Sem Pix.

## Tecnologia

- **Backend:** Yii 2 (PHP). Front: Bootstrap 3, jQuery, Glyphicons, Font Awesome (kit cd7a344b3e), fonte Lato (Google Fonts). Assets versionados em 2019.
- **Plataforma white-label:** o domínio `industriadafoto.com.br` serve o mesmo site, e as miniaturas de categoria vêm de `ws.industriadafoto.com.br`. "Indústria da Foto" é o fornecedor/laboratório; Fotoville é "revendedor oficial".
- **Rastreamento:** GTM `GTM-M8PG2DX`, GA4 `G-0B8G8XH2C0`, Universal Analytics `UA-172869830-1` (morto), Google Ads `AW-625113279`, Hotjar.
- **Open Graph:** título "Fotoville | Revelação de foto digital virtual", imagem `/img/img-icon.jpeg` (1800x1200), modificado em 26/07/2020.
- **robots.txt:** libera tudo. Sem sitemap.

## Identidade visual

- **Logo:** diafragma com 6 lâminas coloridas (verde-oliva #7a9a3c, mostarda #b8963f, terracota #b85c3a, roxo #5c3a5c, azul #4a5a9a, petróleo #3a6a5c), texto "FOTOVILLE" em caixa alta com espaçamento largo. PNG 3543x3543.
- **Hero atual:** foto de mão segurando três fotos reveladas sobre fundo claro (bg-home.jpg, 1024x671).
- **Cores do CSS atual:** azul escuro #003366 (títulos/caixas), azul #004481 (rodapé), rosa #FF177B→#80006B (botão primário), laranja #FF7F00→#FF4000 (botão comprar), verde #01E675→#00B35B (WhatsApp), azul #414DE2→#0143FF (botão menu). Paleta não combina com o logo.
- **Tipografia:** Lato 400/700/900.

## Problemas do site atual (oportunidades)

- 5 links do menu/rodapé quebrados (prazos, quem somos, conta, termos/privacidade duplicados).
- Home sem texto de venda, sem preços, sem exemplos, sem prova social, sem rodapé.
- Preço "R$ 119,00 cada foto" errado no pacote de 100.
- Bandeiras de pagamento e termos citam serviços extintos (Bcash, HSBC); sem Pix.
- Prazo de 30 dias úteis nos termos assusta; vale alinhar com a realidade.
- Bootstrap 3 e código para IE antigo; sem sitemap; sem página de contato.
- Dois endereços diferentes no próprio site e um terceiro nas listagens externas.
- Cadastro pede WhatsApp mas não pede nome.
