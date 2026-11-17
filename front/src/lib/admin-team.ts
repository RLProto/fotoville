import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/server";

/** Todas as contas do site (o Supabase entrega de 1000 em 1000). */
export async function listAllUsers() {
  const admin = createAdminClient();
  const users: User[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}
