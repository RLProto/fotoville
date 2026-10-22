# Fotoville

Site de revelação de fotos da Fotoville (Joinville/SC): o cliente escolhe o tamanho, envia as fotos, ajusta e
paga pelo site.

| Pasta | O que tem | Onde roda |
|---|---|---|
| `front/` | O site inteiro em Next.js: páginas e rotas de API | Vercel |
| `back/` | Estrutura do banco: schema, seed e migrações | Supabase (SQL Editor) |
| `docs/` | Levantamento do site antigo | — |

Para rodar na máquina e configurar cada serviço, veja [`front/README.md`](front/README.md).

## Deploy no Vercel

1. Em **Add New > Project**, importe este repositório.
2. **Root Directory:** `front`. O Vercel detecta o Next.js; build e instalação ficam no padrão.
3. **Environment Variables:** cadastre as variáveis do `front/.env.example` com os valores do `.env.local`, e
   `NEXT_PUBLIC_SITE_URL` com o domínio final em `https` (sem barra no fim).
4. **Deploy.** As funções rodam em São Paulo (`gru1`, definido em `front/vercel.json`), perto do banco.
5. **Settings > Domains:** aponte o domínio da loja.

Site de loja é uso comercial: o Vercel exige o plano **Pro**.

## Depois do primeiro deploy

1. **Supabase > Authentication > URL Configuration:** *Site URL* com o domínio e, em *Redirect URLs*,
   `https://SEU-DOMINIO/**`. Sem isso, os links de confirmação e de nova senha voltam para o endereço errado.
   **Emails > Templates:** para os links funcionarem em qualquer aparelho (cadastro no computador, e-mail aberto
   no celular), troque o `href` do botão:
   - *Confirm signup*: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
   - *Reset password*: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`

   O padrão `{{ .ConfirmationURL }}` também funciona, mas só no mesmo navegador em que o cliente pediu o link.
2. **Banco:** rode `back/supabase/migrations/2026-10-03_price_tiers.sql` no SQL Editor (pendente no banco atual).
3. **Mercado Pago > Webhooks:** `https://SEU-DOMINIO/api/webhooks/mercadopago`, evento *Pagamentos*. Copie a
   assinatura para `MP_WEBHOOK_SECRET` no Vercel e faça um novo deploy.
4. **Teste de ponta a ponta** contra o site no ar (cria um cliente temporário e apaga tudo no fim):
   ```bash
   cd front
   SITE=https://SEU-DOMINIO npm run check:fluxo
   ```

Os endereços do site antigo (`/catalog/15`, `/user/login` etc.) já redirecionam para as páginas novas.

## Carrinho esquecido (aviso pelo WhatsApp)

As fotos ficam no carrinho por 30 dias desde a mais recente (`front/src/lib/cart-retention.ts`). Três dias antes,
o job diário (`/api/cron/carrinho`, 10h de Brasília) avisa pelo WhatsApp; depois do prazo, apaga do bucket.
Fica desligado até `CARRINHO_LIMPEZA=1`.

1. **Vercel:** `CRON_SECRET` (qualquer texto longo). Sem ele o job não roda. Só com ele, o job já apaga todo dia
   os arquivos do bucket que nenhuma foto usa (envio interrompido), com mais de 2 dias; o carrinho continua
   intocado até `CARRINHO_LIMPEZA=1`.
2. **Meta:** conta Business verificada com o CNPJ, app com o produto WhatsApp e um número só para a API. Copie
   `WHATSAPP_TOKEN` (usuário do sistema, permanente), `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_APP_SECRET`.
3. **WhatsApp Manager > Modelos:** crie `carrinho_expira`, categoria **Utilidade**, idioma Português (BR):
   - Corpo: `Fotoville: as fotos do seu carrinho ficam salvas até {{1}}. Depois dessa data, são apagadas.`
     (exemplo de {{1}}: `20 de novembro`)
   - Botões: URL `Ver carrinho` → `https://SEU-DOMINIO/carrinho`; resposta rápida `Parar avisos`.
4. **Webhook:** `https://SEU-DOMINIO/api/webhooks/whatsapp`, token de verificação = `WHATSAPP_VERIFY_TOKEN`,
   campo *messages*. "Parar avisos" desliga os avisos do cliente; falhas de entrega vão para `/admin/erros`.
5. **Ligar:** `CARRINHO_LIMPEZA=1` no Vercel e novo deploy. O carrinho e a política de privacidade passam a
   mostrar o prazo.

Sem número ou sem as chaves da Meta, o aviso fica registrado em `cart_notices` sem envio e o prazo vale do mesmo jeito.

## Pedidos novos no grupo do WhatsApp

Cada pedido criado (pago ou não) vira uma mensagem num grupo, enviada pelo chip da loja, até um minuto depois.
Roda no Supabase (`2026-10-22_whatsapp_pedidos.sql`, job `whatsapp-pedidos`); o envio é pela Green-API, que
conecta o WhatsApp Business do chip como aparelho vinculado.

1. **green-api.com:** crie a conta e uma instância do plano Developer (grátis, até 3 conversas; o grupo conta
   como uma). Leia o QR code com o WhatsApp Business do chip (Aparelhos conectados).
2. **`front/.env.local`:** `GREENAPI_URL`, `GREENAPI_INSTANCE` e `GREENAPI_TOKEN` (apiUrl, idInstance e
   apiTokenInstance do painel da instância) e `PEDIDOS_WHATSAPP` (quem entra no grupo).
3. `npm run whatsapp -- grupo` cria o grupo "Pedidos Fotoville" e grava tudo no banco.
   `npm run whatsapp -- teste-pedido` manda o último pedido para conferir.

Mensagens e falhas ficam em `monitor.messages`; falha de entrega também aparece em `/admin/erros` (área `whatsapp`).
