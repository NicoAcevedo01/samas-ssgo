import { useAuth } from '../../lib/auth'
import DocumentosAlumno from '../../components/DocumentosAlumno'
import { Cabecera } from '../../components/ui'

export default function Documentos() {
  const { perfil } = useAuth()
  return (
    <>
      <Cabecera titulo="Mis documentos" />
      <p style={{ marginTop: 0, color: 'var(--gris)', fontSize: '.9rem' }}>
        Subí una foto o PDF de tu apto médico y su fecha de vencimiento. Solo lo ven tus profesores y la administración.
      </p>
      <div className="tarjeta"><DocumentosAlumno alumnoId={perfil.alumno_id} /></div>
    </>
  )
}
