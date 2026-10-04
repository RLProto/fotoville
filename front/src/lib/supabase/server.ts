import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { hasSupabase } from "../site";

/** Cliente com a sessão do usuário (respeita RLS). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Chamado de um Server Component: o proxy.ts cuida de renovar a sessão.
          }
        },
      },
    },
  );
}

/** Cliente com a service role (ignora RLS). Use só no servidor, depois de checar o usuário. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!hasSupabase || !key) throw new Error("Supabase não configurado (SUPABASE_SERVICE_ROLE_KEY).");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getUser = cache(async (): Promise<User | null> => {
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export const getProfile = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, whatsapp, cpf, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return data as {
    id: string;
    full_name: string | null;
    whatsapp: string | null;
    cpf: string | null;
    is_admin: boolean;
  } | null;
});
