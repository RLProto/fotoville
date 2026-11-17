import "server-only";
import { createAdminClient } from "./supabase/server";

/** Procura a conta pelo e-mail (sem diferenciar maiúsculas). */
export async function findUserByEmail(email: string) {
  const target = email.trim().toLowerCase();
  const admin = createAdminClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  return null;
}
