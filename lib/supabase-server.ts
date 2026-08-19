import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

// Validate at runtime when actually used
if (typeof window === "undefined") {
  // Server-side only
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("⚠️ Missing Supabase server environment variables - API routes may fail at runtime");
  }
}
