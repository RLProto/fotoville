/**
 * Testa o bucket de fotos pelo mesmo caminho que o site usa: URL assinada de envio (PUT),
 * leitura por URL assinada (GET), CORS para o navegador e remoção.
 * Uso: npm run check:storage
 */
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

process.loadEnvFile(".env.local");

const env = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Falta ${name} no .env.local`);
    process.exit(1);
  }
  return value;
};

const bucket = env("S3_BUCKET");
const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const s3 = new S3Client({
  region: env("S3_REGION"),
  endpoint: env("S3_ENDPOINT"),
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: { accessKeyId: env("S3_ACCESS_KEY_ID"), secretAccessKey: env("S3_SECRET_ACCESS_KEY") },
});

const key = `teste/verificacao-${Date.now()}.jpg`;
const body = new Uint8Array(2048).map((_, i) => i % 251);
let failed = false;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failed = true;
  console.log(`${ok ? "OK  " : "FALHOU"} ${label}${detail ? ` (${detail})` : ""}`);
};

try {
  const putUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "image/jpeg" }), {
    expiresIn: 300,
  });

  const preflight = await fetch(putUrl, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  const allowOrigin = preflight.headers.get("access-control-allow-origin");
  check(
    "navegador pode enviar (CORS)",
    preflight.ok && (allowOrigin === "*" || allowOrigin === origin),
    `HTTP ${preflight.status}, allow-origin=${allowOrigin ?? "ausente"}`,
  );

  const put = await fetch(putUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg", Origin: origin },
    body,
  });
  check("envio por URL assinada", put.ok, `HTTP ${put.status}${put.ok ? "" : ` ${(await put.text()).slice(0, 200)}`}`);

  const getUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
  const get = await fetch(getUrl, { headers: { Origin: origin } });
  const bytes = new Uint8Array(await get.arrayBuffer());
  check(
    "leitura por URL assinada",
    get.ok && bytes.length === body.length && bytes.every((b, i) => b === body[i]),
    `HTTP ${get.status}, ${bytes.length} bytes, allow-origin=${get.headers.get("access-control-allow-origin") ?? "ausente"}`,
  );

  const anonymous = await fetch(`${env("S3_ENDPOINT")}/${bucket}/${key}`);
  check("arquivo bloqueado sem assinatura", !anonymous.ok, `HTTP ${anonymous.status}`);
} catch (err) {
  failed = true;
  console.error("FALHOU", err instanceof Error ? err.message : err);
} finally {
  await s3
    .send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: [{ Key: key }] } }))
    .then(() => console.log("OK   arquivo de teste apagado"))
    .catch((err) => console.error("aviso: não consegui apagar o arquivo de teste", key, err.message));
}

process.exit(failed ? 1 : 0);
