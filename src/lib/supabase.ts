import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null

export type PublicBook = {
  id: string
  title: string
  author: string
  category: string
  shelf: string
  copies: number
  available_copies: number
}

export type Book = {
  id: string
  title: string
  author: string
  category: string
  shelf: string
  copies: number
  archived: boolean
  created_at: string
}

export type Loan = {
  id: string
  borrower_name: string
  checked_out_at: string
  book_id: string
  book: Pick<Book, 'title' | 'author' | 'shelf'>
}
