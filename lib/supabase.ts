import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
