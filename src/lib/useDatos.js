import { useEffect, useState, useCallback } from 'react'

// Hook simple: ejecuta una consulta y expone datos, error y recargar()
export function useDatos(consulta, deps = []) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    setCargando(true)
    const { data, error } = await consulta()
    setDatos(data); setError(error); setCargando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { recargar() }, [recargar])
  return { datos, error, cargando, recargar }
}
