import { createClient } from "@supabase/supabase-js";
let instance: ReturnType<typeof createClient> | null = null;
export function cloudClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return instance || (instance = createClient(url, key));
}
