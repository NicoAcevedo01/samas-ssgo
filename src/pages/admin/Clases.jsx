import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDatos } from '../../lib/useDatos'
import { DIAS, fmtHora, msgError } from '../../lib/utils'
import { Badge, Cabecera, Campo, Cargando, ErrorBox, Modal, Vacio } from '../../components/ui'

const CLASE_VACIA = { disciplina_id: '', profesor_id: '', dia_semana: 1, hora_inicio: '18:00', hora_fin: '19:00', cupo: 15, activa: true }

export default function Clases() {
  const [dojoId, setDojoId] = useState('')
  const [editClase, setEditClase] = useState(null)
  const [editDojo, setEditDojo] = useState(null)
  const [nuevaDisc, setNuevaDisc] = useState('')

  const cat = useDatos(async () => {
    const [d, di, p] = await Promise.all([
      supabase.from('dojos').select('*').order('nombre'),
      supabase.from('disciplinas').select('*').order('nombre'),
      supabase.from('profesores').select('id, nombre, apellido').eq('activo', true).order('apellido'),
    ])
    return { data: { dojos: d.data || [], disciplinas: di.data || [], profesores: p.data || [] } }
  }, [])

  useEffect(() => { if (!dojoId && cat.datos?.dojos.length) setDojoId(cat.datos.dojos[0].id) }, [cat.datos, dojoId])

  const clases = useDatos(async () => {
    if (!dojoId) return { data: [] }
    return supabase.from('clases').select('*, disciplinas(nombre), profesores(nombre, apellido)')
      .eq('dojo_id', dojoId).order('dia_semana').order('hora_inicio')
  }, [dojoId])

  async function guardarClase(e) {
    e.preventDefault()
    const { id, disciplinas, profesores, ...resto } = editClase
    const fila = { ...resto, dojo_id: dojoId, profesor_id: resto.profesor_id || null, cupo: Number(resto.cupo), dia_semana: Number(resto.dia_semana) }
    const { error } = id ? await supabase.from('clases').update(fila).eq('id', id) : await supabase.from('clases').insert(fila)
    if (error) return alert(msgError(error))
    setEditClase(null); clases.recargar()
  }

  async function borrarClase(c) {
    if (!confirm('¿Eliminar esta clase? Se borran también sus reservas. Si solo querés pausarla, desactivala.')) return
    const { error } = await supabase.from('clases').delete().eq('id', c.id)
    if (error) alert(msgError(error)); else { setEditClase(null); clases.recargar() }
  }

  async function guardarDojo(e) {
    e.preventDefault()
    const { id, created_at, ...fila } = editDojo
    const { error } = id ? await supabase.from('dojos').update(fila).eq('id', id) : await supabase.from('dojos').insert(fila)
    if (error) return alert(msgError(error))
    setEditDojo(null); cat.recargar()
  }

  async function agregarDisciplina() {
    if (!nuevaDisc.trim()) return
    const { error } = await supabase.from('disciplinas').insert({ nombre: nuevaDisc.trim() })
    if (error) return alert(msgError(error))
    setNuevaDisc(''); cat.recargar()
  }

  if (cat.cargando) return <Cargando />
  const { dojos, disciplinas, profesores } = cat.datos
  const dojo = dojos.find((d) => d.id === dojoId)
  const porDia = {}
  ;(clases.datos || []).forEach((c) => { (porDia[c.dia_semana] ||= []).push(c) })

  return (
    <>
      <Cabecera titulo="Dojos y clases">
        <button className="btn-sec" onClick={() => setEditDojo({ nombre: '', direccion: '', telefono: '', activo: true })}>+ Dojo</button>
        <button onClick={() => setEditClase({ ...CLASE_VACIA })} disabled={!dojoId}>+ Clase</button>
      </Cabecera>

      <div className="filtros">
        <select value={dojoId} onChange={(e) => setDojoId(e.target.value)}>
          {dojos.map((d) => <option key={d.id} value={d.id}>{d.nombre}{d.activo ? '' : ' (inactivo)'}</option>)}
        </select>
        {dojo && <button className="btn-sec" style={{ flex: '0 0 auto' }} onClick={() => setEditDojo(dojo)}>Editar dojo</button>}
      </div>

      <ErrorBox error={clases.error} />
      {clases.cargando ? <Cargando /> : !clases.datos?.length ? <Vacio>Este dojo todavía no tiene clases. Tocá “+ Clase”.</Vacio> : (
        Object.entries(porDia).map(([dia, lista]) => (
          <div className="tarjeta" key={dia}>
            <h3>{DIAS[dia]}</h3>
            <ul className="lista">
              {lista.map((c) => (
                <li key={c.id} className="fila-click" onClick={() => setEditClase(c)}>
                  <span>
                    <b>{fmtHora(c.hora_inicio)}–{fmtHora(c.hora_fin)}</b> · {c.disciplinas?.nombre}
                    <div className="sub">{c.profesores ? `${c.profesores.nombre} ${c.profesores.apellido}` : 'Sin profesor'} · cupo {c.cupo}</div>
                  </span>
                  {!c.activa && <Badge>Inactiva</Badge>}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <div className="tarjeta">
        <h3>Disciplinas</h3>
        <p style={{ margin: '0 0 .6rem' }}>{disciplinas.map((d) => d.nombre).join(' · ')}</p>
        <div className="filtros">
          <input placeholder="Nueva disciplina" value={nuevaDisc} onChange={(e) => setNuevaDisc(e.target.value)} />
          <button style={{ flex: '0 0 auto' }} onClick={agregarDisciplina}>Agregar</button>
        </div>
      </div>

      {editClase && (
        <Modal titulo={editClase.id ? 'Editar clase' : `Nueva clase · ${dojo?.nombre}`} onClose={() => setEditClase(null)}>
          <form className="form" onSubmit={guardarClase}>
            <div className="form-2">
              <Campo label="Disciplina">
                <select required value={editClase.disciplina_id} onChange={(e) => setEditClase({ ...editClase, disciplina_id: e.target.value })}>
                  <option value="">Elegir…</option>
                  {disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </Campo>
              <Campo label="Profesor">
                <select value={editClase.profesor_id || ''} onChange={(e) => setEditClase({ ...editClase, profesor_id: e.target.value })}>
                  <option value="">Sin asignar</option>
                  {profesores.map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
                </select>
              </Campo>
              <Campo label="Día">
                <select value={editClase.dia_semana} onChange={(e) => setEditClase({ ...editClase, dia_semana: e.target.value })}>
                  {DIAS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                </select>
              </Campo>
              <Campo label="Cupo máximo">
                <input type="number" min="1" value={editClase.cupo} onChange={(e) => setEditClase({ ...editClase, cupo: e.target.value })} />
              </Campo>
              <Campo label="Desde">
                <input type="time" required value={fmtHora(editClase.hora_inicio)} onChange={(e) => setEditClase({ ...editClase, hora_inicio: e.target.value })} />
              </Campo>
              <Campo label="Hasta">
                <input type="time" required value={fmtHora(editClase.hora_fin)} onChange={(e) => setEditClase({ ...editClase, hora_fin: e.target.value })} />
              </Campo>
            </div>
            <label><input type="checkbox" style={{ width: 'auto' }} checked={editClase.activa} onChange={(e) => setEditClase({ ...editClase, activa: e.target.checked })} /> Clase activa</label>
            <div className="acciones">
              <button>Guardar</button>
              {editClase.id && <button type="button" className="btn-sec" onClick={() => borrarClase(editClase)}>Eliminar</button>}
            </div>
          </form>
        </Modal>
      )}

      {editDojo && (
        <Modal titulo={editDojo.id ? 'Editar dojo' : 'Nuevo dojo'} onClose={() => setEditDojo(null)}>
          <form className="form" onSubmit={guardarDojo}>
            <Campo label="Nombre"><input required value={editDojo.nombre} onChange={(e) => setEditDojo({ ...editDojo, nombre: e.target.value })} /></Campo>
            <Campo label="Dirección"><input value={editDojo.direccion || ''} onChange={(e) => setEditDojo({ ...editDojo, direccion: e.target.value })} /></Campo>
            <Campo label="Teléfono"><input value={editDojo.telefono || ''} onChange={(e) => setEditDojo({ ...editDojo, telefono: e.target.value })} /></Campo>
            <label><input type="checkbox" style={{ width: 'auto' }} checked={editDojo.activo} onChange={(e) => setEditDojo({ ...editDojo, activo: e.target.checked })} /> Activo</label>
            <button>Guardar</button>
          </form>
        </Modal>
      )}
    </>
  )
}
