/**
 * Teste de ponta a ponta contra o site rodando (npm run dev):
 * cria um cliente temporário, envia fotos, ajusta, cota frete, aplica cupom,
 * fecha o pedido e confere tudo no banco. No fim apaga o cliente, o pedido e os arquivos.
 * Uso: npm run check:fluxo   (SITE=http://localhost:3000 por padrão)
 */
import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const SITE = (process.env.SITE ?? "http://localhost:3000").replace(/\/$/, "");
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
});

let failures = 0;
function check(label: string, ok: unknown, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "OK    " : "FALHOU"} ${label}${detail ? `  (${detail})` : ""}`);
}

const stamp = Date.now();
const email = `teste-fluxo-${stamp}@exemplo.com`;
const password = `Teste-${stamp}-fotoville`;
const couponCode = `TESTE-${stamp}`;
let userId: string | null = null;
let profileId: string | null = null;
const keys: string[] = [];

const jar = new Map<string, string>();
const cookieHeader = () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ");

async function api<T = Record<string, unknown>>(method: string, path: string, body?: unknown) {
  const res = await fetch(SITE + path, {
    method,
    headers: { Cookie: cookieHeader(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(90_000),
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {}
  return { status: res.status, data: data as T, text };
}

async function uploadPhoto(name: string, width: number, height: number, productId = "10x15") {
  const presign = await api<{ uploads: { key: string; thumbKey: string; uploadUrl: string; thumbUploadUrl: string }[] }>(
    "POST",
    "/api/upload/presign",
    { files: [{ name, type: "image/jpeg", size: 4096 }] },
  );
  const target = presign.data.uploads?.[0];
  if (!target) throw new Error(`presign falhou: ${presign.status} ${presign.text.slice(0, 200)}`);
  keys.push(target.key, target.thumbKey);
  const bytes = new Uint8Array(4096).fill(7);
  const [a, b] = await Promise.all([
    fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes }),
    fetch(target.thumbUploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes.slice(0, 512) }),
  ]);
  if (!a.ok || !b.ok) throw new Error(`envio ao bucket falhou: ${a.status}/${b.status}`);
  const created = await api<{ photo: { id: string; crop: { width: number; height: number }; thumb_url: string } }>(
    "POST",
    "/api/photos",
    { product_id: productId, storage_key: target.key, thumb_key: target.thumbKey, file_name: name, width_px: width, height_px: height },
  );
  if (!created.data.photo) throw new Error(`registro da foto falhou: ${created.status} ${created.text.slice(0, 200)}`);
  return created.data.photo;
}

try {
  // 1. Cliente temporário, já confirmado
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Cliente Teste", whatsapp: "47999990000" },
  });
  if (error) throw error;
  userId = created.user.id;
  check("cliente temporário criado", userId);

  const auth = createServerClient(URL_, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const login = await auth.auth.signInWithPassword({ email, password });
  check("login", !login.error && jar.size > 0, login.error?.message);

  // Registro de erros: o navegador manda, o servidor grava com o cliente logado
  const report = await api("POST", "/api/erros", { scope: "teste-fluxo", message: `teste ${stamp}`, detail: { ok: true } });
  check("erro do navegador aceito", report.status === 204, `HTTP ${report.status}`);
  await new Promise((r) => setTimeout(r, 2000)); // a gravação acontece depois da resposta
  const { data: logged } = await admin
    .from("error_logs")
    .select("source, user_id, user_agent")
    .eq("scope", "teste-fluxo")
    .eq("message", `teste ${stamp}`)
    .maybeSingle();
  check("erro gravado com o cliente", logged?.source === "client" && logged.user_id === userId, JSON.stringify(logged));
  const badReport = await api("POST", "/api/erros", { scope: "", message: "x".repeat(5000) });
  check("relato de erro inválido recusado", badReport.status === 400, `HTTP ${badReport.status}`);

  // 2. Páginas protegidas abrem logado
  const page = await api("GET", "/enviar/10x15");
  check("página de envio abre logado", page.status === 200, `HTTP ${page.status}`);

  // 3. Envio de duas fotos (paisagem 4000x3000 e retrato 1200x1600)
  const p1 = await uploadPhoto("praia.jpg", 4000, 3000);
  const p2 = await uploadPhoto("retrato.jpg", 1200, 1600);
  check("fotos enviadas e registradas", p1.id && p2.id);
  check("corte padrão na proporção 10x15", Math.abs(p1.crop.width / p1.crop.height - 1.5) < 0.01, `${p1.crop.width}x${p1.crop.height}`);
  check("miniatura com URL assinada", typeof p1.thumb_url === "string" && p1.thumb_url.includes("X-Amz-Signature"));

  // 4. Ajustes: 3 cópias; remover a segunda foto. Cópias acima do limite são recusadas.
  const patch = await api("PATCH", `/api/photos/${p1.id}`, { quantity: 3 });
  check("alterar cópias", patch.status === 200, `HTTP ${patch.status}`);
  const tooMany = await api("PATCH", `/api/photos/${p1.id}`, { quantity: 10001 });
  check("mais de 10.000 cópias é recusado", tooMany.status === 400, `HTTP ${tooMany.status}`);
  // Cor, borda e legenda: a legenda é descartada fora da Polaroid
  const adjust = {
    auto: { gains: [1, 0.98, 0.95], black: 0.03, white: 0.97, gamma: 0.9, shadows: 0.1, vibrance: 0.15 },
    brightness: 10,
    contrast: -5,
    saturation: 0,
    bw: true,
    border: { color: "marfim", mm: 6 },
    caption: { text: "não vale no 10x15", font: "caneta" },
  };
  const adjusted = await api<{ photo: { adjust: typeof adjust | null } }>("PATCH", `/api/photos/${p1.id}`, { adjust });
  const saved = adjusted.data.photo?.adjust;
  check(
    "ajustes de cor e borda gravados",
    adjusted.status === 200 && saved?.bw === true && saved?.border?.mm === 6 && saved?.auto?.gamma === 0.9,
    adjusted.status === 200 ? "" : `HTTP ${adjusted.status} ${adjusted.text.slice(0, 160)}`,
  );
  check("legenda descartada fora da Polaroid", adjusted.status === 200 && saved?.caption === null);
  const invalid = await api("PATCH", `/api/photos/${p1.id}`, { adjust: { ...adjust, border: { color: "neon", mm: 40 } } });
  check("ajuste inválido recusado", invalid.status === 400, `HTTP ${invalid.status}`);
  const original = await api<{ url: string }>("GET", `/api/photos/${p1.id}`);
  const fetched = original.data.url ? await fetch(original.data.url) : null;
  check("original abre no editor de corte", fetched?.ok, `HTTP ${fetched?.status}`);
  const removed = await api("DELETE", `/api/photos/${p2.id}`);
  check("remover foto do carrinho", removed.status === 200, `HTTP ${removed.status}`);

  // 5. Frete para São Paulo
  const frete = await api<{ options: { service: string; price_cents: number; estimated: boolean }[]; parcel: { weight_g: number } }>(
    "POST",
    "/api/frete",
    { cep: "01310-100" },
  );
  const pac = frete.data.options?.find((o) => o.service === "pac");
  check("cotação de frete", pac && pac.price_cents > 0, pac ? `PAC R$ ${(pac.price_cents / 100).toFixed(2)}, ${pac.estimated ? "estimado" : "Correios"}, pacote ${frete.data.parcel.weight_g} g` : frete.text.slice(0, 200));

  // 6. Cupom de créditos (2 fotos 10x15)
  await admin.from("coupons").insert({ code: couponCode, kind: "credits", user_id: userId, product_id: "10x15", credits_total: 2 });
  const cupom = await api<{ discount_cents: number; credits: number }>("POST", "/api/cupom", { code: couponCode.toLowerCase() });
  check("cupom validado", cupom.data.discount_cents === 398 && cupom.data.credits === 2, `desconto ${cupom.data.discount_cents}`);

  // 7. Fechar pedido (sem Mercado Pago configurado ele fica aguardando pagamento)
  const checkout = await api<{ orderId: string; redirect: string }>("POST", "/api/checkout", {
    customer: { name: "Cliente Teste", cpf: "123.456.789-09", whatsapp: "(47) 99999-0000" },
    service: "pac",
    address: { cep: "01310-100", street: "Avenida Paulista", number: "1000", district: "Bela Vista", city: "São Paulo", state: "SP" },
    coupon: couponCode,
  });
  const orderId = checkout.data.orderId;
  check("pedido criado", orderId, checkout.data.redirect ?? checkout.text.slice(0, 200));

  if (orderId) {
    const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
    const expected = 597 - 398 + (pac?.price_cents ?? 0);
    check("valores do pedido", order.total_cents === expected, `subtotal ${order.subtotal_cents}, desconto ${order.discount_cents}, frete ${order.shipping_cents}, total ${order.total_cents}`);
    const { count: linked } = await admin.from("photos").select("id", { count: "exact", head: true }).eq("order_id", orderId);
    check("foto vinculada ao pedido", linked === 1);
    const { data: items } = await admin.from("order_items").select("description, quantity").eq("order_id", orderId);
    check("itens do pedido", items?.length === 1 && items[0].quantity === 3, items?.map((i) => `${i.quantity}x ${i.description}`).join(", "));
    const { data: coupon } = await admin.from("coupons").select("credits_used").eq("code", couponCode).single();
    check("créditos do cupom consumidos", coupon?.credits_used === 2);
    const { count: cart } = await admin.from("photos").select("id", { count: "exact", head: true }).eq("user_id", userId).is("order_id", null);
    check("carrinho esvaziado", cart === 0);

    const orderPage = await api("GET", `/pedido/${orderId}`);
    // o React separa texto e número com um comentário no HTML: "Pedido #<!-- -->1001"
    const title = new RegExp(`Pedido #(<!-- -->)?${order.number}`);
    check("página do pedido", orderPage.status === 200 && title.test(orderPage.text), `HTTP ${orderPage.status}`);

    // Nova foto no carrinho para o cupom ser avaliado de verdade
    const other = await uploadPhoto("outra.jpg", 3000, 2000);
    const again = await api<{ error: string }>("POST", "/api/cupom", { code: couponCode });
    check("cupom sem saldo é recusado", again.status === 422, `HTTP ${again.status}: ${again.data.error}`);

    // Desconto progressivo: 120 cópias 10x15 caem na faixa de 100 ou mais (120 x R$ 1,19)
    await api("PATCH", `/api/photos/${other.id}`, { quantity: 120 });
    const cartPage = await api("GET", "/carrinho");
    check("desconto progressivo no carrinho", cartPage.status === 200 && cartPage.text.includes("142,80"), `HTTP ${cartPage.status}`);

    // Mini Polaroid: mínimo de 2 fotos. Com 1, o pagamento recusa; com 2 cópias, passa da validação.
    const mini = await uploadPhoto("mini.jpg", 1200, 1600, "mini-polaroid");
    const pickup = {
      customer: { name: "Cliente Teste", cpf: "123.456.789-09", whatsapp: "(47) 99999-0000" },
      service: "retirada",
    };
    const blocked = await api<{ error: string }>("POST", "/api/checkout", pickup);
    check("mini polaroid abaixo do mínimo é recusada", blocked.status === 422 && /mínimo de 2/.test(blocked.data.error ?? ""), `HTTP ${blocked.status}: ${blocked.data.error}`);
    await api("PATCH", `/api/photos/${mini.id}`, { quantity: 2 });
    const allowed = await api<{ orderId?: string; error?: string }>("POST", "/api/checkout", pickup);
    check("mini polaroid com 2 fotos fecha o pedido", allowed.status === 200 && Boolean(allowed.data.orderId), `HTTP ${allowed.status}: ${allowed.data.error ?? ""}`);
  }

  // 8. Cliente comum não entra no painel
  const panel = await api("GET", "/admin");
  check("painel bloqueado para cliente", panel.status === 404, `HTTP ${panel.status}`);

  // 9. Perfil de cliente preferencial, pelo mesmo caminho do painel
  await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
  const { data: store10 } = await admin.from("products").select("price_cents, price_tiers").eq("id", "10x15").single();
  const sameStore = await api("PUT", "/api/admin/precos", {
    items: [{ product_id: "10x15", price_cents: store10!.price_cents, price_tiers: store10!.price_tiers }],
  });
  check("salvar preços da loja pelo painel", sameStore.status === 200, `HTTP ${sameStore.status} ${sameStore.text.slice(0, 120)}`);

  const newProfile = await api<{ id: string }>("POST", "/api/admin/perfis", { name: `Teste ${stamp}`, percent: 20 });
  profileId = newProfile.data.id ?? null;
  check("criar perfil pelo painel", newProfile.status === 200 && Boolean(profileId), `HTTP ${newProfile.status} ${newProfile.text.slice(0, 120)}`);
  const { count: copied } = await admin.from("profile_prices").select("product_id", { count: "exact", head: true }).eq("profile_id", profileId);
  check("perfil nasce com a tabela da loja", (copied ?? 0) > 20, `${copied} tamanhos`);

  const badTier = await api("PATCH", `/api/admin/perfis/${profileId}`, {
    items: [{ product_id: "10x15", price_cents: 100, price_tiers: [{ min: 100, price_cents: 120 }] }],
  });
  check("faixa mais cara que o preço é recusada", badTier.status === 400, `HTTP ${badTier.status}`);
  const ownPrice = await api("PATCH", `/api/admin/perfis/${profileId}`, {
    items: [{ product_id: "10x15", price_cents: 100, price_tiers: [{ min: 100, price_cents: 80 }] }],
  });
  check("preço próprio no perfil", ownPrice.status === 200, `HTTP ${ownPrice.status} ${ownPrice.text.slice(0, 120)}`);

  const assign = await api("PUT", `/api/admin/clientes/${userId}`, { profile_id: profileId });
  check("aplicar perfil ao cliente", assign.status === 200, `HTTP ${assign.status}`);

  const withProfile = await uploadPhoto("perfil.jpg", 3000, 2000);
  await api("PATCH", `/api/photos/${withProfile.id}`, { quantity: 3 });
  const profileCart = await api("GET", "/carrinho");
  check(
    "carrinho com o preço do perfil e o da loja riscado",
    profileCart.status === 200 && profileCart.text.includes("3,00") && profileCart.text.includes(`${(store10!.price_cents / 100).toFixed(2).replace(".", ",")}`),
    `HTTP ${profileCart.status}`,
  );
  const profileOrder = await api<{ orderId?: string; error?: string }>("POST", "/api/checkout", {
    customer: { name: "Cliente Teste", cpf: "123.456.789-09", whatsapp: "(47) 99999-0000" },
    service: "retirada",
  });
  const { data: charged } = await admin
    .from("orders")
    .select("subtotal_cents, price_profile_name")
    .eq("id", profileOrder.data.orderId ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();
  check(
    "pedido cobrado pela tabela do perfil",
    charged?.subtotal_cents === 300 && charged?.price_profile_name === `Teste ${stamp}`,
    JSON.stringify(charged ?? profileOrder.data),
  );

  const removed2 = await api("DELETE", `/api/admin/perfis/${profileId}`);
  check("excluir perfil", removed2.status === 200, `HTTP ${removed2.status}`);
  const { count: still } = await admin.from("customer_price_profiles").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  check("cliente volta para a tabela da loja", still === 0);
  profileId = null;
} catch (err) {
  failures++;
  console.error("FALHOU", err instanceof Error ? err.message : err);
} finally {
  // Limpeza: perfil de teste, pedido, cupom, arquivos e o cliente temporário
  if (profileId) await admin.from("price_profiles").delete().eq("id", profileId);
  if (userId) {
    await admin.from("error_logs").delete().eq("scope", "teste-fluxo");
    await admin.from("coupon_redemptions").delete().eq("code", couponCode);
    await admin.from("orders").delete().eq("user_id", userId);
    await admin.from("coupons").delete().eq("code", couponCode);
    const { error } = await admin.auth.admin.deleteUser(userId);
    console.log(error ? `aviso: cliente ${email} não foi apagado: ${error.message}` : "OK     dados de teste apagados");
  }
  if (keys.length) {
    await s3
      .send(new DeleteObjectsCommand({ Bucket: process.env.S3_BUCKET, Delete: { Objects: keys.map((Key) => ({ Key })) } }))
      .catch((err) => console.log("aviso: arquivos de teste ficaram no bucket:", err.message));
  }
}

console.log(failures ? `\n${failures} verificação(ões) falharam.` : "\nTudo certo.");
process.exit(failures ? 1 : 0);
