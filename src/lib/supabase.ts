// cspell:ignore supabase SUPABASE
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
// Prefer the new publishable key format; fall back to legacy anon key
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''

// Create appropriate client based on environment availability
let supabaseClient: SupabaseClient | {
  auth: {
    getSession: () => Promise<{ data: { session: null }; error: null }>
    refreshSession: () => Promise<{ data: { session: null }; error: null }>
    onAuthStateChange: () => { data: { subscription: null } }
    signInWithPassword: () => Promise<{ error: { message: string } }>
    signUp: () => Promise<{ error: { message: string } }>
    resetPasswordForEmail: () => Promise<{ error: { message: string } }>
    signOut: () => Promise<{ error: null }>
  }
}

// Helper to validate URL format
const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const isConfigured = supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl)

if (!isConfigured) {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Auth backend credentials missing. Using mock client.')
  } else {
    console.warn('⚠️ Invalid auth backend URL provided. Using mock client.')
  }
  
  supabaseClient = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      refreshSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: null } }),
      signInWithPassword: () => Promise.resolve({ error: { message: 'Authentication is not configured' } }),
      signUp: () => Promise.resolve({ error: { message: 'Authentication is not configured' } }),
      resetPasswordForEmail: () => Promise.resolve({ error: { message: 'Authentication is not configured' } }),
      signOut: () => Promise.resolve({ error: null })
    }
  }
} else {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = supabaseClient
