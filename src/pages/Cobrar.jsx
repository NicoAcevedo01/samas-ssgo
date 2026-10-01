import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useDatos } from '../lib/useDatos'
import { MEDIOS, fmtFecha, fmtPeriodo, fmtPlata, hoyISO, mesSiguiente, msgError } from '../lib/utils'
import { BadgeCuota, Cabecera, Campo, Cargando, ErrorBox, Modal, Vacio } from '../components/ui'

// Registro de pago manual. Lo usan profesores (queda a su nombre) y el admin.
export default function Cobrar() {
  const { perfil } = useAuth()
  const esAdmin = perfil.rol === 'admin'
  const [params] = useSearchParams()
  const [buscar, setBuscar] = useState('')
  const [soloDeuda, setSoloDeuda] = useState(!params.get('alumno'))
  const [form, setForm] = useState(null)
  const [ok, setOk] = useState('')

  const { datos, error, cargando, recargar } = useDatos(async () => {
    const [c, p] = await Promise.all([
      supabase.from('v_estado_cuotas').select('*').order('apellido'),
      esAdmin ? supabase.from('profesores').select('id, nombre, apellido').eq('activo', true).order('apellido') : { data: [] },
    ])
    return { data: { cuotas: c.data || [], profes: p.data || [] }, error: c.error }
  }, [])

  function abrir(c) {
    const periodo = c.estado === 'al_dia' ? mesSiguiente(c.periodo_actual) : c.periodo_actual
    setForm({ cuota: c, periodo: periodo.slice(0, 7), monto: c.monto_a_cobrar, medio: 'efectivo', fecha_pago: hoyISO(), cobrado_por: '' })
  }

  async function guardar(e) {
    e.preventDefault()
    const c = form.cuota
    const { data: lista } = await supabase.rpc('precio_vigente', { p_dojo: c.dojo_id, p_disciplina: c.disciplina_id })
    const { error } = await supabase.from('pagos').insert({
      alumno_id: c.alumno_id, inscripcion_id: c.inscripcion_id,
      periodo: form.periodo + '-01', fecha_pago: form.fecha_pago,
      monto_lista: lista ?? form.monto, descuento_pct: c.descuento_pct, monto: Number(form.monto),
      medio: form.medio,
      cobrado_por: esAdmin ? (form.cobrado_por || null) : perfil.profesor_id,
    })
    if (error) return alert(msgError(error))
    setOk(`Pago registrado: ${c.apellido}, ${c.nombre} · ${c.disciplina} · ${fmtPeriodo(form.periodo + '-01')}`)
    setForm(null); recargar()
  }

  if (cargando) return <Cargando />
  const filtroAlumno = params.get('alumno')
  const t = buscar.toLowerCase()
  const cuotas = datos.cuotas.filter((c) =>
    (!filtroAlumno || c.alumno_id === filtroAlumno) &&
    (!soloDeuda || c.estado !== 'al_dia') &&
    (!t || `${c.nombre} ${c.apellido} ${c.disciplina}`.toLowerCase().includes(t)))

  return (
    <>
      <Cabecera titulo="Cobrar cuota" />
      {ok && <div className="exito">{ok}</div>}
      <div className="filtros">
        <input placeholder="Buscar alumno o disciplina…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <label style={{ flex: '0 0 auto', alignSelf: 'center' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={soloDeuda} onChange={(e) => setSoloDeuda(e.target.checked)} /> Solo pendientes
        </label>
      </div>
      <ErrorBox error={error} />
      {!cuotas.length ? <Vacio>No hay cuotas para mostrar.</Vacio> : (
        <div className="tarjeta">
          <ul className="lista">
            {cuotas.map((c) => (
              <li key={c.inscripcion_id} className="fila-click" onClick={() => abrir(c)}>
                <span><b>{c.apellido}, {c.nombre}</b>
                  <div className="sub">{c.disciplina} · vence {fmtFecha(c.vence_el)} · {fmtPlata(c.monto_a_cobrar)}{Number(c.descuento_pct) > 0 ? ` (-${c.descuento_pct}%)` : ''}</div>
                </span>
                <BadgeCuota estado={c.estado} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {form && (
        <Modal titulo={`Cobrar · ${form.cuota.apellido}, ${form.cuota.nombre}`} onClose={() => setForm(null)}>
          <form className="form" onSubmit={guardar}>
            <p style={{ margin: 0 }}><b>{form.cuota.disciplina}</b> · último pago: {fmtFecha(form.cuota.ultimo_pago)}</p>
            <div className="form-2">
              <Campo label="Mes que paga"><input type="month" required value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} /></Campo>
              <Campo label="Monto" ayuda={Number(form.cuota.descuento_pct) > 0 ? `Incluye ${form.cuota.descuento_pct}% de descuento` : null}>
                <input type="number" min="0" required value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
              </Campo>
              <Campo label="Medio">
                <select value={form.medio} onChange={(e) => setForm({ ...form, medio: e.target.value })}>
                  {Object.entries(MEDIOS).filter(([k]) => k !== 'mercadopago').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
              <Campo label="Fecha de pago"><input type="date" required value={form.fecha_pago} onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })} /></Campo>
              {esAdmin && (
                <Campo label="Cobró" ayuda="Si cobró un profesor, suma a su liquidación">
                  <select value={form.cobrado_por} onChange={(e) => setForm({ ...form, cobrado_por: e.target.value })}>
                    <option value="">Administración</option>
                    {datos.profes.map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
                  </select>
                </Campo>
              )}
            </div>
            <button>Registrar pago</button>
          </form>
        </Modal>
      )}
    </>
  )
}
