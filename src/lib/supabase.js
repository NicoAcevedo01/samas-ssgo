import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Si faltan los secretos, la app muestra un aviso en vez de quedar en blanco
export const configOK = Boolean(url && key && url.startsWith('https://'))

export const supabase = createClient(
  configOK ? url : 'https://falta-configurar.supabase.co',
  configOK ? key : 'falta-configurar'
)

// Dominio interno: el usuario "juanperez" se loguea como juanperez@samas-ssgo.local
export const DOMINIO = 'samas-ssgo.local'
export const aEmail = (usuarioOEmail) => {
  const v = usuarioOEmail.trim().toLowerCase()
  return v.includes('@') ? v : `${v}@${DOMINIO}`
}
