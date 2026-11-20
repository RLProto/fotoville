/**
 * Teste da recuperação de senha contra o site rodando (npm run dev), sem enviar e-mail:
 * o link é gerado pela service role (generateLink), igual ao que o modelo do e-mail monta.
 * Cria um cliente temporário e apaga no fim. Não cria pedido, então o grupo do WhatsApp não é avisado.
 * Uso: npm run check:senha   (SITE=http://localhost:3000 por padrão)
 */
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const SITE = (process.env.SITE ?? "http://localhost:3000").replace(/\/$/, "");
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

let failures = 0;
function check(label: string, ok: unknown, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "OK    " : "FALHOU"} ${label}${detail ? `  (${detail})` : ""}`);
}

const stamp = Date.now();
const email = `teste-senha-${stamp}@exemplo.com`;
const oldPassword = `Antiga-${stamp}-fotoville`;
const newPassword = `Nova-${stamp}-fotoville`;
const createdUsers: string[] = [];

/** Cliente do Supabase com cookies num pote, como o navegador: o site lê a mesma sessão. */
function browser() {
  const jar = new Map<string, string>();
  const client = createServerClient(URL_, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const cookie = () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
  const get = (path: string) => fetch(SITE + path, { headers: { Cookie: cookie() }, redirect: "manual" });
  return { client, get };
}

async function recoveryHash() {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) throw error;
  return data.properties.hashed_token;
}

try {
  const { data: created, error } = await admin.auth.admin.createUser({ email, password: oldPassword, email_confirm: true });
  if (error) throw error;
  createdUsers.push(created.user.id);
  check("cliente temporário criado", created.user.id);

  // Outra sessão aberta (outro aparelho): deve cair quando a senha for trocada
  const other = browser();
  const otherLogin = await other.client.auth.signInWithPassword({ email, password: oldPassword });
  check("sessão em outro aparelho", !otherLogin.error, otherLogin.error?.message);

  // Páginas sem login
  const ask = await fetch(`${SITE}/recuperar-senha`);
  check("página de pedir link abre", ask.status === 200, `HTTP ${ask.status}`);
  const askHtml = await ask.text();
  check("página de pedir link não mostra aviso sem erro", !askHtml.includes("expirou ou já foi usado"));
  const askExpired = await (await fetch(`${SITE}/recuperar-senha?erro=link`)).text();
  check("página de pedir link avisa link vencido", askExpired.includes("expirou ou já foi usado"));
  const guarded = await fetch(`${SITE}/nova-senha`, { redirect: "manual" });
  check(
    "nova senha sem sessão leva a pedir link",
    (guarded.headers.get("location") ?? "").includes("/recuperar-senha"),
    `${guarded.status} ${guarded.headers.get("location")}`,
  );

  // Link do e-mail: abrir a página não gasta o token (leitor de e-mail e antivírus abrem antes do cliente)
  const hash = await recoveryHash();
  for (let i = 0; i < 2; i++) {
    const page = await fetch(`${SITE}/auth/confirmar?token_hash=${hash}&type=recovery`);
    const html = await page.text();
    check(`página do link abre (visita ${i + 1})`, page.status === 200 && html.includes("Continuar"), `HTTP ${page.status}`);
  }
  const broken = await (await fetch(`${SITE}/auth/confirmar?type=recovery`)).text();
  check("link cortado mostra aviso e pedir outro", broken.includes("expirou ou já foi usado") && broken.includes("/recuperar-senha"));
  const badType = await (await fetch(`${SITE}/auth/confirmar?token_hash=${hash}&type=magiclink`)).text();
  check("tipo de link desconhecido é recusado", badType.includes("expirou ou já foi usado"));

  // O botão confere o token (o mesmo verifyOtp da action) e abre a sessão de recuperação
  const user = browser();
  const verified = await user.client.auth.verifyOtp({ token_hash: hash, type: "recovery" });
  check("token continua válido depois das visitas", !verified.error && verified.data.user?.email === email, verified.error?.message);
  const reused = await browser().client.auth.verifyOtp({ token_hash: hash, type: "recovery" });
  check("token não vale duas vezes", Boolean(reused.error), reused.error?.code);

  const form = await user.get("/nova-senha");
  const formHtml = await form.text();
  check("nova senha abre com a sessão do link", form.status === 200 && formHtml.includes(email), `HTTP ${form.status}`);
  check("campo de usuário para o gerenciador de senhas", formHtml.includes('autoComplete="username"') || formHtml.includes('autocomplete="username"'));

  // Regras da senha (as mesmas que o Supabase cobra, com as mensagens traduzidas no formulário)
  const same = await user.client.auth.updateUser({ password: oldPassword });
  check("senha igual à atual é recusada", same.error?.code === "same_password", same.error?.code);
  const short = await user.client.auth.updateUser({ password: "Ab1234!" });
  check("senha com menos de 8 caracteres é recusada", short.error?.code === "weak_password", short.error?.code ?? "aceita");
  const leaked = await user.client.auth.updateUser({ password: "password123" });
  check("senha vazada é recusada", leaked.error?.code === "weak_password", leaked.error?.code ?? "aceita");

  const changed = await user.client.auth.updateUser({ password: newPassword });
  check("nova senha salva", !changed.error, changed.error?.message);
  const others = await user.client.auth.signOut({ scope: "others" });
  check("outras sessões encerradas", !others.error, others.error?.message);
  const otherAfter = await other.client.auth.refreshSession();
  check("sessão do outro aparelho caiu", Boolean(otherAfter.error), otherAfter.error?.code ?? "continuou");
  const stillIn = await user.get("/conta?senha=alterada");
  const contaHtml = await stillIn.text();
  check("quem trocou continua logado e vê o aviso", stillIn.status === 200 && contaHtml.includes("Senha alterada"), `HTTP ${stillIn.status}`);

  const withOld = await browser().client.auth.signInWithPassword({ email, password: oldPassword });
  check("senha antiga não entra mais", Boolean(withOld.error), withOld.error?.code);
  const withNew = await browser().client.auth.signInWithPassword({ email, password: newPassword });
  check("senha nova entra", !withNew.error, withNew.error?.message);

  // Link antigo (/auth/callback) vencido: recuperação volta para pedir outro, cadastro para o login
  const oldRecovery = await fetch(`${SITE}/auth/callback?token_hash=invalido&type=recovery&next=/nova-senha`, { redirect: "manual" });
  check(
    "link antigo de recuperação vencido leva a pedir outro",
    (oldRecovery.headers.get("location") ?? "").includes("/recuperar-senha?erro=link"),
    `${oldRecovery.status} ${oldRecovery.headers.get("location")}`,
  );
  const oldSignup = await fetch(`${SITE}/auth/callback?token_hash=invalido&type=email&next=/conta`, { redirect: "manual" });
  check(
    "link antigo de cadastro vencido leva ao login",
    (oldSignup.headers.get("location") ?? "").includes("/entrar?erro=link"),
    `${oldSignup.status} ${oldSignup.headers.get("location")}`,
  );

  // Cadastro: o destino escolhido fica na conta e sobrevive à confirmação por outro aparelho
  const signupEmail = `teste-senha-cadastro-${stamp}@exemplo.com`;
  const signup = await admin.auth.admin.generateLink({
    type: "signup",
    email: signupEmail,
    password: newPassword,
    options: { data: { full_name: "Teste", signup_next: "/carrinho" } },
  });
  if (signup.error) throw signup.error;
  createdUsers.push(signup.data.user.id);
  const confirmPage = await (await fetch(`${SITE}/auth/confirmar?token_hash=${signup.data.properties.hashed_token}&type=email`)).text();
  check("página de confirmar cadastro abre", confirmPage.includes("Confirmar e-mail"));
  const confirmed = await browser().client.auth.verifyOtp({ token_hash: signup.data.properties.hashed_token, type: "email" });
  check(
    "confirmação de cadastro guarda o destino",
    !confirmed.error && confirmed.data.user?.user_metadata?.signup_next === "/carrinho",
    confirmed.error?.message ?? String(confirmed.data.user?.user_metadata?.signup_next),
  );
} catch (err) {
  failures++;
  console.error("FALHOU", err instanceof Error ? err.message : err);
} finally {
  for (const id of createdUsers) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.log(`aviso: cliente de teste ${id} não foi apagado: ${error.message}`);
  }
  if (createdUsers.length) console.log("OK     clientes de teste apagados");
}

console.log(failures ? `\n${failures} verificação(ões) falharam.` : "\nTudo certo.");
process.exit(failures ? 1 : 0);
