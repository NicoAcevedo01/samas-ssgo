import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useDatos } from '../../lib/useDatos'
import { fmtFecha, fmtPlata, primerDiaMes, mesSiguiente } from '../../lib/utils'
import { Cabecera, Cargando, Kpi, BadgeCuota, Vacio } from '../../components/ui'

export default function Dashboard() {
  const [msg, setMsg] = useState('')
  const desde = primerDiaMes(), hasta = mesSiguiente(desde)

  const { datos, cargando } = useDatos(async () => {
    const [dojos, alumnos, pagos, cuotas, pend, cumples] = await Promise.all([
      supabase.from('dojos').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('alumnos').select('id, dojo_id').eq('activo', true),
      supabase.from('pagos').select('monto, inscripciones(dojo_id)').eq('anulado', false).gte('fecha_pago', desde).lt('fecha_pago', hasta),
      supabase.from('v_estado_cuotas').select('*'),
      supabase.from('pendientes').select('id', { count: 'exact', head: true }).neq('estado', 'resuelto'),
      supabase.from('v_cumpleanos').select('*').order('cumple_este_anio'),
    ])
    return { data: { dojos: dojos.data || [], alumnos: alumnos.data || [], pagos: pagos.data || [], cuotas: cuotas.data || [], pendientes: pend.count || 0, cumples: cumples.data || [] } }
  }, [])

  async function revisarAptos() {
    const { data, error } = await supabase.rpc('generar_pendientes_documentos')
    setMsg(error ? error.message : `Se generaron ${data} pendientes nuevos por apto médico.`)
  }

  if (cargando) return <Cargando />
  const { dojos, alumnos, pagos, cuotas, pendientes, cumples } = datos
  const total = pagos.reduce((s, p) => s + Number(p.monto), 0)
  const vencidas = cuotas.filter((c) => c.estado === 'vencido')
  const enPeriodo = cuotas.filter((c) => c.estado === 'en_periodo')

  return (
    <>
      <Cabecera titulo="Panel general">
        <button className="btn-sec" onClick={revisarAptos}>Revisar aptos médicos</button>
      </Cabecera>
      {msg && <div className="exito">{msg}</div>}

      <div className="grilla">
        <Kpi titulo="Alumnos activos" valor={alumnos.length} />
        <Kpi titulo="Ingresos del mes" valor={fmtPlata(total)} cls="ok" />
        <Kpi titulo="Cuotas vencidas" valor={vencidas.length} cls={vencidas.length ? 'bad' : ''} />
        <Kpi titulo="En período de pago" valor={enPeriodo.length} cls="warn" />
        <Kpi titulo="Pendientes abiertos" valor={pendientes} />
      </div>

      <div className="tarjeta">
        <h3>Por dojo</h3>
        <div className="tabla-wrap">
          <table>
            <thead><tr><th>Dojo</th><th>Alumnos</th><th>Ingresos del mes</th><th>Vencidas</th></tr></thead>
            <tbody>
              {dojos.map((d) => (
                <tr key={d.id}>
                  <td>{d.nombre}</td>
                  <td>{alumnos.filter((a) => a.dojo_id === d.id).length}</td>
                  <td>{fmtPlata(pagos.filter((p) => p.inscripciones?.dojo_id === d.id).reduce((s, p) => s + Number(p.monto), 0))}</td>
                  <td>{vencidas.filter((c) => c.dojo_id === d.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tarjeta">
        <h3>🎂 Cumpleaños de los próximos 7 días</h3>
        {!cumples.length ? <Vacio>Nadie cumple años esta semana.</Vacio> : (
          <ul className="lista">
            {cumples.map((c) => (
              <li key={c.id}>
                <span>{c.apellido}, {c.nombre}<div className="sub">{fmtFecha(c.cumple_este_anio)}</div></span>
                {c.telefono && (
                  <a className="btn btn-chico" target="_blank" rel="noreferrer"
                    href={`https://wa.me/${c.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`¡Feliz cumpleaños ${c.nombre}! 🥋 Te saluda todo el equipo de SAMAS.`)}`}>
                    Saludar
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="tarjeta">
        <h3>Cuotas vencidas</h3>
        {!vencidas.length ? <Vacio>No hay cuotas vencidas. 👏</Vacio> : (
          <ul className="lista">
            {vencidas.slice(0, 15).map((c) => (
              <li key={c.inscripcion_id}>
                <span>{c.apellido}, {c.nombre}<div className="sub">{c.disciplina} · venció {fmtFecha(c.vence_el)}</div></span>
                <BadgeCuota estado={c.estado} />
              </li>
            ))}
          </ul>
        )}
        {vencidas.length > 15 && <Link to="/admin/alumnos">Ver todos</Link>}
      </div>
    </>
  )
}
