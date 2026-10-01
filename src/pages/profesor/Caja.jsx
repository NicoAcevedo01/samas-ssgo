import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useDatos } from '../../lib/useDatos'
import { MEDIOS, fmtFecha, fmtPeriodo, fmtPlata, mesSiguiente, primerDiaMes } from '../../lib/utils'
import { Cabecera, Cargando, Kpi, Vacio } from '../../components/ui'

export default function Caja() {
  const { perfil } = useAuth()
  const [mes, setMes] = useState(primerDiaMes().slice(0, 7))
  const desde = mes + '-01'

  const { datos, cargando } = useDatos(async () => {
    const [p, l] = await Promise.all([
      supabase.from('pagos').select('*, alumnos(nombre, apellido), inscripciones(disciplinas(nombre))')
        .eq('cobrado_por', perfil.profesor_id).eq('anulado', false)
        .gte('fecha_pago', desde).lt('fecha_pago', mesSiguiente(desde)).order('fecha_pago', { ascending: false }),
      supabase.from('liquidaciones').select('*').eq('periodo', desde).maybeSingle(),
    ])
    return { data: { pagos: p.data || [], liq: l.data } }
  }, [desde])

  if (cargando) return <Cargando />
  const { pagos, liq } = datos
  const total = pagos.reduce((s, p) => s + Number(p.monto), 0)
  const efectivo = pagos.filter((p) => p.medio === 'efectivo').reduce((s, p) => s + Number(p.monto), 0)

  return (
    <>
      <Cabecera titulo="Mi caja" />
      <div className="filtros"><input type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></div>
      <div className="grilla">
        <Kpi titulo="Total cobrado" valor={fmtPlata(total)} cls="ok" />
        <Kpi titulo="En efectivo" valor={fmtPlata(efectivo)} />
        <Kpi titulo="Pagos" valor={pagos.length} />
        {liq && <Kpi titulo={`Mi parte (${liq.porcentaje}%)`} valor={fmtPlata(liq.monto_profesor)} cls="warn" />}
      </div>
      {!pagos.length ? <Vacio>No cobraste pagos este mes.</Vacio> : (
        <div className="tarjeta">
          <ul className="lista">
            {pagos.map((p) => (
              <li key={p.id}>
                <span>{p.alumnos?.apellido}, {p.alumnos?.nombre}
                  <div className="sub">{p.inscripciones?.disciplinas?.nombre} · {fmtPeriodo(p.periodo)} · {fmtFecha(p.fecha_pago)} · {MEDIOS[p.medio]}</div>
                </span>
                <b>{fmtPlata(p.monto)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
