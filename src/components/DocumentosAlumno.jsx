import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useDatos } from '../lib/useDatos'
import { TIPOS_DOC, fmtFecha, hoyISO, msgError } from '../lib/utils'
import { Badge, Campo, Cargando, Vacio } from './ui'

// Lista y carga de documentos (apto médico, autorización, etc.) de un alumno.
// Los archivos van al bucket privado "documentos" en la carpeta <alumno_id>/
export default function DocumentosAlumno({ alumnoId }) {
  const { perfil } = useAuth()
  const [nuevo, setNuevo] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const { datos, cargando, recargar } = useDatos(
    () => supabase.from('documentos').select('*').eq('alumno_id', alumnoId).order('created_at', { ascending: false }), [alumnoId])

  async function ver(d) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(d.archivo_path, 120)
    if (error) return alert(msgError(error))
    window.open(data.signedUrl, '_blank')
  }

  async function guardar(e) {
    e.preventDefault()
    setSubiendo(true)
    let archivo_path = null
    if (nuevo.archivo) {
      const ext = nuevo.archivo.name.split('.').pop().toLowerCase()
      archivo_path = `${alumnoId}/${nuevo.tipo}_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('documentos').upload(archivo_path, nuevo.archivo)
      if (error) { setSubiendo(false); return alert(msgError(error)) }
    }
    const { error } = await supabase.from('documentos').insert({
      alumno_id: alumnoId, tipo: nuevo.tipo, archivo_path,
      fecha_emision: nuevo.fecha_emision || null, fecha_vencimiento: nuevo.fecha_vencimiento || null,
      observaciones: nuevo.observaciones || null,
    })
    setSubiendo(false)
    if (error) return alert(msgError(error))
    setNuevo(null); recargar()
  }

  async function borrar(d) {
    if (!confirm('¿Eliminar este documento?')) return
    if (d.archivo_path) await supabase.storage.from('documentos').remove([d.archivo_path])
    const { error } = await supabase.from('documentos').delete().eq('id', d.id)
    if (error) alert(msgError(error)); else recargar()
  }

  if (cargando) return <Cargando />
  const hoy = hoyISO()

  return (
    <>
      {!datos?.length ? <Vacio>Sin documentos cargados.</Vacio> : (
        <ul className="lista">
          {datos.map((d) => {
            const vencido = d.fecha_vencimiento && d.fecha_vencimiento < hoy
            return (
              <li key={d.id}>
                <span><b>{TIPOS_DOC[d.tipo]}</b>
                  <div className="sub">
                    {d.fecha_vencimiento ? `Vence ${fmtFecha(d.fecha_vencimiento)}` : 'Sin vencimiento'}
                    {d.observaciones ? ` · ${d.observaciones}` : ''}
                  </div>
                </span>
                <span className="acciones">
                  {d.fecha_vencimiento && <Badge cls={vencido ? 'bad' : 'ok'}>{vencido ? 'Vencido' : 'Vigente'}</Badge>}
                  {d.archivo_path && <button className="btn-chico btn-sec" onClick={() => ver(d)}>Ver</button>}
                  {perfil.rol === 'admin' && <button className="btn-chico btn-sec" onClick={() => borrar(d)}>✕</button>}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {!nuevo ? (
        <button style={{ marginTop: '.8rem' }} onClick={() => setNuevo({ tipo: 'apto_medico', fecha_emision: '', fecha_vencimiento: '', observaciones: '', archivo: null })}>
          + Cargar documento
        </button>
      ) : (
        <form className="form tarjeta" style={{ marginTop: '.8rem' }} onSubmit={guardar}>
          <div className="form-2">
            <Campo label="Tipo">
              <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>
                {Object.entries(TIPOS_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="Archivo o foto">
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setNuevo({ ...nuevo, archivo: e.target.files[0] })} />
            </Campo>
            <Campo label="Fecha de emisión"><input type="date" value={nuevo.fecha_emision} onChange={(e) => setNuevo({ ...nuevo, fecha_emision: e.target.value })} /></Campo>
            <Campo label="Vence"><input type="date" required={nuevo.tipo === 'apto_medico'} value={nuevo.fecha_vencimiento} onChange={(e) => setNuevo({ ...nuevo, fecha_vencimiento: e.target.value })} /></Campo>
          </div>
          <Campo label="Observaciones"><input value={nuevo.observaciones} onChange={(e) => setNuevo({ ...nuevo, observaciones: e.target.value })} /></Campo>
          <div className="acciones">
            <button disabled={subiendo}>{subiendo ? 'Subiendo…' : 'Guardar'}</button>
            <button type="button" className="btn-sec" onClick={() => setNuevo(null)}>Cancelar</button>
          </div>
        </form>
      )}
    </>
  )
}
