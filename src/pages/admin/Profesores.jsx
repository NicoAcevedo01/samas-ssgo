import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDatos } from '../../lib/useDatos'
import { msgError } from '../../lib/utils'
import { Badge, Cabecera, Campo, Cargando, ErrorBox, Modal, Vacio } from '../../components/ui'

const VACIO = { nombre: '', apellido: '', dni: '', telefono: '', email: '', usuario: '', porcentaje_liquid: 0, activo: true }

export default function Profesores() {
  const [edit, setEdit] = useState(null)
  const { datos, error, cargando, recargar } = useDatos(
    () => supabase.from('profesores').select('*, clases(id)').order('apellido'), [])

  async function guardar(e) {
    e.preventDefault()
    const { id, clases, created_at, perfil_id, ...resto } = edit
    const fila = { ...resto, dni: resto.dni.replace(/\./g, '').trim(), usuario: resto.usuario.trim().toLowerCase() || null,
      email: resto.email?.trim() || null, porcentaje_liquid: Number(resto.porcentaje_liquid) }
    const { error } = id ? await supabase.from('profesores').update(fila).eq('id', id) : await supabase.from('profesores').insert(fila)
    if (error) return alert(msgError(error))
    setEdit(null); recargar()
  }

  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  return (
    <>
      <Cabecera titulo="Profesores"><button onClick={() => setEdit({ ...VACIO })}>+ Profesor</button></Cabecera>
      <ErrorBox error={error} />
      {cargando ? <Cargando /> : !datos?.length ? <Vacio>Todavía no hay profesores cargados.</Vacio> : (
        <div className="tarjeta">
          <ul className="lista">
            {datos.map((p) => (
              <li key={p.id} className="fila-click" onClick={() => setEdit({ ...p, usuario: p.usuario || '', dni: p.dni || '' })}>
                <span>
                  <b>{p.apellido}, {p.nombre}</b>
                  <div className="sub">@{p.usuario || '—'} · {p.clases.length} clases · {p.porcentaje_liquid}% liquidación</div>
                </span>
                <span className="acciones">
                  {!p.activo && <Badge>Inactivo</Badge>}
                  <Badge cls={p.perfil_id ? 'ok' : 'warn'}>{p.perfil_id ? 'Con cuenta' : 'Sin cuenta'}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {edit && (
        <Modal titulo={edit.id ? 'Editar profesor' : 'Nuevo profesor'} onClose={() => setEdit(null)}>
          <form className="form" onSubmit={guardar}>
            <div className="form-2">
              <Campo label="Nombre"><input required value={edit.nombre} onChange={set('nombre')} /></Campo>
              <Campo label="Apellido"><input required value={edit.apellido} onChange={set('apellido')} /></Campo>
              <Campo label="DNI"><input required inputMode="numeric" value={edit.dni} onChange={set('dni')} /></Campo>
              <Campo label="Usuario" ayuda="Con esto + DNI crea su cuenta">
                <input required autoCapitalize="none" value={edit.usuario} onChange={set('usuario')} />
              </Campo>
              <Campo label="Teléfono"><input type="tel" value={edit.telefono || ''} onChange={set('telefono')} /></Campo>
              <Campo label="Email (opcional)"><input type="email" value={edit.email || ''} onChange={set('email')} /></Campo>
              <Campo label="% que le corresponde" ayuda="Sobre lo que recauda. El resto queda para el dojo.">
                <input type="number" min="0" max="100" step="0.5" value={edit.porcentaje_liquid} onChange={set('porcentaje_liquid')} />
              </Campo>
            </div>
            <label><input type="checkbox" style={{ width: 'auto' }} checked={edit.activo} onChange={set('activo')} /> Activo</label>
            <button>Guardar</button>
          </form>
        </Modal>
      )}
    </>
  )
}
