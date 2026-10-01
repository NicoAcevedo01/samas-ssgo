import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')

export const supabase = createClient(url, key)

// Dominio interno: el usuario "juanperez" se loguea como juanperez@samas-ssgo.local
export const DOMINIO = 'samas-ssgo.local'
export const aEmail = (usuarioOEmail) => {
  const v = usuarioOEmail.trim().toLowerCase()
  return v.includes('@') ? v : `${v}@${DOMINIO}`
}
