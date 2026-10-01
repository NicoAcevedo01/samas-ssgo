import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useDatos } from '../../lib/useDatos'
import { fmtHora, isoLocal, msgError } from '../../lib/utils'
import { Badge, Cabecera, Cargando, Vacio } from '../../components/ui'
import { SelectorDia } from '../../components/ClasesDelDia'

export default function Reservar() {
  const { perfil } = useAuth()
  const [fecha, setFecha] = useState(isoLocal(new Date()))
  const [ocupado, setOcupado] = useState(false)
  const dia = (() => { const d = new Date(fecha + 'T12:00').getDay(); return d === 0 ? 7 : d })()

  const { datos, cargando, recargar } = useDatos(async () => {
    const ins = await supabase.from('inscripciones').select('dojo_id, disciplina_id').eq('alumno_id', perfil.alumno_id).eq('activa', true)
    const combos = new Set((ins.data || []).map((i) => `${i.dojo_id}|${i.disciplina_id}`))
    const [c, o, r] = await Promise.all([
      supabase.from('clases').select('*, dojos(nombre), disciplinas(nombre), profesores(nombre)').eq('dia_semana', dia).eq('activa', true).order('hora_inicio'),
      supabase.rpc('ocupacion_clases', { p_desde: fecha, p_hasta: fecha }),
      supabase.from('reservas').select('*').eq('alumno_id', perfil.alumno_id).eq('fecha', fecha),
    ])
    const clases = (c.data || []).filter((x) => combos.has(`${x.dojo_id}|${x.disciplina_id}`))
    const ocup = Object.fromEntries((o.data || []).map((x) => [x.clase_id, x.ocupados]))
    return { data: { clases, ocup, mias: r.data || [], sinInscripcion: combos.size === 0 } }
  }, [fecha, dia])

  async function reservar(c, mia) {
    setOcupado(true)
    const r = mia
      ? await supabase.from('reservas').update({ estado: 'confirmada' }).eq('id', mia.id)
      : await supabase.from('reservas').insert({ alumno_id: perfil.alumno_id, clase_id: c.id, fecha })
    setOcupado(false)
    if (r.error) alert(msgError(r.error)); else recargar()
  }
  async function cancelar(mia) {
    if (!confirm('¿Cancelar tu lugar en esta clase?')) return
    setOcupado(true)
    const { error } = await supabase.from('reservas').update({ estado: 'cancelada' }).eq('id', mia.id)
    setOcupado(false)
    if (error) alert(msgError(error)); else recargar()
  }

  return (
    <>
      <Cabecera titulo="Reservar clase" />
      <p style={{ marginTop: 0, color: 'var(--gris)', fontSize: '.9rem' }}>
        Reservar nos ayuda a no superar la capacidad del lugar. ¡Si no podés ir, cancelá así otro puede usar el lugar!
      </p>
      <SelectorDia fecha={fecha} onChange={setFecha} />
      {cargando ? <Cargando /> : datos.sinInscripcion ? <Vacio>Todavía no estás inscripto en ninguna disciplina. Consultá con tu profesor.</Vacio>
        : !datos.clases.length ? <Vacio>No tenés clases este día.</Vacio> : datos.clases.map((c) => {
          const n = datos.ocup[c.id] || 0
          const mia = datos.mias.find((r) => r.clase_id === c.id)
          const reservada = mia && mia.estado !== 'cancelada'
          const llena = n >= c.cupo
          const pct = Math.min(100, (n / c.cupo) * 100)
          return (
            <div className="tarjeta clase-card" key={c.id}>
              <div>
                <b>{fmtHora(c.hora_inicio)} · {c.disciplinas?.nombre}</b>
                <div style={{ fontSize: '.8rem', color: 'var(--gris)' }}>{c.dojos?.nombre}{c.profesores ? ` · Prof. ${c.profesores.nombre}` : ''}</div>
                <div className={`barra ${llena ? 'llena' : ''}`}><div style={{ width: pct + '%' }} /></div>
                <small style={{ color: 'var(--gris)' }}>{Math.max(0, c.cupo - n)} lugares libres</small>
              </div>
              <div>
                {reservada ? (
                  <div style={{ textAlign: 'right' }}>
                    <Badge cls="ok">Reservado</Badge><br />
                    <button className="btn-link" style={{ fontSize: '.8rem', marginTop: '.3rem' }} disabled={ocupado} onClick={() => cancelar(mia)}>Cancelar</button>
                  </div>
                ) : llena ? <Badge cls="bad">Completa</Badge>
                  : <button disabled={ocupado} onClick={() => reservar(c, mia)}>Reservar</button>}
              </div>
            </div>
          )
        })}
    </>
  )
}
