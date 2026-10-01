import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useDatos } from '../lib/useDatos'
import { CICLOS, MEDIOS, edad, fmtFecha, fmtPeriodo, fmtPlata, hoyISO, msgError } from '../lib/utils'
import { Badge, BadgeCuota, Cabecera, Campo, Cargando, ErrorBox, Modal, Vacio } from '../components/ui'
import DocumentosAlumno from '../components/DocumentosAlumno'

const PRIORIDAD = { vencido: 3, en_periodo: 2, al_dia: 1 }

// Pantalla compartida: el admin ve todos los alumnos; el profesor solo los de sus clases (RLS).
export default function Alumnos() {
  const { perfil } = useAuth()
  const [buscar, setBuscar] = useState('')
  const [dojo, setDojo] = useState('')
  const [estado, setEstado] = useState('')
  const [inactivos, setInactivos] = useState(false)
  const [ficha, setFicha] = useState(null) // alumno abierto (o {} para nuevo)

  const { datos, error, cargando, recargar } = useDatos(async () => {
    const [a, c, d] = await Promise.all([
      supabase.from('alumnos').select('*, inscripciones(id, activa, disciplinas(nombre))').order('apellido'),
      supabase.from('v_estado_cuotas').select('alumno_id, estado'),
      supabase.from('dojos').select('id, nombre').order('nombre'),
    ])
    const peor = {}
    ;(c.data || []).forEach((x) => { if (!peor[x.alumno_id] || PRIORIDAD[x.estado] > PRIORIDAD[peor[x.alumno_id]]) peor[x.alumno_id] = x.estado })
    return { data: { alumnos: a.data || [], peor, dojos: d.data || [] }, error: a.error }
  }, [])

  if (cargando) return <Cargando />
  const { alumnos, peor, dojos } = datos
  const t = buscar.toLowerCase()
  const lista = alumnos.filter((a) =>
    (inactivos || a.activo) && (!dojo || a.dojo_id === dojo) && (!estado || peor[a.id] === estado) &&
    (!t || `${a.nombre} ${a.apellido} ${a.dni} ${a.usuario || ''}`.toLowerCase().includes(t)))

  return (
    <>
      <Cabecera titulo={perfil.rol === 'admin' ? 'Alumnos' : 'Mis alumnos'}>
        <button onClick={() => setFicha({})}>+ Alumno</button>
      </Cabecera>
      <div className="filtros">
        <input placeholder="Buscar por nombre, DNI o usuario…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <select value={dojo} onChange={(e) => setDojo(e.target.value)}>
          <option value="">Todos los dojos</option>
          {dojos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Cualquier estado de cuota</option>
          <option value="vencido">Vencidos</option>
          <option value="en_periodo">En período de pago</option>
          <option value="al_dia">Al día</option>
        </select>
        <label style={{ flex: '0 0 auto', alignSelf: 'center' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} /> Inactivos
        </label>
      </div>
      <p style={{ margin: '0 0 .5rem', color: 'var(--gris)', fontSize: '.85rem' }}>{lista.length} alumnos</p>

      <ErrorBox error={error} />
      {!lista.length ? <Vacio>No hay alumnos para mostrar.</Vacio> : (
        <div className="tarjeta">
          <ul className="lista">
            {lista.map((a) => (
              <li key={a.id} className="fila-click" onClick={() => setFicha(a)}>
                <span><b>{a.apellido}, {a.nombre}</b>
                  <div className="sub">
                    {a.inscripciones.filter((i) => i.activa).map((i) => i.disciplinas?.nombre).join(' · ') || 'Sin disciplinas'}
                    {' · '}{dojos.find((d) => d.id === a.dojo_id)?.nombre}
                  </div>
                </span>
                <span className="acciones">
                  {!a.activo && <Badge>Inactivo</Badge>}
                  {!a.perfil_id && a.activo && <Badge>Sin cuenta</Badge>}
                  {peor[a.id] && <BadgeCuota estado={peor[a.id]} />}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ficha && <FichaAlumno alumno={ficha} dojos={dojos} onClose={() => setFicha(null)} onCambio={recargar} />}
    </>
  )
}

const VACIO = {
  nombre: '', apellido: '', dni: '', fecha_nacimiento: '', telefono: '', email: '', direccion: '', usuario: '',
  emergencia_nombre: '', emergencia_telefono: '', tutor_nombre: '', tutor_dni: '', tutor_telefono: '', tutor_vinculo: '',
  dojo_id: '', ciclo_pago: 'inicio_mes', descuento_pct: 0, observaciones: '', activo: true,
}

function FichaAlumno({ alumno, dojos, onClose, onCambio }) {
  const [actual, setActual] = useState(alumno.id ? alumno : null)
  const [tab, setTab] = useState('datos')
  const titulo = actual ? `${actual.apellido}, ${actual.nombre}` : 'Nuevo alumno'

  return (
    <Modal titulo={titulo} onClose={onClose}>
      {actual && (
        <div className="tabs">
          {[['datos', 'Datos'], ['disc', 'Disciplinas'], ['pagos', 'Pagos'], ['docs', 'Documentos']].map(([k, v]) => (
            <button key={k} className={tab === k ? 'activo' : ''} onClick={() => setTab(k)}>{v}</button>
          ))}
        </div>
      )}
      {tab === 'datos' && (
        <DatosAlumno alumno={actual} dojos={dojos}
          onGuardado={(a, nuevo) => { setActual(a); onCambio(); if (nuevo) setTab('disc') }} />
      )}
      {tab === 'disc' && actual && <Inscripciones alumno={actual} onCambio={onCambio} />}
      {tab === 'pagos' && actual && <PagosAlumno alumno={actual} />}
      {tab === 'docs' && actual && <DocumentosAlumno alumnoId={actual.id} />}
    </Modal>
  )
}

function DatosAlumno({ alumno, dojos, onGuardado }) {
  const { perfil } = useAuth()
  const limpio = (a) => Object.fromEntries(Object.keys(VACIO).map((k) => [k, a?.[k] ?? VACIO[k]]))
  const [f, setF] = useState(limpio(alumno || { dojo_id: dojos[0]?.id }))
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const años = edad(f.fecha_nacimiento)
  const menor = años !== null && años < 18

  async function guardar(e) {
    e.preventDefault()
    const fila = { ...f }
    Object.keys(fila).forEach((k) => { if (fila[k] === '') fila[k] = null })
    fila.dni = f.dni.replace(/\./g, '').trim()
    fila.usuario = f.usuario ? f.usuario.trim().toLowerCase() : null
    fila.descuento_pct = Number(f.descuento_pct || 0)
    setGuardando(true)
    const r = alumno?.id
      ? await supabase.from('alumnos').update(fila).eq('id', alumno.id).select().single()
      : await supabase.from('alumnos').insert(fila).select().single()
    setGuardando(false)
    if (r.error) return alert(msgError(r.error))
    onGuardado(r.data, !alumno?.id)
  }

  return (
    <form className="form" onSubmit={guardar}>
      <fieldset className="form-2">
        <legend>Datos personales</legend>
        <Campo label="Nombre"><input required value={f.nombre} onChange={set('nombre')} /></Campo>
        <Campo label="Apellido"><input required value={f.apellido} onChange={set('apellido')} /></Campo>
        <Campo label="DNI"><input required inputMode="numeric" value={f.dni} onChange={set('dni')} /></Campo>
        <Campo label="Fecha de nacimiento" ayuda={años !== null ? `${años} años` : null}>
          <input type="date" value={f.fecha_nacimiento || ''} onChange={set('fecha_nacimiento')} />
        </Campo>
        <Campo label="Teléfono"><input type="tel" value={f.telefono || ''} onChange={set('telefono')} /></Campo>
        <Campo label="Email"><input type="email" value={f.email || ''} onChange={set('email')} /></Campo>
        <Campo label="Dirección"><input value={f.direccion || ''} onChange={set('direccion')} /></Campo>
        <Campo label="Usuario para la app" ayuda="Con esto + DNI el alumno crea su cuenta">
          <input autoCapitalize="none" value={f.usuario || ''} onChange={set('usuario')} />
        </Campo>
      </fieldset>

      <fieldset className="form-2">
        <legend>Contacto de emergencia</legend>
        <Campo label="Nombre"><input value={f.emergencia_nombre || ''} onChange={set('emergencia_nombre')} /></Campo>
        <Campo label="Teléfono"><input type="tel" value={f.emergencia_telefono || ''} onChange={set('emergencia_telefono')} /></Campo>
      </fieldset>

      {menor && (
        <fieldset className="form-2">
          <legend>Padre, madre o tutor (obligatorio: es menor)</legend>
          <Campo label="Nombre y apellido"><input required value={f.tutor_nombre || ''} onChange={set('tutor_nombre')} /></Campo>
          <Campo label="DNI"><input required inputMode="numeric" value={f.tutor_dni || ''} onChange={set('tutor_dni')} /></Campo>
          <Campo label="Teléfono"><input required type="tel" value={f.tutor_telefono || ''} onChange={set('tutor_telefono')} /></Campo>
          <Campo label="Vínculo"><input placeholder="Madre, padre, tutor…" value={f.tutor_vinculo || ''} onChange={set('tutor_vinculo')} /></Campo>
        </fieldset>
      )}

      <fieldset className="form-2">
        <legend>Cuota</legend>
        <Campo label="Dojo principal">
          <select required value={f.dojo_id} onChange={set('dojo_id')}>
            <option value="">Elegir…</option>
            {dojos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Ciclo de pago">
          <select value={f.ciclo_pago} onChange={set('ciclo_pago')}>
            {Object.entries(CICLOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo label="Descuento %" ayuda="Ej.: por más de una matrícula">
          <input type="number" min="0" max="100" step="0.5" value={f.descuento_pct} onChange={set('descuento_pct')} />
        </Campo>
      </fieldset>

      <Campo label="Observaciones"><textarea rows="2" value={f.observaciones || ''} onChange={set('observaciones')} /></Campo>
      {(perfil.rol === 'admin' || alumno?.id) && (
        <label><input type="checkbox" style={{ width: 'auto' }} checked={f.activo} onChange={set('activo')} /> Alumno activo</label>
      )}
      <button disabled={guardando}>{guardando ? 'Guardando…' : alumno?.id ? 'Guardar cambios' : 'Crear alumno'}</button>
    </form>
  )
}

function Inscripciones({ alumno, onCambio }) {
  const { perfil } = useAuth()
  const [sel, setSel] = useState('')

  const { datos, cargando, recargar } = useDatos(async () => {
    // Opciones: el admin puede inscribir en cualquier dojo/disciplina; el profe solo en las que dicta
    let opciones = []
    if (perfil.rol === 'admin') {
      const [d, di] = await Promise.all([
        supabase.from('dojos').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('disciplinas').select('id, nombre').eq('activa', true).order('nombre'),
      ])
      ;(d.data || []).forEach((dj) => (di.data || []).forEach((ds) =>
        opciones.push({ key: `${dj.id}|${ds.id}`, txt: `${ds.nombre} · ${dj.nombre}` })))
    } else {
      const { data } = await supabase.from('clases').select('dojo_id, disciplina_id, dojos(nombre), disciplinas(nombre)').eq('profesor_id', perfil.profesor_id)
      const vistos = new Set()
      ;(data || []).forEach((c) => {
        const key = `${c.dojo_id}|${c.disciplina_id}`
        if (!vistos.has(key)) { vistos.add(key); opciones.push({ key, txt: `${c.disciplinas.nombre} · ${c.dojos.nombre}` }) }
      })
    }
    const ins = await supabase.from('inscripciones').select('*, disciplinas(nombre), dojos(nombre)')
      .eq('alumno_id', alumno.id).eq('activa', true)
    return { data: { opciones, ins: ins.data || [] } }
  }, [alumno.id])

  async function agregar() {
    if (!sel) return
    const [dojo_id, disciplina_id] = sel.split('|')
    const { error } = await supabase.from('inscripciones').insert({ alumno_id: alumno.id, dojo_id, disciplina_id })
    if (error) return alert(msgError(error))
    setSel(''); recargar(); onCambio()
  }

  async function baja(i) {
    if (!confirm(`¿Dar de baja ${i.disciplinas.nombre}? Deja de generar cuota.`)) return
    const { error } = await supabase.from('inscripciones').update({ activa: false, fecha_baja: hoyISO() }).eq('id', i.id)
    if (error) return alert(msgError(error))
    recargar(); onCambio()
  }

  if (cargando) return <Cargando />
  const libres = datos.opciones.filter((o) => !datos.ins.some((i) => `${i.dojo_id}|${i.disciplina_id}` === o.key))

  return (
    <>
      <p style={{ marginTop: 0, color: 'var(--gris)', fontSize: '.85rem' }}>Cada disciplina activa genera una cuota mensual.</p>
      {!datos.ins.length ? <Vacio>Todavía no está inscripto en ninguna disciplina.</Vacio> : (
        <ul className="lista">
          {datos.ins.map((i) => (
            <li key={i.id}>
              <span><b>{i.disciplinas.nombre}</b><div className="sub">{i.dojos.nombre} · desde {fmtFecha(i.fecha_alta)}</div></span>
              <button className="btn-chico btn-sec" onClick={() => baja(i)}>Dar de baja</button>
            </li>
          ))}
        </ul>
      )}
      <div className="filtros" style={{ marginTop: '.8rem' }}>
        <select value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">Agregar disciplina…</option>
          {libres.map((o) => <option key={o.key} value={o.key}>{o.txt}</option>)}
        </select>
        <button style={{ flex: '0 0 auto' }} onClick={agregar} disabled={!sel}>Inscribir</button>
      </div>
      {perfil.rol !== 'admin' && !datos.opciones.length && (
        <div className="error">No tenés clases asignadas. Pedile al administrador que te asigne una.</div>
      )}
    </>
  )
}

function PagosAlumno({ alumno }) {
  const { perfil } = useAuth()
  const { datos, cargando } = useDatos(async () => {
    const [c, p] = await Promise.all([
      supabase.from('v_estado_cuotas').select('*').eq('alumno_id', alumno.id),
      supabase.from('pagos').select('*, inscripciones(disciplinas(nombre))').eq('alumno_id', alumno.id).eq('anulado', false).order('periodo', { ascending: false }).limit(24),
    ])
    return { data: { cuotas: c.data || [], pagos: p.data || [] } }
  }, [alumno.id])

  if (cargando) return <Cargando />
  const rutaCobrar = `${perfil.rol === 'admin' ? '/admin' : '/profe'}/cobrar?alumno=${alumno.id}`

  return (
    <>
      <ul className="lista">
        {datos.cuotas.map((c) => (
          <li key={c.inscripcion_id}>
            <span><b>{c.disciplina}</b><div className="sub">{fmtPlata(c.monto_a_cobrar)} · vence {fmtFecha(c.vence_el)}</div></span>
            <BadgeCuota estado={c.estado} />
          </li>
        ))}
      </ul>
      <Link className="btn" style={{ display: 'inline-block', margin: '.8rem 0', textDecoration: 'none' }} to={rutaCobrar}>Cobrar cuota</Link>
      <h3 style={{ margin: '.5rem 0' }}>Historial</h3>
      {!datos.pagos.length ? <Vacio>Sin pagos registrados.</Vacio> : (
        <ul className="lista">
          {datos.pagos.map((p) => (
            <li key={p.id}>
              <span>{p.inscripciones?.disciplinas?.nombre} · {fmtPeriodo(p.periodo)}
                <div className="sub">{fmtFecha(p.fecha_pago)} · {MEDIOS[p.medio]}</div>
              </span>
              <b>{fmtPlata(p.monto)}</b>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
