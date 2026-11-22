// Supabase helper for Bizora backend server
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://rxihjtilxlhdxzauwrwh.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_eFeXN6Yn6QtE8LCS7QdacA_ei15XrR7';

// Public/Default Supabase client
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Creates an authenticated Supabase client using the Bearer token from the incoming request.
 * This ensures that Row Level Security (RLS) is automatically enforced for the calling user.
 */
export function getAuthenticatedSupabase(bearerToken) {
  if (!bearerToken) return supabasePublic;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`,
      },
    },
  });
}

/**
 * Extracts and verifies the user from an Authorization header
 */
export async function getUserFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const { data, error } = await supabasePublic.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}
