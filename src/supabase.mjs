import { createClient } from "@supabase/supabase-js";
import { config } from "./config.mjs";
import { AppError } from "./errors.mjs";

export const initSupabase = () => {
  if (!config.supabase.url) throw new AppError("CONFIG", "Missing SUPABASE_URL", 500);
  if (!config.supabase.serviceRoleKey) throw new AppError("CONFIG", "Missing SUPABASE_SERVICE_ROLE_KEY", 500);

  // Service role for server-side access
  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "spiritcore-phase4" } }
  });
};
