-- =====================================================================
-- SAMAS SSGO · Migración 0001 · Esquema inicial
-- Pensado y desarrollado por NaSc
-- Ejecutar completo en Supabase > SQL Editor (una sola vez).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TIPOS
-- ---------------------------------------------------------------------
create type rol_usuario      as enum ('admin', 'profesor', 'alumno');
create type ciclo_pago       as enum ('inicio_mes', 'mitad_mes');   -- 1 al 10 / 15 al 20
create type estado_reserva   as enum ('confirmada', 'cancelada', 'asistio', 'ausente');
create type medio_pago       as enum ('efectivo', 'transferencia', 'mercadopago', 'otro');
create type tipo_documento   as enum ('apto_medico', 'autorizacion_tutor', 'dni', 'otro');
create type tipo_pendiente   as enum ('interno', 'alumno');
create type estado_pendiente as enum ('abierto', 'en_curso', 'resuelto');
create type prioridad_nivel  as enum ('baja', 'media', 'alta');
create type estado_liquid    as enum ('borrador', 'cerrada', 'pagada');

-- ---------------------------------------------------------------------
-- 2. TABLAS
-- ---------------------------------------------------------------------
create table perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  rol         rol_usuario not null default 'alumno',
  nombre      text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table dojos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  direccion   text,
  telefono    text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table disciplinas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  descripcion text,
  activa      boolean not null default true
);

-- Historial de precios: un aumento NO modifica pagos anteriores.
create table precios_disciplina (
  id             uuid primary key default gen_random_uuid(),
  dojo_id        uuid not null references dojos(id) on delete cascade,
  disciplina_id  uuid not null references disciplinas(id) on delete cascade,
  monto          numeric(12,2) not null check (monto >= 0),
  vigente_desde  date not null default current_date,
  unique (dojo_id, disciplina_id, vigente_desde)
);

create table profesores (
  id                 uuid primary key default gen_random_uuid(),
  perfil_id          uuid unique references perfiles(id) on delete set null,
  nombre             text not null,
  apellido           text not null,
  dni                text unique,
  telefono           text,
  email              text unique,          -- se usa para vincular su usuario
  porcentaje_liquid  numeric(5,2) not null default 0
                     check (porcentaje_liquid between 0 and 100), -- % que le corresponde al profe
  activo             boolean not null default true,
  created_at         timestamptz not null default now()
);

-- Un profesor por clase. dia_semana: 1 = lunes ... 7 = domingo
create table clases (
  id             uuid primary key default gen_random_uuid(),
  dojo_id        uuid not null references dojos(id) on delete cascade,
  disciplina_id  uuid not null references disciplinas(id),
  profesor_id    uuid references profesores(id) on delete set null,
  dia_semana     smallint not null check (dia_semana between 1 and 7),
  hora_inicio    time not null,
  hora_fin       time not null,
  cupo           smallint not null default 15 check (cupo > 0),
  activa         boolean not null default true,
  check (hora_fin > hora_inicio)
);

create table alumnos (
  id                     uuid primary key default gen_random_uuid(),
  perfil_id              uuid unique references perfiles(id) on delete set null,
  nombre                 text not null,
  apellido               text not null,
  dni                    text not null unique,
  fecha_nacimiento       date,             -- cumpleaños
  telefono               text,
  email                  text unique,      -- se usa para vincular su usuario
  direccion              text,
  emergencia_nombre      text,
  emergencia_telefono    text,
  -- Tutor (obligatorio en la app si es menor de 18)
  tutor_nombre           text,
  tutor_dni              text,
  tutor_telefono         text,
  tutor_vinculo          text,
  dojo_id                uuid not null references dojos(id),
  ciclo_pago             ciclo_pago not null default 'inicio_mes',
  descuento_pct          numeric(5,2) not null default 0
                         check (descuento_pct between 0 and 100), -- descuento por más de una matrícula
  observaciones          text,
  activo                 boolean not null default true,
  creado_por             uuid default auth.uid(),
  created_at             timestamptz not null default now()
);

-- Alumno ↔ disciplina (cada inscripción activa = una cuota mensual)
create table inscripciones (
  id             uuid primary key default gen_random_uuid(),
  alumno_id      uuid not null references alumnos(id) on delete cascade,
  dojo_id        uuid not null references dojos(id),
  disciplina_id  uuid not null references disciplinas(id),
  fecha_alta     date not null default current_date,
  fecha_baja     date,
  activa         boolean not null default true
);
create unique index inscripcion_activa_unica
  on inscripciones (alumno_id, dojo_id, disciplina_id) where activa;

create table reservas (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid not null references alumnos(id) on delete cascade,
  clase_id    uuid not null references clases(id) on delete cascade,
  fecha       date not null,
  estado      estado_reserva not null default 'confirmada',
  created_at  timestamptz not null default now(),
  unique (alumno_id, clase_id, fecha)
);

create table pagos (
  id                uuid primary key default gen_random_uuid(),
  alumno_id         uuid not null references alumnos(id) on delete cascade,
  inscripcion_id    uuid not null references inscripciones(id),
  periodo           date not null check (extract(day from periodo) = 1), -- mes pagado (siempre día 1)
  monto_lista       numeric(12,2) not null,
  descuento_pct     numeric(5,2) not null default 0,
  monto             numeric(12,2) not null check (monto >= 0),           -- lo efectivamente cobrado
  fecha_pago        date not null default current_date,
  medio             medio_pago not null default 'efectivo',
  cobrado_por       uuid references profesores(id),                     -- null = cobró el admin / MP
  registrado_por    uuid default auth.uid(),
  anulado           boolean not null default false,
  motivo_anulacion  text,
  mp_payment_id     text unique,                                         -- fase 3
  created_at        timestamptz not null default now()
);
create unique index pago_unico_por_periodo
  on pagos (inscripcion_id, periodo) where not anulado;

create table liquidaciones (
  id                uuid primary key default gen_random_uuid(),
  periodo           date not null check (extract(day from periodo) = 1),
  profesor_id       uuid not null references profesores(id),
  total_recaudado   numeric(12,2) not null default 0,
  porcentaje        numeric(5,2) not null,
  monto_profesor    numeric(12,2) not null default 0,
  monto_dojo        numeric(12,2) not null default 0,
  estado            estado_liquid not null default 'borrador',
  created_at        timestamptz not null default now(),
  unique (periodo, profesor_id)
);

create table documentos (
  id                 uuid primary key default gen_random_uuid(),
  alumno_id          uuid not null references alumnos(id) on delete cascade,
  tipo               tipo_documento not null,
  archivo_path       text,             -- ruta en Storage: <alumno_id>/<archivo>
  fecha_emision      date,
  fecha_vencimiento  date,
  observaciones      text,
  cargado_por        uuid default auth.uid(),
  created_at         timestamptz not null default now()
);

create table pendientes (
  id            uuid primary key default gen_random_uuid(),
  tipo          tipo_pendiente not null default 'interno',
  titulo        text not null,
  descripcion   text,
  dojo_id       uuid references dojos(id),
  alumno_id     uuid references alumnos(id) on delete cascade,
  asignado_a    uuid references profesores(id),
  prioridad     prioridad_nivel not null default 'media',
  estado        estado_pendiente not null default 'abierto',
  fecha_limite  date,
  automatico    boolean not null default false,
  creado_por    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  resuelto_at   timestamptz
);

-- ---------------------------------------------------------------------
-- 3. FUNCIONES AUXILIARES (roles)
-- ---------------------------------------------------------------------
create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin' and activo);
$$;

create or replace function mi_profesor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profesores where perfil_id = auth.uid() and activo;
$$;

create or replace function mi_alumno_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from alumnos where perfil_id = auth.uid() and activo;
$$;

-- El profesor ve a un alumno si está inscripto en una disciplina/dojo donde él da clase,
-- o si lo dio de alta él (para poder inscribirlo inmediatamente).
create or replace function profesor_ve_alumno(p_alumno uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from inscripciones i
    join clases c on c.dojo_id = i.dojo_id and c.disciplina_id = i.disciplina_id
    where i.alumno_id = p_alumno and i.activa and c.profesor_id = mi_profesor_id()
  )
  or exists (select 1 from alumnos a where a.id = p_alumno and a.creado_por = auth.uid());
$$;

create or replace function profesor_da_disciplina(p_dojo uuid, p_disciplina uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from clases
    where dojo_id = p_dojo and disciplina_id = p_disciplina and profesor_id = mi_profesor_id()
  );
$$;

-- ---------------------------------------------------------------------
-- 4. ALTA DE USUARIOS: vincula la cuenta nueva por email
--    - Si el email está en profesores → rol profesor
--    - Si está en alumnos            → rol alumno
--    - El primer admin se asigna a mano (ver README)
-- ---------------------------------------------------------------------
create or replace function nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_rol rol_usuario := 'alumno';
begin
  if exists (select 1 from profesores where lower(email) = lower(new.email)) then
    v_rol := 'profesor';
  end if;

  insert into perfiles (id, rol, nombre) values (new.id, v_rol, new.email);

  update profesores set perfil_id = new.id where lower(email) = lower(new.email);
  update alumnos    set perfil_id = new.id where lower(email) = lower(new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function nuevo_usuario();

-- ---------------------------------------------------------------------
-- 5. PRECIOS Y CUOTAS
-- ---------------------------------------------------------------------
create or replace function precio_vigente(p_dojo uuid, p_disciplina uuid, p_fecha date default current_date)
returns numeric language sql stable as $$
  select monto from precios_disciplina
  where dojo_id = p_dojo and disciplina_id = p_disciplina and vigente_desde <= p_fecha
  order by vigente_desde desc limit 1;
$$;

-- Estado de cuota por inscripción activa:
--  inicio_mes → paga del 1 al 10 | mitad_mes → paga del 15 al 20
--  al_dia: pagó el período que corresponde
--  en_periodo: todavía está dentro de su ventana de pago
--  vencido: pasó la ventana y no pagó
create or replace view v_estado_cuotas
with (security_invoker = true) as
with base as (
  select
    i.id as inscripcion_id, i.alumno_id, i.dojo_id, i.disciplina_id,
    a.nombre, a.apellido, a.ciclo_pago, a.descuento_pct,
    case a.ciclo_pago when 'inicio_mes' then 1  else 15 end as dia_desde,
    case a.ciclo_pago when 'inicio_mes' then 10 else 20 end as dia_hasta
  from inscripciones i
  join alumnos a on a.id = i.alumno_id
  where i.activa and a.activo
), periodo as (
  select b.*,
    case when extract(day from current_date) < b.dia_desde
         then (date_trunc('month', current_date) - interval '1 month')::date
         else date_trunc('month', current_date)::date end as periodo_actual
  from base b
)
select
  p.*,
  d.nombre as disciplina,
  (p.periodo_actual + (p.dia_hasta - 1))::date as vence_el,
  (select max(pg.fecha_pago) from pagos pg
     where pg.inscripcion_id = p.inscripcion_id and not pg.anulado) as ultimo_pago,
  case
    when exists (select 1 from pagos pg where pg.inscripcion_id = p.inscripcion_id
                 and pg.periodo = p.periodo_actual and not pg.anulado) then 'al_dia'
    when current_date <= (p.periodo_actual + (p.dia_hasta - 1)) then 'en_periodo'
    else 'vencido'
  end as estado,
  round(coalesce(precio_vigente(p.dojo_id, p.disciplina_id), 0) * (1 - p.descuento_pct / 100), 2) as monto_a_cobrar
from periodo p
join disciplinas d on d.id = p.disciplina_id;

-- ---------------------------------------------------------------------
-- 6. RESERVAS: control de cupo y día correcto
-- ---------------------------------------------------------------------
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

  select count(*) into v_ocupados from reservas
  where clase_id = new.clase_id and fecha = new.fecha
    and estado in ('confirmada', 'asistio') and id <> new.id;

  if v_ocupados >= v_clase.cupo then
    raise exception 'Clase completa (cupo %)', v_clase.cupo;
  end if;
  return new;
end $$;

create trigger trg_validar_reserva
  before insert or update of estado, fecha on reservas
  for each row execute function validar_reserva();

create or replace view v_ocupacion
with (security_invoker = true) as
select r.clase_id, r.fecha, c.cupo,
       count(*) filter (where r.estado in ('confirmada', 'asistio')) as ocupados
from reservas r join clases c on c.id = r.clase_id
group by r.clase_id, r.fecha, c.cupo;

-- ---------------------------------------------------------------------
-- 7. LIQUIDACIÓN MENSUAL (porcentajes editables por profesor)
-- ---------------------------------------------------------------------
create or replace function calcular_liquidacion(p_periodo date) returns void
language plpgsql security definer set search_path = public as $$
declare v_mes date := date_trunc('month', p_periodo)::date;
begin
  if not es_admin() then raise exception 'Solo el administrador'; end if;

  insert into liquidaciones (periodo, profesor_id, total_recaudado, porcentaje, monto_profesor, monto_dojo)
  select v_mes, pr.id, coalesce(sum(pg.monto), 0), pr.porcentaje_liquid,
         round(coalesce(sum(pg.monto), 0) * pr.porcentaje_liquid / 100, 2),
         round(coalesce(sum(pg.monto), 0) * (1 - pr.porcentaje_liquid / 100), 2)
  from profesores pr
  left join pagos pg on pg.cobrado_por = pr.id and not pg.anulado
       and date_trunc('month', pg.fecha_pago) = v_mes
  where pr.activo
  group by pr.id, pr.porcentaje_liquid
  on conflict (periodo, profesor_id) do update
    set total_recaudado = excluded.total_recaudado,
        porcentaje      = excluded.porcentaje,
        monto_profesor  = excluded.monto_profesor,
        monto_dojo      = excluded.monto_dojo
    where liquidaciones.estado = 'borrador';   -- una liquidación cerrada no se recalcula
end $$;

-- ---------------------------------------------------------------------
-- 8. PENDIENTES AUTOMÁTICOS (apto médico faltante o vencido)
--    Se puede llamar desde la app o programar con pg_cron.
-- ---------------------------------------------------------------------
create or replace function generar_pendientes_documentos() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into pendientes (tipo, titulo, descripcion, dojo_id, alumno_id, prioridad, automatico)
  select 'alumno',
         'Apto médico ' || case when ap.fecha_vencimiento is null then 'faltante' else 'vencido' end
           || ': ' || a.apellido || ', ' || a.nombre,
         'Generado automáticamente', a.dojo_id, a.id, 'alta', true
  from alumnos a
  left join lateral (
    select fecha_vencimiento from documentos d
    where d.alumno_id = a.id and d.tipo = 'apto_medico'
    order by d.fecha_vencimiento desc nulls last limit 1
  ) ap on true
  where a.activo
    and (ap.fecha_vencimiento is null or ap.fecha_vencimiento < current_date)
    and not exists (select 1 from pendientes p
                    where p.alumno_id = a.id and p.automatico and p.estado <> 'resuelto'
                      and p.titulo like 'Apto médico%');
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- 9. CUMPLEAÑOS (próximos 7 días)
-- ---------------------------------------------------------------------
create or replace view v_cumpleanos
with (security_invoker = true) as
select a.id, a.nombre, a.apellido, a.telefono, a.dojo_id, a.fecha_nacimiento,
       (make_date(extract(year from current_date)::int,
                  extract(month from a.fecha_nacimiento)::int, 1)
        + (extract(day from a.fecha_nacimiento)::int - 1)) as cumple_este_anio
from alumnos a
where a.activo and a.fecha_nacimiento is not null
  and (to_char(a.fecha_nacimiento, 'MMDD') between to_char(current_date, 'MMDD')
                                              and to_char(current_date + 7, 'MMDD')
       or (to_char(current_date + 7, 'MMDD') < to_char(current_date, 'MMDD')   -- cruce de año
           and (to_char(a.fecha_nacimiento, 'MMDD') >= to_char(current_date, 'MMDD')
                or to_char(a.fecha_nacimiento, 'MMDD') <= to_char(current_date + 7, 'MMDD'))));

-- ---------------------------------------------------------------------
-- 10. SEGURIDAD (RLS)
-- ---------------------------------------------------------------------
alter table perfiles           enable row level security;
alter table dojos              enable row level security;
alter table disciplinas        enable row level security;
alter table precios_disciplina enable row level security;
alter table profesores         enable row level security;
alter table clases             enable row level security;
alter table alumnos            enable row level security;
alter table inscripciones      enable row level security;
alter table reservas           enable row level security;
alter table pagos              enable row level security;
alter table liquidaciones      enable row level security;
alter table documentos         enable row level security;
alter table pendientes         enable row level security;

-- Perfiles
create policy perfiles_propio on perfiles for select using (id = auth.uid() or es_admin());
create policy perfiles_admin  on perfiles for all    using (es_admin()) with check (es_admin());

-- Catálogos: todos los usuarios logueados leen; solo admin escribe
create policy dojos_leer       on dojos              for select to authenticated using (true);
create policy dojos_admin      on dojos              for all using (es_admin()) with check (es_admin());
create policy disc_leer        on disciplinas        for select to authenticated using (true);
create policy disc_admin       on disciplinas        for all using (es_admin()) with check (es_admin());
create policy precios_leer     on precios_disciplina for select to authenticated using (true);
create policy precios_admin    on precios_disciplina for all using (es_admin()) with check (es_admin());
create policy clases_leer      on clases             for select to authenticated using (true);
create policy clases_admin     on clases             for all using (es_admin()) with check (es_admin());
create policy profes_leer      on profesores         for select to authenticated using (true);
create policy profes_admin     on profesores         for all using (es_admin()) with check (es_admin());

-- Alumnos
create policy alumnos_admin    on alumnos for all using (es_admin()) with check (es_admin());
create policy alumnos_profe_v  on alumnos for select using (mi_profesor_id() is not null and (creado_por = auth.uid() or profesor_ve_alumno(id)));
create policy alumnos_profe_i  on alumnos for insert with check (mi_profesor_id() is not null);
create policy alumnos_profe_u  on alumnos for update using (mi_profesor_id() is not null and profesor_ve_alumno(id));
create policy alumnos_propio   on alumnos for select using (perfil_id = auth.uid());

-- Inscripciones
create policy insc_admin   on inscripciones for all using (es_admin()) with check (es_admin());
create policy insc_profe   on inscripciones for all
  using (profesor_da_disciplina(dojo_id, disciplina_id))
  with check (profesor_da_disciplina(dojo_id, disciplina_id) and profesor_ve_alumno(alumno_id));
create policy insc_propio  on inscripciones for select using (alumno_id = mi_alumno_id());

-- Reservas: el alumno gestiona las suyas; el profe ve y marca asistencia en sus clases
create policy res_admin    on reservas for all using (es_admin()) with check (es_admin());
create policy res_profe    on reservas for all
  using (exists (select 1 from clases c where c.id = clase_id and c.profesor_id = mi_profesor_id()))
  with check (exists (select 1 from clases c where c.id = clase_id and c.profesor_id = mi_profesor_id()));
create policy res_alumno   on reservas for all
  using (alumno_id = mi_alumno_id()) with check (alumno_id = mi_alumno_id());

-- Pagos: el profe ve los de sus alumnos y registra los que cobra él
create policy pagos_admin   on pagos for all using (es_admin()) with check (es_admin());
create policy pagos_profe_v on pagos for select using (mi_profesor_id() is not null and profesor_ve_alumno(alumno_id));
create policy pagos_profe_i on pagos for insert
  with check (cobrado_por = mi_profesor_id() and profesor_ve_alumno(alumno_id));
create policy pagos_alumno  on pagos for select using (alumno_id = mi_alumno_id());

-- Liquidaciones: cada profe ve solo la suya
create policy liq_admin on liquidaciones for all using (es_admin()) with check (es_admin());
create policy liq_profe on liquidaciones for select using (profesor_id = mi_profesor_id());

-- Documentos (dato sensible: solo admin, profe del alumno y el propio alumno)
create policy doc_admin  on documentos for all using (es_admin()) with check (es_admin());
create policy doc_profe  on documentos for all
  using (mi_profesor_id() is not null and profesor_ve_alumno(alumno_id))
  with check (mi_profesor_id() is not null and profesor_ve_alumno(alumno_id));
create policy doc_alumno on documentos for all
  using (alumno_id = mi_alumno_id()) with check (alumno_id = mi_alumno_id());

-- Pendientes
create policy pend_admin on pendientes for all using (es_admin()) with check (es_admin());
create policy pend_profe on pendientes for select
  using (asignado_a = mi_profesor_id() or creado_por = auth.uid()
         or (alumno_id is not null and profesor_ve_alumno(alumno_id)));
create policy pend_profe_i on pendientes for insert with check (mi_profesor_id() is not null);
create policy pend_profe_u on pendientes for update
  using (asignado_a = mi_profesor_id() or creado_por = auth.uid());

-- ---------------------------------------------------------------------
-- 11. STORAGE privado para documentos  (ruta: <alumno_id>/<archivo>)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create policy storage_docs_leer on storage.objects for select using (
  bucket_id = 'documentos' and (
    es_admin()
    or (mi_profesor_id() is not null and profesor_ve_alumno(split_part(name, '/', 1)::uuid))
    or split_part(name, '/', 1)::uuid = mi_alumno_id()
  ));

create policy storage_docs_subir on storage.objects for insert with check (
  bucket_id = 'documentos' and (
    es_admin()
    or (mi_profesor_id() is not null and profesor_ve_alumno(split_part(name, '/', 1)::uuid))
    or split_part(name, '/', 1)::uuid = mi_alumno_id()
  ));

create policy storage_docs_borrar on storage.objects for delete using (
  bucket_id = 'documentos' and es_admin());
