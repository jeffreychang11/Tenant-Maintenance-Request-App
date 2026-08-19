"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateDndSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const enabled = formData.get("dnd_enabled") === "on";
  const startTime = (formData.get("dnd_start_time") as string) || null;
  const endTime = (formData.get("dnd_end_time") as string) || null;
  const timezone = (formData.get("dnd_timezone") as string) || null;

  if (enabled && (!startTime || !endTime || !timezone)) {
    throw new Error("Set a start and end time before enabling Do Not Disturb.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      dnd_enabled: enabled,
      dnd_start_time: startTime,
      dnd_end_time: endTime,
      dnd_timezone: timezone,
    })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}
