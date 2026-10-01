import { ESTADO_CUOTA, msgError } from '../lib/utils'

export function Modal({ titulo, onClose, children }) {
  return (
    <div className="modal-fondo" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-cab">
          <h3>{titulo}</h3>
          <button className="btn-icono" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  )
}

export function Campo({ label, children, ayuda }) {
  return (
    <label className="campo">
      <span>{label}</span>
      {children}
      {ayuda && <small>{ayuda}</small>}
    </label>
  )
}

export const Badge = ({ cls = '', children }) => <span className={`badge ${cls}`}>{children}</span>

export const BadgeCuota = ({ estado }) => {
  const e = ESTADO_CUOTA[estado] || { txt: estado, cls: '' }
  return <Badge cls={e.cls}>{e.txt}</Badge>
}

export const Cargando = () => <div className="cargando">Cargando…</div>
export const Vacio = ({ children = 'No hay datos todavía.' }) => <div className="vacio">{children}</div>
export const ErrorBox = ({ error }) => (error ? <div className="error">{msgError(error)}</div> : null)

export function Kpi({ titulo, valor, cls = '' }) {
  return (
    <div className={`kpi ${cls}`}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  )
}

export function Cabecera({ titulo, children }) {
  return (
    <div className="cabecera">
      <h2>{titulo}</h2>
      <div className="acciones">{children}</div>
    </div>
  )
}
