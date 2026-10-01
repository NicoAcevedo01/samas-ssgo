import { useAuth } from '../../lib/auth'
import ClasesDelDia from '../../components/ClasesDelDia'
import { Cabecera } from '../../components/ui'

export default function Hoy() {
  const { perfil } = useAuth()
  return (
    <>
      <Cabecera titulo="Mis clases" />
      <ClasesDelDia profesorId={perfil.profesor_id} />
    </>
  )
}
