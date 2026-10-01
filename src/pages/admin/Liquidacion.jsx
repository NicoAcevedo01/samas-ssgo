import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDatos } from '../../lib/useDatos'
import { fmtPlata, msgError, primerDiaMes } from '../../lib/utils'
import { Badge, Cabecera, Cargando, ErrorBox, Kpi, Vacio } from '../../components/ui'

const ESTADOS = { borrador: ['Borrador', 'warn'], cerrada: ['Cerrada', ''], pagada: ['Pagada', 'ok'] }

export default function Liquidacion() {
  const [mes, setMes] = useState(primerDiaMes().slice(0, 7))
  const periodo = mes + '-01'

  const { datos, error, cargando, recargar } = useDatos(
    () => supabase.from('liquidaciones').select('*, profesores(nombre, apellido)').eq('periodo', periodo).order('total_recaudado', { ascending: false }),
    [periodo])

  async function calcular() {
    const { error } = await supabase.rpc('calcular_liquidacion', { p_periodo: periodo })
    if (error) alert(msgError(error)); else recargar()
  }
  async function cambiarEstado(l, estado) {
    if (estado === 'cerrada' && !confirm('Al cerrar, esta liquidación ya no se recalcula. ¿Continuar?')) return
    const { error } = await supabase.from('liquidaciones').update({ estado }).eq('id', l.id)
    if (error) alert(msgError(error)); else recargar()
  }

  const filas = datos || []
  const sum = (k) => filas.reduce((s, l) => s + Number(l[k]), 0)

  return (
    <>
      <Cabecera titulo="Caja y liquidación">
        <button onClick={calcular}>Calcular / actualizar</button>
      </Cabecera>
      <p style={{ marginTop: 0, color: 'var(--gris)', fontSize: '.9rem' }}>
        Toma lo que cobró cada profesor en el mes y aplica su porcentaje (se edita en Profesores).
        Lo cobrado directamente por la administración no entra en la liquidación.
      </p>
      <div className="filtros"><input type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></div>

      <div className="grilla">
        <Kpi titulo="Recaudado por profesores" valor={fmtPlata(sum('total_recaudado'))} />
        <Kpi titulo="A pagar a profesores" valor={fmtPlata(sum('monto_profesor'))} cls="warn" />
        <Kpi titulo="Queda para el dojo" valor={fmtPlata(sum('monto_dojo'))} cls="ok" />
      </div>

      <ErrorBox error={error} />
      {cargando ? <Cargando /> : !filas.length ? <Vacio>Todavía no se calculó este mes. Tocá “Calcular”.</Vacio> : (
        <div className="tarjeta tabla-wrap">
          <table>
            <thead><tr><th>Profesor</th><th>Recaudó</th><th>%</th><th>Le corresponde</th><th>Para el dojo</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {filas.map((l) => (
                <tr key={l.id}>
                  <td>{l.profesores?.apellido}, {l.profesores?.nombre}</td>
                  <td>{fmtPlata(l.total_recaudado)}</td>
                  <td>{l.porcentaje}%</td>
                  <td><b>{fmtPlata(l.monto_profesor)}</b></td>
                  <td>{fmtPlata(l.monto_dojo)}</td>
                  <td><Badge cls={ESTADOS[l.estado][1]}>{ESTADOS[l.estado][0]}</Badge></td>
                  <td>
                    {l.estado === 'borrador' && <button className="btn-chico btn-sec" onClick={() => cambiarEstado(l, 'cerrada')}>Cerrar</button>}
                    {l.estado === 'cerrada' && <button className="btn-chico" onClick={() => cambiarEstado(l, 'pagada')}>Marcar pagada</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
