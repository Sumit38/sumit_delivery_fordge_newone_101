import { createClient } from '@supabase/supabase-js';

let cachedClient: any = null;

function getClient() {
  if (!cachedClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // During build time, return a dummy object to prevent errors
    if (!supabaseUrl || !supabaseAnonKey) {
      return {};
    }

    cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return cachedClient;
}

// Create a proxy that defers client creation to runtime
export const supabase = new Proxy({}, {
  get: (target, prop) => {
    const client = getClient();
    const value = client[prop as string];
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as any;

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          clerk_id: string;
          mobile: string;
          organization: string;
          role: string;
          email: string;
          created_at: string;
        };
        Insert: {
          clerk_id: string;
          mobile: string;
          organization: string;
          role: string;
          email: string;
        };
        Update: {
          mobile?: string;
          organization?: string;
          role?: string;
        };
      };
      requirements: {
        Row: {
          id: string;
          user_id: string;
          document_text: string;
          title?: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          document_text: string;
          title?: string;
        };
        Update: {
          document_text?: string;
          title?: string;
        };
      };
      complexity_results: {
        Row: {
          id: string;
          requirement_id: string;
          nodes_count: number;
          edges_count: number;
          complexity_score: number;
          test_scenarios: number;
          analysis_data: Record<string, any>;
          created_at: string;
        };
        Insert: {
          requirement_id: string;
          nodes_count: number;
          edges_count: number;
          complexity_score: number;
          test_scenarios: number;
          analysis_data: Record<string, any>;
        };
        Update: {
          nodes_count?: number;
          edges_count?: number;
          complexity_score?: number;
          test_scenarios?: number;
          analysis_data?: Record<string, any>;
        };
      };
    };
  };
};
