import { createClient } from "@supabase/supabase-js";

let supabaseServerInstance: any = null;

export const supabaseServer = new Proxy(
  {},
  {
    get() {
      if (!supabaseServerInstance) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error("Missing Supabase server environment variables");
          throw new Error(
            "Missing Supabase credentials: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
          );
        }

        supabaseServerInstance = createClient(supabaseUrl, supabaseServiceKey);
      }
      return supabaseServerInstance;
    },
  }
) as any;
