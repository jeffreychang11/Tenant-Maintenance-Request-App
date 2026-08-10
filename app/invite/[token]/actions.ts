"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) throw new Error(error.message);
  redirect("/home");
}
