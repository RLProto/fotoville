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
2. **Banco:** rode `back/supabase/migrations/2026-10-03_price_tiers.sql` no SQL Editor (pendente no banco atual).
3. **Mercado Pago > Webhooks:** `https://SEU-DOMINIO/api/webhooks/mercadopago`, evento *Pagamentos*. Copie a
   assinatura para `MP_WEBHOOK_SECRET` no Vercel e faça um novo deploy.
4. **Teste de ponta a ponta** contra o site no ar (cria um cliente temporário e apaga tudo no fim):
   ```bash
   cd front
   SITE=https://SEU-DOMINIO npm run check:fluxo
   ```

Os endereços do site antigo (`/catalog/15`, `/user/login` etc.) já redirecionam para as páginas novas.
