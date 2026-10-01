import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const MENUS = {
  admin: [
    ['/admin', '📊', 'Inicio'],
    ['/admin/alumnos', '🥋', 'Alumnos'],
    ['/admin/pagos', '💵', 'Pagos'],
    ['/admin/clases', '📅', 'Dojos y clases'],
    ['/admin/profesores', '👤', 'Profesores'],
    ['/admin/precios', '🏷️', 'Precios'],
    ['/admin/liquidacion', '🧮', 'Liquidación'],
    ['/admin/reservas', '🎟️', 'Reservas'],
    ['/admin/pendientes', '📌', 'Pendientes'],
  ],
  profesor: [
    ['/profe', '📅', 'Hoy'],
    ['/profe/alumnos', '🥋', 'Alumnos'],
    ['/profe/cobrar', '💵', 'Cobrar'],
    ['/profe/caja', '🧮', 'Mi caja'],
    ['/profe/pendientes', '📌', 'Pendientes'],
  ],
  alumno: [
    ['/alumno', '📅', 'Reservar'],
    ['/alumno/cuota', '💵', 'Mi cuota'],
    ['/alumno/documentos', '📄', 'Documentos'],
  ],
}

// En celular la barra inferior muestra las 5 primeras; el resto va en "Más"
export default function Layout() {
  const { perfil, salir } = useAuth()
  const items = MENUS[perfil.rol] || []
  const principales = items.slice(0, 4)
  const extra = items.slice(4)

  return (
    <div className="app">
      <header className="top">
        <div className="marca">SAMAS <b>SSGO</b></div>
        <div className="usuario">
          <span>{perfil.nombre}</span>
          <button className="btn-link" onClick={salir}>Salir</button>
        </div>
      </header>

      <nav className="lateral">
        {items.map(([to, ic, txt]) => (
          <NavLink key={to} to={to} end>{ic} {txt}</NavLink>
        ))}
      </nav>

      <main className="contenido">
        <Outlet />
        <footer className="pie">Pensado y desarrollado por NaSc</footer>
      </main>

      <nav className="inferior">
        {principales.map(([to, ic, txt]) => (
          <NavLink key={to} to={to} end><span>{ic}</span><small>{txt}</small></NavLink>
        ))}
        {extra.length > 0 && (
          <details className="mas">
            <summary><span>☰</span><small>Más</small></summary>
            <div className="mas-menu" onClick={(e) => e.currentTarget.parentElement.removeAttribute('open')}>
              {extra.map(([to, ic, txt]) => <NavLink key={to} to={to} end>{ic} {txt}</NavLink>)}
            </div>
          </details>
        )}
      </nav>
    </div>
  )
}
