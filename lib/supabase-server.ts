import { createClient } from "@supabase/supabase-js";

let cachedClient: any = null;

function getClient() {
  if (!cachedClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    cachedClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return cachedClient;
}

// Create a proxy that intercepts all property access and method calls
export const supabaseServer = new Proxy(
  {},
  {
    get: (target, prop) => {
      const client = getClient();
      const value = client[prop as string];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
) as any;
