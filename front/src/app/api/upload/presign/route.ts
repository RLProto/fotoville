import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireUser } from "@/lib/api";
import { hasStorage, presignUpload } from "@/lib/storage";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 40 * 1024 * 1024;

const schema = z.object({
  files: z
    .array(z.object({ name: z.string().max(255), type: z.string(), size: z.number().int().positive() }))
    .min(1)
    .max(30),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!hasStorage) return fail("Armazenamento de fotos não configurado.", 503);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Não foi possível enviar. Tente de novo.");

  const uploads = await Promise.all(
    parsed.data.files.map(async (file) => {
      const ext = TYPES[file.type];
      if (!ext) return { name: file.name, error: "Formato não aceito. Envie JPG, PNG ou WebP." };
      if (file.size > MAX_BYTES) return { name: file.name, error: "Arquivo maior que 40 MB. Envie uma versão menor." };

      const base = `u/${auth.user.id}/${randomUUID()}`;
      const key = `${base}.${ext}`;
      const thumbKey = `${base}_t.jpg`;
      const [uploadUrl, thumbUploadUrl] = await Promise.all([
        presignUpload(key, file.type),
        presignUpload(thumbKey, "image/jpeg"),
      ]);
      return { name: file.name, key, thumbKey, uploadUrl, thumbUploadUrl };
    }),
  );

  return NextResponse.json({ uploads });
}
