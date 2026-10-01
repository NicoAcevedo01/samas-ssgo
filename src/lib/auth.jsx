import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null) // { rol, profesor_id, alumno_id, nombre }
  const [cargando, setCargando] = useState(true)

  const cargarPerfil = useCallback(async (s) => {
    if (!s) { setPerfil(null); setCargando(false); return }
    const { data } = await supabase.rpc('mi_sesion')
    setPerfil(data?.[0] || null)
    setCargando(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); cargarPerfil(data.session) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setTimeout(() => cargarPerfil(s), 0) // evita bloqueo dentro del callback
    })
    return () => sub.subscription.unsubscribe()
  }, [cargarPerfil])

  const salir = () => supabase.auth.signOut()

  return (
    <AuthCtx.Provider value={{ session, perfil, cargando, salir, recargar: () => cargarPerfil(session) }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
