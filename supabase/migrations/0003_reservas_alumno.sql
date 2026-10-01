-- =====================================================================
-- SAMAS SSGO · Migración 0003 · Ocupación de clases y reservas del alumno
-- Pensado y desarrollado por NaSc
-- =====================================================================

-- El alumno solo ve sus propias reservas (RLS), así que no puede contar
-- cuántos lugares quedan. Esta función devuelve SOLO cantidades, sin nombres.
create or replace function ocupacion_clases(p_desde date, p_hasta date)
returns table (clase_id uuid, fecha date, ocupados int)
language sql stable security definer set search_path = public as $$
  select r.clase_id, r.fecha, count(*)::int
  from reservas r
  where r.fecha between p_desde and p_hasta
    and r.estado in ('confirmada', 'asistio')
    and auth.uid() is not null
  group by r.clase_id, r.fecha;
$$;

-- El alumno solo puede reservar clases de disciplinas en las que está inscripto.
create or replace function validar_reserva() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_clase clases%rowtype; v_ocupados int;
begin
  if new.estado <> 'confirmada' then return new; end if;

  select * into v_clase from clases where id = new.clase_id;
  if not v_clase.activa then
    raise exception 'La clase no está activa';
  end if;
  if extract(isodow from new.fecha) <> v_clase.dia_semana then
    raise exception 'La fecha no corresponde al día de la clase';
  end if;
  if new.fecha < current_date then
    raise exception 'No se puede reservar una fecha pasada';
  end if;

  if new.alumno_id = mi_alumno_id() and not exists (
       select 1 from inscripciones i
       where i.alumno_id = new.alumno_id and i.activa
         and i.dojo_id = v_clase.dojo_id and i.disciplina_id = v_clase.disciplina_id) then
    raise exception 'No estás inscripto en esta disciplina';
  end if;

  select count(*) into v_ocupados from reservas
  where clase_id = new.clase_id and fecha = new.fecha
    and estado in ('confirmada', 'asistio') and id <> new.id;

  if v_ocupados >= v_clase.cupo then
    raise exception 'Clase completa (cupo %)', v_clase.cupo;
  end if;
  return new;
end $$;

-- Datos básicos del usuario logueado en una sola llamada (rol + ids)
create or replace function mi_sesion()
returns table (rol rol_usuario, profesor_id uuid, alumno_id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.rol, mi_profesor_id(), mi_alumno_id(),
         coalesce((select nombre || ' ' || apellido from profesores where perfil_id = auth.uid()),
                  (select nombre || ' ' || apellido from alumnos    where perfil_id = auth.uid()),
                  p.nombre)
  from perfiles p where p.id = auth.uid();
$$;

-- El profesor también puede resolver pendientes automáticos de sus alumnos (ej.: apto vencido)
create policy pend_profe_u_alumno on pendientes for update
  using (alumno_id is not null and mi_profesor_id() is not null and profesor_ve_alumno(alumno_id));
