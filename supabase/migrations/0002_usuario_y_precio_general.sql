-- =====================================================================
-- SAMAS SSGO · Migración 0002
-- 1) Login con USUARIO + contraseña (alumnos y profesores)
-- 2) Precio general por disciplina, con opción de precio distinto por dojo
-- Pensado y desarrollado por NaSc
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. USUARIO
-- Supabase necesita un email para loguear. La app convierte el usuario
-- en un email interno:  juanperez  →  juanperez@samas-ssgo.local
-- El admin puede seguir entrando con su email real.
-- ---------------------------------------------------------------------
alter table alumnos    add column usuario text;
alter table profesores add column usuario text;

create unique index alumnos_usuario_unico    on alumnos    (lower(usuario)) where usuario is not null;
create unique index profesores_usuario_unico on profesores (lower(usuario)) where usuario is not null;

alter table alumnos    add constraint alumnos_usuario_formato
  check (usuario ~ '^[a-zA-Z0-9._-]{3,30}$');
alter table profesores add constraint profesores_usuario_formato
  check (usuario ~ '^[a-zA-Z0-9._-]{3,30}$');

-- Vinculación segura al registrarse:
-- el profe/admin carga al alumno con su usuario y DNI;
-- cuando el alumno crea la cuenta, tiene que coincidir usuario + DNI.
create or replace function nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol     rol_usuario := 'alumno';
  v_usuario text := lower(split_part(new.email, '@', 1));
  v_dni     text := nullif(trim(new.raw_user_meta_data->>'dni'), '');
  v_interno boolean := new.email ilike '%@samas-ssgo.local';
begin
  if v_interno and exists (select 1 from profesores
                           where lower(usuario) = v_usuario and dni = v_dni and perfil_id is null) then
    v_rol := 'profesor';
  end if;

  insert into perfiles (id, rol, nombre) values (new.id, v_rol, v_usuario)
  on conflict (id) do nothing;

  if v_interno then
    update profesores set perfil_id = new.id
     where lower(usuario) = v_usuario and dni = v_dni and perfil_id is null;
    update alumnos set perfil_id = new.id
     where lower(usuario) = v_usuario and dni = v_dni and perfil_id is null;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. PRECIO GENERAL (dojo_id vacío) + precio por dojo opcional
-- ---------------------------------------------------------------------
alter table precios_disciplina alter column dojo_id drop not null;
alter table precios_disciplina
  drop constraint if exists precios_disciplina_dojo_id_disciplina_id_vigente_desde_key;
alter table precios_disciplina
  add constraint precios_unico unique nulls not distinct (dojo_id, disciplina_id, vigente_desde);

comment on column precios_disciplina.dojo_id is
  'Vacío = precio general para todos los dojos. Con dojo = precio especial solo para ese dojo.';

-- Si el dojo tiene precio propio vigente lo usa; si no, toma el general.
create or replace function precio_vigente(p_dojo uuid, p_disciplina uuid, p_fecha date default current_date)
returns numeric language sql stable as $$
  select monto from precios_disciplina
  where disciplina_id = p_disciplina
    and vigente_desde <= p_fecha
    and (dojo_id = p_dojo or dojo_id is null)
  order by (dojo_id is not null) desc, vigente_desde desc
  limit 1;
$$;
