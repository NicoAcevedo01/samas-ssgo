export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const DIAS_CORTOS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Fechas locales (evita el corrimiento de zona horaria de toISOString)
export const hoyISO = () => isoLocal(new Date())
export function isoLocal(d) {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
export const diaISO = (d = new Date()) => (d.getDay() === 0 ? 7 : d.getDay()) // 1=lun..7=dom
export const primerDiaMes = (d = new Date()) => isoLocal(new Date(d.getFullYear(), d.getMonth(), 1))
export const mesSiguiente = (iso) => {
  const [y, m] = iso.split('-').map(Number)
  return isoLocal(new Date(y, m, 1))
}

export const fmtFecha = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
export const fmtHora = (t) => (t ? t.slice(0, 5) : '')
export const fmtPeriodo = (iso) =>
  iso ? new Date(iso + 'T12:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : '—'
export const fmtPlata = (n) =>
  Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export function edad(fechaNac) {
  if (!fechaNac) return null
  const n = new Date(fechaNac + 'T12:00'), h = new Date()
  let e = h.getFullYear() - n.getFullYear()
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--
  return e
}

export const ESTADO_CUOTA = {
  al_dia: { txt: 'Al día', cls: 'ok' },
  en_periodo: { txt: 'En período de pago', cls: 'warn' },
  vencido: { txt: 'Vencido', cls: 'bad' },
}

export const CICLOS = { inicio_mes: 'Inicio de mes (1 al 10)', mitad_mes: 'Mitad de mes (15 al 20)' }
export const MEDIOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', mercadopago: 'Mercado Pago', otro: 'Otro' }
export const TIPOS_DOC = { apto_medico: 'Apto médico', autorizacion_tutor: 'Autorización tutor', dni: 'DNI', otro: 'Otro' }

// Traduce errores comunes de Supabase/Postgres
export function msgError(e) {
  const m = e?.message || String(e)
  if (m.includes('Invalid login credentials')) return 'Usuario o contraseña incorrectos'
  if (m.includes('User already registered')) return 'Ese usuario ya tiene cuenta. Iniciá sesión.'
  if (m.includes('duplicate key') && m.includes('dni')) return 'Ya existe una persona con ese DNI'
  if (m.includes('duplicate key') && m.includes('usuario')) return 'Ese nombre de usuario ya está en uso'
  if (m.includes('pago_unico_por_periodo')) return 'Ese mes ya está pagado para esa disciplina'
  if (m.includes('inscripcion_activa_unica')) return 'El alumno ya está inscripto en esa disciplina'
  if (m.includes('usuario_formato')) return 'Usuario: 3 a 30 caracteres, solo letras, números, punto, guion'
  if (m.includes('row-level security')) return 'No tenés permiso para esta acción'
  return m
}

export function descargarCSV(nombre, filas) {
  if (!filas.length) return
  const cols = Object.keys(filas[0])
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(';'), ...filas.map((f) => cols.map((c) => esc(f[c])).join(';'))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = nombre
  a.click()
}
