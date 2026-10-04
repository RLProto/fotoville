# Fotoville: o site (front)

Deploy e estrutura do repositório: [`../README.md`](../README.md). Banco: [`../back/README.md`](../back/README.md).

Loja online para revelação de fotos: o cliente escolhe o tamanho, envia as fotos, ajusta corte, cor, borda e
legenda da Polaroid, paga pelo Mercado Pago e recebe pelos Correios (ou retira na loja).

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + login) ·
Cloudflare R2 (fotos, via API S3) · Mercado Pago Checkout Pro · API dos Correios (CWS).

## Rodar na sua máquina

```bash
npm install
cp .env.example .env.local   # preencha as chaves (veja abaixo)
npm run dev                  # http://localhost:3000
```

Sem nenhuma chave o site já abre: home, preços, promoções e páginas institucionais funcionam com o catálogo
de referência. Login, envio de fotos, frete real e pagamento dependem da configuração abaixo.

## Configuração, na ordem

### 1. Supabase (banco e login)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode `../back/supabase/schema.sql` inteiro e depois `../back/supabase/seed.sql`.
3. Em **Project Settings > API**, copie a URL e as chaves para `.env.local`.
4. Em **Authentication > URL Configuration**, coloque o endereço do site em *Site URL* e adicione
   `https://SEU-DOMINIO/**` em *Redirect URLs* (e `http://localhost:3000/**` para testes). O `/**` libera
   qualquer página do próprio site, inclusive o retorno `/auth/callback?next=...` dos links de e-mail.
5. Crie sua conta pelo site e torne-a administradora no SQL Editor:
   ```sql
   update public.profiles set is_admin = true
    where id = (select id from auth.users where email = 'voce@exemplo.com');
   ```

### 2. Bucket de fotos

**Opção em uso: Supabase Storage.** Com o plano Pro, já inclui 100 GB de armazenamento e 250 GB de download por mês.

1. Storage > *New bucket* `fotoville-fotos`, **privado**, sem políticas.
2. Storage > Settings > *S3 connection*: copie Endpoint e Region e gere uma *access key*.
3. Preencha `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY`. Não precisa de CORS.
4. Rode `npm run check:storage` para confirmar envio, leitura e bloqueio de acesso anônimo.

**Alternativa: Cloudflare R2**, se o volume de download crescer muito.

O R2 cobra US$ 0,015 por GB/mês, 10 GB grátis e **download gratuito** (em outros serviços, baixar
as fotos para imprimir é o que encarece). Qualquer serviço com API S3 funciona trocando só as variáveis `S3_*`.

1. Cloudflare > **R2** > *Create bucket* (nome `fotoville-fotos`, acesso privado).
2. *Manage R2 API Tokens* > token com permissão **Object Read & Write** nesse bucket. Copie Access Key, Secret e
   o endpoint para `.env.local`.
3. No bucket, em **Settings > CORS Policy**, cole (trocando o domínio):
   ```json
   [
     {
       "AllowedOrigins": ["https://SEU-DOMINIO", "http://localhost:3000"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   O `PUT` é o envio direto do navegador do cliente; o `GET` desenha as prévias (cliente) e gera o arquivo de
   impressão (painel da loja), ambos no navegador.

### 3. Mercado Pago

1. [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers) > *Suas integrações* > criar aplicação
   (produto: **Checkout Pro**).
2. Copie o **Access Token de teste** para `MP_ACCESS_TOKEN`. Ele começa com `APP_USR-`, como o de produção.
   Em *Testes > Contas de teste*, crie uma conta **compradora** (Brasil) para pagar nos testes.
3. Em **Webhooks**, cadastre `https://SEU-DOMINIO/api/webhooks/mercadopago`, evento **Pagamentos**, e copie a
   assinatura secreta para `MP_WEBHOOK_SECRET`.

O webhook só funciona com endereço público `https`. Em `localhost` o pedido é confirmado quando o cliente volta do
Mercado Pago para a página do pedido.

### 4. Correios

A API oficial (Preço e Prazo) exige **contrato com os Correios**. Em [cws.correios.com.br](https://cws.correios.com.br)
gere o código de acesso e preencha `CORREIOS_USER`, `CORREIOS_ACCESS_CODE` e `CORREIOS_POSTAGE_CARD`. Confira os
códigos de serviço do seu contrato (`CORREIOS_SERVICE_PAC`, `CORREIOS_SERVICE_SEDEX`).

Sem essas variáveis, ou se a API falhar, o site usa a tabela de `src/lib/shipping/estimate-table.ts` e mostra o
valor como "aprox.". Ajuste a tabela aos valores que a loja paga.

## Testes rápidos

| Comando | O que confere |
|---|---|
| `npm run check:storage` | Envio, leitura, CORS e bloqueio anônimo no bucket |
| `npm run check:fluxo` | Fluxo completo com o site rodando: cria um cliente temporário, envia fotos, cota frete, aplica cupom, fecha pedido e apaga tudo no fim |
| `npm run check:frete` | Peso, volume e frete estimado de pedidos de exemplo |

## Como o frete é calculado

`src/lib/shipping/parcel.ts` estima o pacote a partir do pedido:

- **Peso:** área de cada foto × 250 g/m² (papel fotográfico) × quantidade, mais 8% de proteção e a embalagem
  (envelope rígido de 60 g ou caixa de 150 g). A foto-placa tem peso próprio (380 g, estimado).
- **Volume:** a maior foto define comprimento e largura (+2 cm); a altura é a pilha (0,25 mm por foto).
  Respeita o mínimo dos Correios (16×11×2 cm).

`npm run check:frete` imprime o pacote e o frete estimado para pedidos de exemplo. Depois de pesar alguns pedidos
reais, ajuste as constantes no topo do arquivo.

## Operação da loja

- **Painel:** `/admin` (só para contas com `is_admin`). Lista os pedidos pagos, mostra cliente, endereço e pacote
  estimado, e permite mudar a situação e informar o código de rastreio.
- **Fotos para imprimir:** na página do pedido, *Baixar todas recortadas* gera os arquivos já no enquadramento que
  o cliente escolheu, com nome `pedido_tamanho_acabamento_cópias_índice.jpg`. Também dá para baixar os originais.
- **Preços e produtos:** edite a tabela `products` no Supabase (preço em centavos). Para desativar um tamanho,
  marque `active = false`.
- **Pacotes "compre agora, revele depois":** tabela `packages`. Ao ser pago, o pacote gera um cupom com créditos
  de fotos (tabela `coupons`), que o cliente usa no fechamento de um ou mais pedidos.
- **Cupom de desconto percentual:**
  ```sql
  insert into public.coupons (code, kind, percent_off, expires_at)
  values ('BEMVINDO10', 'percent', 10, '2027-01-31');
  ```

## Publicar

No Vercel, com `front` como raiz. Passo a passo em [`../README.md`](../README.md).

## Design

O visual foi refeito com as skills de design instaladas em `.claude/skills` na máquina de desenvolvimento (fora do git) (frontend-design da Anthropic,
impeccable, taste-skill, redesign-skill, web-design-guidelines da Vercel e ui-ux-pro-max).

- `DESIGN.md`: o sistema de design como foi construído (cores, tipografia, formas, componentes, regras).
- `design/DIRECTION.md`: o contrato de direção (o envelope de revelação).
- `design/PRODUCT.md`: a verdade do produto, o que pode e o que não pode ser afirmado no site.
- `.impeccable/design.json`: sombras, foco e movimento.
- `.claude/product-marketing.md` (fora do git): a voz da marca. Textos curtos e precisos, sem explicar o funcionamento interno.
  Revisado com as skills copywriting, copy-editing e cro (marketingskills).

Para telas novas, leia `DESIGN.md` primeiro e use só os tokens dele.

## Estrutura

```
../back/supabase/            tabelas, RLS, funções, catálogo inicial e migrações
vercel.json                  região das funções (São Paulo)
src/lib/catalog-data.ts      tamanhos e preços de referência
src/lib/shipping/            peso/volume, API dos Correios, tabela de estimativa
src/lib/mercadopago.ts       preferência de pagamento e assinatura do webhook
src/lib/storage.ts           URLs assinadas do bucket
src/app/api/                 upload, fotos, frete, cupom, checkout, webhook, admin
src/app/enviar/[slug]        envio e ajuste das fotos
src/lib/photo-render.ts      corte, cor, borda, legenda e ajuste automático (prévia e arquivo final)
src/app/checkout             entrega, cupom e pagamento
src/app/admin                painel da loja
```

## Erros do site

Erros do navegador do cliente e do servidor ficam na tabela `error_logs` e aparecem no painel em
`/admin/erros`, agrupados por mensagem, com página, cliente, aparelho e detalhes. Do navegador, registre com
`reportError(área, erro, detalhes)` (`src/lib/report-error.ts`); no servidor, com `serverFail`/`reportServerError`
(`src/lib/api.ts`) nas rotas de API ou `logError` (`src/lib/error-log.ts`) no resto. Erros não tratados são capturados
sozinhos (`src/instrumentation.ts` e `src/instrumentation-client.ts`).

## Pontos para confirmar com a loja

- Prazo de produção (hoje **3 dias úteis**, em `src/lib/site.ts`).
- Preço da Mini Polaroid (R$ 3,50 provisório). As medidas da Polaroid (8,8 × 10,7 cm) e da Mini Polaroid (5,4 × 8,6 cm)
  seguem os filmes originais (`INSTANT_FRAMES` em `src/lib/crop.ts`); confirmar se a loja imprime nesses tamanhos.
  Peso e espessura da foto-placa.
- Se os pacotes valem para brilho e fosco (hoje valem para os dois; o site antigo citava só fosco).
- Textos de Termos de uso e Política de privacidade (rascunhos; pedem revisão jurídica).
- Valores da tabela de frete estimado, caso a loja não tenha contrato com os Correios.
