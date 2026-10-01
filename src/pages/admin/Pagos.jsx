import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useDatos } from '../../lib/useDatos'
import { MEDIOS, descargarCSV, fmtFecha, fmtPeriodo, fmtPlata, mesSiguiente, msgError, primerDiaMes } from '../../lib/utils'
import { Badge, Cabecera, Cargando, ErrorBox, Kpi, Vacio } from '../../components/ui'

export default function Pagos() {
  const [mes, setMes] = useState(primerDiaMes().slice(0, 7))
  const [profe, setProfe] = useState('')
  const [verAnulados, setVerAnulados] = useState(false)

  const profes = useDatos(() => supabase.from('profesores').select('id, nombre, apellido').order('apellido'), [])
  const { datos, error, cargando, recargar } = useDatos(() => {
    const desde = mes + '-01'
    let q = supabase.from('pagos')
      .select('*, alumnos(nombre, apellido), inscripciones(disciplinas(nombre), dojos(nombre)), profesores(nombre, apellido)')
      .gte('fecha_pago', desde).lt('fecha_pago', mesSiguiente(desde)).order('fecha_pago', { ascending: false })
    if (profe === 'admin') q = q.is('cobrado_por', null)
    else if (profe) q = q.eq('cobrado_por', profe)
    return q
  }, [mes, profe])

  async function anular(p) {
    const motivo = prompt('Motivo de la anulación:')
    if (!motivo) return
    const { error } = await supabase.from('pagos').update({ anulado: true, motivo_anulacion: motivo }).eq('id', p.id)
    if (error) alert(msgError(error)); else recargar()
  }

  const lista = (datos || []).filter((p) => verAnulados || !p.anulado)
  const validos = (datos || []).filter((p) => !p.anulado)
  const total = validos.reduce((s, p) => s + Number(p.monto), 0)
  const porMedio = Object.keys(MEDIOS).map((m) => [m, validos.filter((p) => p.medio === m).reduce((s, p) => s + Number(p.monto), 0)]).filter(([, v]) => v)

  function exportar() {
    descargarCSV(`pagos_${mes}.csv`, lista.map((p) => ({
      fecha: fmtFecha(p.fecha_pago), alumno: `${p.alumnos?.apellido}, ${p.alumnos?.nombre}`,
      disciplina: p.inscripciones?.disciplinas?.nombre, dojo: p.inscripciones?.dojos?.nombre,
      periodo: fmtPeriodo(p.periodo), monto: p.monto, medio: MEDIOS[p.medio],
      cobro: p.profesores ? `${p.profesores.nombre} ${p.profesores.apellido}` : 'Administración',
      anulado: p.anulado ? 'SI' : '',
    })))
  }

  return (
    <>
      <Cabecera titulo="Pagos">
        <button className="btn-sec" onClick={exportar} disabled={!lista.length}>Exportar</button>
        <Link className="btn" to="/admin/cobrar">+ Cobrar</Link>
      </Cabecera>

      <div className="filtros">
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        <select value={profe} onChange={(e) => setProfe(e.target.value)}>
          <option value="">Todos los que cobraron</option>
          <option value="admin">Administración</option>
          {(profes.datos || []).map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
        </select>
        <label style={{ flex: '0 0 auto', alignSelf: 'center' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={verAnulados} onChange={(e) => setVerAnulados(e.target.checked)} /> Ver anulados
        </label>
      </div>

      <div className="grilla">
        <Kpi titulo="Total cobrado" valor={fmtPlata(total)} cls="ok" />
        <Kpi titulo="Cantidad de pagos" valor={validos.length} />
        {porMedio.map(([m, v]) => <Kpi key={m} titulo={MEDIOS[m]} valor={fmtPlata(v)} />)}
      </div>

      <ErrorBox error={error} />
      {cargando ? <Cargando /> : !lista.length ? <Vacio>No hay pagos en este mes.</Vacio> : (
        <div className="tarjeta tabla-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Alumno</th><th>Disciplina</th><th>Período</th><th>Monto</th><th>Medio</th><th>Cobró</th><th></th></tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} style={p.anulado ? { opacity: .5, textDecoration: 'line-through' } : null}>
                  <td>{fmtFecha(p.fecha_pago)}</td>
                  <td>{p.alumnos?.apellido}, {p.alumnos?.nombre}</td>
                  <td>{p.inscripciones?.disciplinas?.nombre} <small>({p.inscripciones?.dojos?.nombre})</small></td>
                  <td>{fmtPeriodo(p.periodo)}</td>
                  <td>{fmtPlata(p.monto)}{Number(p.descuento_pct) > 0 && <small> (-{p.descuento_pct}%)</small>}</td>
                  <td>{MEDIOS[p.medio]}</td>
                  <td>{p.profesores ? `${p.profesores.nombre} ${p.profesores.apellido}` : 'Admin'}</td>
                  <td>{p.anulado ? <Badge cls="bad">Anulado</Badge> : <button className="btn-chico btn-sec" onClick={() => anular(p)}>Anular</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
