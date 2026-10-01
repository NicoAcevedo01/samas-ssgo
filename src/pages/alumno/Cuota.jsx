import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useDatos } from '../../lib/useDatos'
import { CICLOS, MEDIOS, fmtFecha, fmtPeriodo, fmtPlata } from '../../lib/utils'
import { BadgeCuota, Cabecera, Cargando, Vacio } from '../../components/ui'

export default function Cuota() {
  const { perfil } = useAuth()
  const { datos, cargando } = useDatos(async () => {
    const [c, p, a] = await Promise.all([
      supabase.from('v_estado_cuotas').select('*').eq('alumno_id', perfil.alumno_id),
      supabase.from('pagos').select('*, inscripciones(disciplinas(nombre))').eq('alumno_id', perfil.alumno_id).eq('anulado', false).order('periodo', { ascending: false }).limit(12),
      supabase.from('alumnos').select('ciclo_pago').eq('id', perfil.alumno_id).single(),
    ])
    return { data: { cuotas: c.data || [], pagos: p.data || [], ciclo: a.data?.ciclo_pago } }
  }, [])

  if (cargando) return <Cargando />
  return (
    <>
      <Cabecera titulo="Mi cuota" />
      {datos.ciclo && <p style={{ marginTop: 0, color: 'var(--gris)' }}>Tu fecha de pago: <b>{CICLOS[datos.ciclo]}</b></p>}
      <div className="tarjeta">
        {!datos.cuotas.length ? <Vacio>No tenés disciplinas activas.</Vacio> : (
          <ul className="lista">
            {datos.cuotas.map((c) => (
              <li key={c.inscripcion_id}>
                <span><b>{c.disciplina}</b><div className="sub">{fmtPlata(c.monto_a_cobrar)} · vence {fmtFecha(c.vence_el)}</div></span>
                <BadgeCuota estado={c.estado} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="tarjeta">
        <h3>Últimos pagos</h3>
        {!datos.pagos.length ? <Vacio>Sin pagos registrados.</Vacio> : (
          <ul className="lista">
            {datos.pagos.map((p) => (
              <li key={p.id}>
                <span>{p.inscripciones?.disciplinas?.nombre} · {fmtPeriodo(p.periodo)}<div className="sub">{fmtFecha(p.fecha_pago)} · {MEDIOS[p.medio]}</div></span>
                <b>{fmtPlata(p.monto)}</b>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
