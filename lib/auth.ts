import { supabase } from './supabase'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/login'
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) return null
  return session
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) return null
  return user
}