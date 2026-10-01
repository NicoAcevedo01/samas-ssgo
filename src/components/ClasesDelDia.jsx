import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useDatos } from '../lib/useDatos'
import { DIAS_CORTOS, fmtHora, hoyISO, isoLocal, msgError } from '../lib/utils'
import { Badge, Cargando, ErrorBox, Vacio } from './ui'

// Selector de los próximos 7 días
export function SelectorDia({ fecha, onChange }) {
  const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d })
  return (
    <div className="dias">
      {dias.map((d) => {
        const iso = isoLocal(d)
        return (
          <button key={iso} className={iso === fecha ? 'activo' : ''} onClick={() => onChange(iso)}>
            {iso === hoyISO() ? 'Hoy' : DIAS_CORTOS[d.getDay() === 0 ? 7 : d.getDay()]} {d.getDate()}
          </button>
        )
      })}
    </div>
  )
}

// Clases de una fecha con ocupación, lista de reservados y toma de asistencia.
// profesorId: si viene, filtra solo sus clases.
export default function ClasesDelDia({ profesorId }) {
  const [fecha, setFecha] = useState(hoyISO())
  const [abierta, setAbierta] = useState(null)
  const dia = (() => { const d = new Date(fecha + 'T12:00').getDay(); return d === 0 ? 7 : d })()

  const { datos, error, cargando, recargar } = useDatos(async () => {
    let q = supabase.from('clases')
      .select('id, hora_inicio, hora_fin, cupo, dojos(nombre), disciplinas(nombre), profesores(nombre, apellido), reservas(id, estado, fecha, alumnos(nombre, apellido))')
      .eq('dia_semana', dia).eq('activa', true).eq('reservas.fecha', fecha).order('hora_inicio')
    if (profesorId) q = q.eq('profesor_id', profesorId)
    return q
  }, [fecha, profesorId])

  async function marcar(reservaId, estado) {
    const { error } = await supabase.from('reservas').update({ estado }).eq('id', reservaId)
    if (error) alert(msgError(error)); else recargar()
  }

  return (
    <>
      <SelectorDia fecha={fecha} onChange={(f) => { setFecha(f); setAbierta(null) }} />
      <ErrorBox error={error} />
      {cargando ? <Cargando /> : !datos?.length ? <Vacio>No hay clases este día.</Vacio> : datos.map((c) => {
        const activas = c.reservas.filter((r) => r.estado !== 'cancelada')
        const pct = Math.min(100, (activas.length / c.cupo) * 100)
        return (
          <div className="tarjeta" key={c.id}>
            <div className="clase-card fila-click" onClick={() => setAbierta(abierta === c.id ? null : c.id)}>
              <div>
                <b>{fmtHora(c.hora_inicio)} – {fmtHora(c.hora_fin)} · {c.disciplinas?.nombre}</b>
                <div className="sub" style={{ fontSize: '.8rem', color: 'var(--gris)' }}>
                  {c.dojos?.nombre}{!profesorId && c.profesores ? ` · ${c.profesores.nombre} ${c.profesores.apellido}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b>{activas.length}/{c.cupo}</b>
                <div className={`barra ${pct >= 100 ? 'llena' : ''}`}><div style={{ width: pct + '%' }} /></div>
              </div>
            </div>
            {abierta === c.id && (
              activas.length === 0 ? <Vacio>Sin reservas.</Vacio> : (
                <ul className="lista" style={{ marginTop: '.6rem' }}>
                  {activas.map((r) => (
                    <li key={r.id}>
                      <span>{r.alumnos?.apellido}, {r.alumnos?.nombre}</span>
                      <span className="acciones">
                        {r.estado === 'confirmada' ? (
                          <>
                            <button className="btn-chico" onClick={() => marcar(r.id, 'asistio')}>Presente</button>
                            <button className="btn-chico btn-sec" onClick={() => marcar(r.id, 'ausente')}>Ausente</button>
                          </>
                        ) : (
                          <Badge cls={r.estado === 'asistio' ? 'ok' : 'bad'}>{r.estado === 'asistio' ? 'Presente' : 'Ausente'}</Badge>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        )
      })}
    </>
  )
}
