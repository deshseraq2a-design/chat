import { supabase } from './supabase'

export async function registerAccount(input: { email: string; password: string; username: string }) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { username: input.username },
    },
  })
  if (error) throw error
  return data
}

export async function loginAccount(input: { email: string; password: string }) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.auth.signInWithPassword(input)
  if (error) throw error
  return data
}

export async function logoutAccount() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}
