import { useState } from 'react'
import { supabase, aEmail } from '../lib/supabase'
import { msgError } from '../lib/utils'
import { Campo } from '../components/ui'

export default function Login() {
  const [modo, setModo] = useState('ingresar')
  const [f, setF] = useState({ usuario: '', password: '', password2: '', dni: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function enviar(e) {
    e.preventDefault()
    setError('')
    if (modo === 'crear') {
      if (f.usuario.includes('@')) return setError('Usá tu nombre de usuario, no un email')
      if (f.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
      if (f.password !== f.password2) return setError('Las contraseñas no coinciden')
      if (!f.dni.trim()) return setError('Ingresá tu DNI')
    }
    setEnviando(true)
    const r = modo === 'ingresar'
      ? await supabase.auth.signInWithPassword({ email: aEmail(f.usuario), password: f.password })
      : await supabase.auth.signUp({
          email: aEmail(f.usuario), password: f.password,
          options: { data: { dni: f.dni.trim().replace(/\./g, '') } },
        })
    setEnviando(false)
    if (r.error) setError(msgError(r.error))
  }

  return (
    <div className="login">
      <div className="caja">
        <h1>SAMAS <b>SSGO</b></h1>
        <p>Gestión de dojos</p>

        <div className="tabs">
          <button className={modo === 'ingresar' ? 'activo' : ''} onClick={() => setModo('ingresar')}>Ingresar</button>
          <button className={modo === 'crear' ? 'activo' : ''} onClick={() => setModo('crear')}>Crear cuenta</button>
        </div>

        <form className="form" onSubmit={enviar}>
          <Campo label="Usuario">
            <input value={f.usuario} onChange={set('usuario')} autoCapitalize="none" autoComplete="username" required />
          </Campo>
          {modo === 'crear' && (
            <Campo label="DNI" ayuda="Tiene que coincidir con el que cargó tu profesor">
              <input value={f.dni} onChange={set('dni')} inputMode="numeric" required />
            </Campo>
          )}
          <Campo label="Contraseña">
            <input type="password" value={f.password} onChange={set('password')}
              autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} required />
          </Campo>
          {modo === 'crear' && (
            <Campo label="Repetir contraseña">
              <input type="password" value={f.password2} onChange={set('password2')} autoComplete="new-password" required />
            </Campo>
          )}
          {error && <div className="error">{error}</div>}
          <button disabled={enviando}>{enviando ? 'Un momento…' : modo === 'ingresar' ? 'Ingresar' : 'Crear cuenta'}</button>
        </form>
        {modo === 'crear' && (
          <p style={{ marginTop: '1rem', fontSize: '.8rem' }}>
            Antes de crear tu cuenta, tu profesor tiene que haberte cargado con tu usuario y DNI.
          </p>
        )}
      </div>
      <footer className="pie">Pensado y desarrollado por NaSc</footer>
    </div>
  )
}
