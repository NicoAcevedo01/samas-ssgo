import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDatos } from '../../lib/useDatos'
import { fmtFecha, fmtPlata, hoyISO, msgError } from '../../lib/utils'
import { Cabecera, Campo, Cargando, Modal } from '../../components/ui'

export default function Precios() {
  const [edit, setEdit] = useState(null)
  const [verHist, setVerHist] = useState(false)

  const { datos, cargando, recargar } = useDatos(async () => {
    const [di, d, p] = await Promise.all([
      supabase.from('disciplinas').select('*').eq('activa', true).order('nombre'),
      supabase.from('dojos').select('id, nombre').order('nombre'),
      supabase.from('precios_disciplina').select('*').order('vigente_desde', { ascending: false }),
    ])
    return { data: { disciplinas: di.data || [], dojos: d.data || [], precios: p.data || [] } }
  }, [])

  async function guardar(e) {
    e.preventDefault()
    const { error } = await supabase.from('precios_disciplina').upsert({
      disciplina_id: edit.disciplina_id, dojo_id: edit.dojo_id || null,
      monto: Number(edit.monto), vigente_desde: edit.vigente_desde,
    }, { onConflict: 'dojo_id,disciplina_id,vigente_desde' })
    if (error) return alert(msgError(error))
    setEdit(null); recargar()
  }

  if (cargando) return <Cargando />
  const { disciplinas, dojos, precios } = datos
  const hoy = hoyISO()
  const vigente = (discId, dojoId) =>
    precios.find((p) => p.disciplina_id === discId && (p.dojo_id || null) === (dojoId || null) && p.vigente_desde <= hoy)
  const nombreDojo = (id) => dojos.find((d) => d.id === id)?.nombre || 'General'
  const nombreDisc = (id) => disciplinas.find((d) => d.id === id)?.nombre || '—'

  return (
    <>
      <Cabecera titulo="Precios por disciplina">
        <button className="btn-sec" onClick={() => setVerHist(!verHist)}>{verHist ? 'Ocultar' : 'Ver'} historial</button>
      </Cabecera>
      <p style={{ marginTop: 0, color: 'var(--gris)', fontSize: '.9rem' }}>
        El precio general vale para todos los dojos. Si un dojo cobra distinto, cargale un precio especial: tiene prioridad.
        Cada cambio guarda historial, así los pagos anteriores no se modifican.
      </p>

      <div className="tarjeta tabla-wrap">
        <table>
          <thead><tr><th>Disciplina</th><th>Precio general</th><th>Precios especiales</th><th></th></tr></thead>
          <tbody>
            {disciplinas.map((d) => {
              const g = vigente(d.id, null)
              const esp = dojos.map((dj) => ({ dj, p: vigente(d.id, dj.id) })).filter((x) => x.p)
              return (
                <tr key={d.id}>
                  <td><b>{d.nombre}</b></td>
                  <td>{g ? fmtPlata(g.monto) : <span style={{ color: 'var(--bad)' }}>Sin precio</span>}</td>
                  <td>{esp.length ? esp.map((x) => `${x.dj.nombre}: ${fmtPlata(x.p.monto)}`).join(' · ') : '—'}</td>
                  <td><button className="btn-chico" onClick={() => setEdit({ disciplina_id: d.id, dojo_id: '', monto: g?.monto || '', vigente_desde: hoy })}>Cambiar</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {verHist && (
        <div className="tarjeta tabla-wrap">
          <h3>Historial</h3>
          <table>
            <thead><tr><th>Desde</th><th>Disciplina</th><th>Dojo</th><th>Monto</th></tr></thead>
            <tbody>
              {precios.map((p) => (
                <tr key={p.id}><td>{fmtFecha(p.vigente_desde)}</td><td>{nombreDisc(p.disciplina_id)}</td><td>{nombreDojo(p.dojo_id)}</td><td>{fmtPlata(p.monto)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <Modal titulo={`Precio · ${nombreDisc(edit.disciplina_id)}`} onClose={() => setEdit(null)}>
          <form className="form" onSubmit={guardar}>
            <Campo label="Aplica a">
              <select value={edit.dojo_id} onChange={(e) => setEdit({ ...edit, dojo_id: e.target.value })}>
                <option value="">General (todos los dojos)</option>
                {dojos.map((d) => <option key={d.id} value={d.id}>Solo {d.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Monto mensual"><input type="number" min="0" required value={edit.monto} onChange={(e) => setEdit({ ...edit, monto: e.target.value })} /></Campo>
            <Campo label="Vigente desde"><input type="date" required value={edit.vigente_desde} onChange={(e) => setEdit({ ...edit, vigente_desde: e.target.value })} /></Campo>
            <button>Guardar</button>
          </form>
        </Modal>
      )}
    </>
  )
}
