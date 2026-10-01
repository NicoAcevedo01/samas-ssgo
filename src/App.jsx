import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import { Cargando } from './components/ui'
import Login from './pages/Login'

import AdminDashboard from './pages/admin/Dashboard'
import AdminClases from './pages/admin/Clases'
import AdminProfesores from './pages/admin/Profesores'
import AdminPrecios from './pages/admin/Precios'
import AdminPagos from './pages/admin/Pagos'
import AdminLiquidacion from './pages/admin/Liquidacion'
import AdminReservas from './pages/admin/Reservas'

import ProfeHoy from './pages/profesor/Hoy'
import ProfeCaja from './pages/profesor/Caja'

import AlumnoReservar from './pages/alumno/Reservar'
import AlumnoCuota from './pages/alumno/Cuota'
import AlumnoDocumentos from './pages/alumno/Documentos'

// Pantallas compartidas entre admin y profesor (los permisos los filtra la base)
import Alumnos from './pages/Alumnos'
import Cobrar from './pages/Cobrar'
import Pendientes from './pages/Pendientes'

const INICIO = { admin: '/admin', profesor: '/profe', alumno: '/alumno' }

export default function App() {
  const { session, perfil, cargando, salir } = useAuth()

  if (cargando) return <Cargando />
  if (!session) return <Login />

  // Cuenta creada pero sin ficha vinculada (usuario o DNI no coinciden)
  const sinVinculo = !perfil || (perfil.rol === 'alumno' && !perfil.alumno_id) || (perfil.rol === 'profesor' && !perfil.profesor_id)
  if (sinVinculo) {
    return (
      <div className="login">
        <div className="caja">
          <h3>Cuenta sin vincular</h3>
          <p style={{ textAlign: 'left' }}>
            Tu usuario no coincide con ninguna ficha cargada en el dojo. Pedile a tu profesor que revise que
            tu <b>usuario</b> y <b>DNI</b> estén bien cargados, y después volvé a entrar.
          </p>
          <button onClick={salir} style={{ width: '100%' }}>Salir</button>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        {perfil.rol === 'admin' && (
          <>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/alumnos" element={<Alumnos />} />
            <Route path="/admin/pagos" element={<AdminPagos />} />
            <Route path="/admin/cobrar" element={<Cobrar />} />
            <Route path="/admin/clases" element={<AdminClases />} />
            <Route path="/admin/profesores" element={<AdminProfesores />} />
            <Route path="/admin/precios" element={<AdminPrecios />} />
            <Route path="/admin/liquidacion" element={<AdminLiquidacion />} />
            <Route path="/admin/reservas" element={<AdminReservas />} />
            <Route path="/admin/pendientes" element={<Pendientes />} />
          </>
        )}
        {perfil.rol === 'profesor' && (
          <>
            <Route path="/profe" element={<ProfeHoy />} />
            <Route path="/profe/alumnos" element={<Alumnos />} />
            <Route path="/profe/cobrar" element={<Cobrar />} />
            <Route path="/profe/caja" element={<ProfeCaja />} />
            <Route path="/profe/pendientes" element={<Pendientes />} />
          </>
        )}
        {perfil.rol === 'alumno' && (
          <>
            <Route path="/alumno" element={<AlumnoReservar />} />
            <Route path="/alumno/cuota" element={<AlumnoCuota />} />
            <Route path="/alumno/documentos" element={<AlumnoDocumentos />} />
          </>
        )}
      </Route>
      <Route path="*" element={<Navigate to={INICIO[perfil.rol]} replace />} />
    </Routes>
  )
}
