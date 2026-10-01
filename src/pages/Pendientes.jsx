import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useDatos } from '../lib/useDatos'
import { fmtFecha, hoyISO, msgError } from '../lib/utils'
import { Badge, Cabecera, Campo, Cargando, ErrorBox, Modal, Vacio } from '../components/ui'

const PRIO = { alta: ['Alta', 'bad'], media: ['Media', 'warn'], baja: ['Baja', ''] }
const EST = { abierto: 'Abierto', en_curso: 'En curso', resuelto: 'Resuelto' }

export default function Pendientes() {
  const { perfil } = useAuth()
  const esAdmin = perfil.rol === 'admin'
  const [filtro, setFiltro] = useState('activos')
  const [tipo, setTipo] = useState('')
  const [edit, setEdit] = useState(null)

  const { datos, error, cargando, recargar } = useDatos(async () => {
    const [p, d, pr] = await Promise.all([
      supabase.from('pendientes').select('*, dojos(nombre), alumnos(nombre, apellido), profesores(nombre, apellido)')
        .order('estado').order('fecha_limite', { nullsFirst: false }),
      supabase.from('dojos').select('id, nombre').order('nombre'),
      esAdmin ? supabase.from('profesores').select('id, nombre, apellido').eq('activo', true).order('apellido') : { data: [] },
    ])
    return { data: { pend: p.data || [], dojos: d.data || [], profes: pr.data || [] }, error: p.error }
  }, [])

  async function guardar(e) {
    e.preventDefault()
    const { id, dojos, alumnos, profesores, created_at, ...resto } = edit
    const fila = { ...resto, dojo_id: resto.dojo_id || null, asignado_a: resto.asignado_a || null, fecha_limite: resto.fecha_limite || null }
    if (fila.estado === 'resuelto' && !fila.resuelto_at) fila.resuelto_at = new Date().toISOString()
    const { error } = id ? await supabase.from('pendientes').update(fila).eq('id', id) : await supabase.from('pendientes').insert(fila)
    if (error) return alert(msgError(error))
    setEdit(null); recargar()
  }

  async function cambiar(p, estado) {
    const { error } = await supabase.from('pendientes')
      .update({ estado, resuelto_at: estado === 'resuelto' ? new Date().toISOString() : null }).eq('id', p.id)
    if (error) alert(msgError(error)); else recargar()
  }

  if (cargando) return <Cargando />
  const hoy = hoyISO()
  const lista = datos.pend.filter((p) =>
    (filtro === 'todos' || (filtro === 'activos' ? p.estado !== 'resuelto' : p.estado === 'resuelto')) && (!tipo || p.tipo === tipo))
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value })

  return (
    <>
      <Cabecera titulo="Pendientes">
        <button onClick={() => setEdit({ tipo: 'interno', titulo: '', descripcion: '', dojo_id: '', asignado_a: esAdmin ? '' : perfil.profesor_id, prioridad: 'media', estado: 'abierto', fecha_limite: '' })}>
          + Pendiente
        </button>
      </Cabecera>
      <div className="filtros">
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="activos">Abiertos y en curso</option>
          <option value="resueltos">Resueltos</option>
          <option value="todos">Todos</option>
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Internos y de alumnos</option>
          <option value="interno">Internos (dojo)</option>
          <option value="alumno">De alumnos</option>
        </select>
      </div>

      <ErrorBox error={error} />
      {!lista.length ? <Vacio>No hay pendientes. 👌</Vacio> : (
        <div className="tarjeta">
          <ul className="lista">
            {lista.map((p) => (
              <li key={p.id}>
                <span className="fila-click" onClick={() => setEdit({ ...p, descripcion: p.descripcion || '', dojo_id: p.dojo_id || '', asignado_a: p.asignado_a || '', fecha_limite: p.fecha_limite || '' })}>
                  <b>{p.titulo}</b>
                  <div className="sub">
                    {p.tipo === 'alumno' ? '🥋 Alumno' : '🏠 Interno'}
                    {p.dojos ? ` · ${p.dojos.nombre}` : ''}
                    {p.profesores ? ` · ${p.profesores.nombre}` : ''}
                    {p.fecha_limite ? ` · ` : ''}
                    {p.fecha_limite && <span style={{ color: p.fecha_limite < hoy && p.estado !== 'resuelto' ? 'var(--bad)' : undefined }}>límite {fmtFecha(p.fecha_limite)}</span>}
                  </div>
                </span>
                <span className="acciones">
                  <Badge cls={PRIO[p.prioridad][1]}>{PRIO[p.prioridad][0]}</Badge>
                  {p.estado === 'abierto' && <button className="btn-chico btn-sec" onClick={() => cambiar(p, 'en_curso')}>Tomar</button>}
                  {p.estado !== 'resuelto'
                    ? <button className="btn-chico" onClick={() => cambiar(p, 'resuelto')}>✓</button>
                    : <Badge cls="ok">Resuelto</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {edit && (
        <Modal titulo={edit.id ? 'Editar pendiente' : 'Nuevo pendiente'} onClose={() => setEdit(null)}>
          <form className="form" onSubmit={guardar}>
            <Campo label="Título"><input required value={edit.titulo} onChange={set('titulo')} placeholder="Ej.: Arreglar bolsa de boxeo" /></Campo>
            <Campo label="Detalle"><textarea rows="3" value={edit.descripcion} onChange={set('descripcion')} /></Campo>
            <div className="form-2">
              <Campo label="Tipo">
                <select value={edit.tipo} onChange={set('tipo')}>
                  <option value="interno">Interno (dojo)</option>
                  <option value="alumno">De alumno</option>
                </select>
              </Campo>
              <Campo label="Dojo">
                <select value={edit.dojo_id} onChange={set('dojo_id')}>
                  <option value="">General</option>
                  {datos.dojos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </Campo>
              <Campo label="Prioridad">
                <select value={edit.prioridad} onChange={set('prioridad')}>
                  {Object.entries(PRIO).map(([k, [v]]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
              <Campo label="Fecha límite"><input type="date" value={edit.fecha_limite} onChange={set('fecha_limite')} /></Campo>
              {esAdmin && (
                <Campo label="Asignado a">
                  <select value={edit.asignado_a} onChange={set('asignado_a')}>
                    <option value="">Administración</option>
                    {datos.profes.map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
                  </select>
                </Campo>
              )}
              {edit.id && (
                <Campo label="Estado">
                  <select value={edit.estado} onChange={set('estado')}>
                    {Object.entries(EST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Campo>
              )}
            </div>
            <button>Guardar</button>
          </form>
        </Modal>
      )}
    </>
  )
}
