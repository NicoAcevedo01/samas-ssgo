import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { configOK } from './lib/supabase'
import './styles.css'

// Muestra el error en pantalla en lugar de una página en blanco
class ErrorPantalla extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="login"><div className="caja">
        <h3>Ocurrió un error</h3>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8rem' }}>{String(this.state.error?.message || this.state.error)}</pre>
        <button onClick={() => location.reload()} style={{ width: '100%' }}>Recargar</button>
      </div></div>
    )
  }
}

function FaltaConfig() {
  return (
    <div className="login"><div className="caja">
      <h3>Falta configurar Supabase</h3>
      <p style={{ textAlign: 'left' }}>
        No se encontraron los secretos <b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b>.
        Cargalos en GitHub (Settings → Secrets and variables → Actions) y volvé a ejecutar el deploy.
      </p>
    </div></div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorPantalla>
      {!configOK ? <FaltaConfig /> : (
        <HashRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </HashRouter>
      )}
    </ErrorPantalla>
  </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js'))
}
