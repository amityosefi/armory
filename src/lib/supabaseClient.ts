import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

// Prevent multiple clients during hot reload (important in dev)
const globalForSupabase = globalThis as unknown as {
    supabase?: ReturnType<typeof createClient>
}

export const supabase =
    globalForSupabase.supabase ??
    createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    })

if (process.env.NODE_ENV !== 'production') {
    globalForSupabase.supabase = supabase
}
