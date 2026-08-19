import { createClient } from "@supabase/supabase-js";

let cachedClient: any = null;

export const supabaseServer = {
  from: (table: string) => {
    if (!cachedClient) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Missing Supabase credentials");
      }

      cachedClient = createClient(supabaseUrl, supabaseServiceKey);
    }

    return cachedClient.from(table);
  },

  auth: {
    admin: {
      createUser: async (options: any) => {
        if (!cachedClient) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Missing Supabase credentials");
          }

          cachedClient = createClient(supabaseUrl, supabaseServiceKey);
        }

        return cachedClient.auth.admin.createUser(options);
      },
    },
  },
} as any;
