import "server-only";
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Bucket de fotos via API S3. O padrão é Cloudflare R2 (sem cobrança de saída de dados),
 * mas qualquer serviço compatível funciona: Backblaze B2, Supabase Storage (S3), AWS S3.
 * O bucket é privado; todo acesso é por URL assinada de curta duração.
 */

export const hasStorage = Boolean(
  process.env.S3_ENDPOINT &&
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY,
);

let client: S3Client | null = null;

function s3() {
  if (!hasStorage) throw new Error("Storage não configurado (variáveis S3_*).");
  client ??= new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    // R2 e B2 não aceitam os checksums extras que o SDK novo coloca nas URLs assinadas.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

const bucket = () => process.env.S3_BUCKET!;

export function presignUpload(key: string, contentType: string) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), {
    expiresIn: 60 * 15,
  });
}

export function presignDownload(key: string, opts: { downloadName?: string; expiresIn?: number } = {}) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: opts.downloadName
        ? `attachment; filename="${opts.downloadName.replace(/[^\w.\-]+/g, "_")}"`
        : undefined,
    }),
    { expiresIn: opts.expiresIn ?? 60 * 60 },
  );
}

export async function deleteObjects(keys: string[]) {
  const list = keys.filter(Boolean);
  if (!list.length) return;
  await s3().send(
    new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: list.map((Key) => ({ Key })) } }),
  );
}

/** Anexa a URL temporária da miniatura a cada foto. */
export async function withThumbUrls<T extends { thumb_key: string | null; storage_key: string }>(
  photos: T[],
): Promise<(T & { thumb_url: string | null })[]> {
  if (!hasStorage) return photos.map((p) => ({ ...p, thumb_url: null }));
  return Promise.all(
    photos.map(async (p) => ({ ...p, thumb_url: await presignDownload(p.thumb_key ?? p.storage_key) })),
  );
}
