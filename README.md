# SAMAS SSGO

Sistema de gestión de dojos: alumnos, cuotas, cobros, reservas con cupo, profesores, liquidación y pendientes.
App web instalable en el celular (PWA), también usable desde PC.

*Pensado y desarrollado por NaSc*

---

## Tecnología

| Parte | Herramienta |
|---|---|
| Frontend | React + Vite, publicado en GitHub Pages |
| Base de datos, login y archivos | Supabase |
| Deploy | GitHub Actions (automático en cada push a `main`) |

## Roles

| Rol | Qué puede hacer |
|---|---|
| **Admin** | Todo: dashboard, dojos y clases, profesores, precios, alumnos, pagos, liquidación, reservas, pendientes |
| **Profesor** | Sus clases y asistencia, alumnos de sus clases (alta y edición), cobrar, su caja, pendientes |
| **Alumno** | Reservar/cancelar clases, ver su cuota e historial, subir su apto médico |

---

## Instalación (una sola vez)

### 1. Supabase
1. En **SQL Editor** ejecutar, en orden y cada uno completo:
   - `supabase/migrations/0001_esquema_inicial.sql`
   - `supabase/seed.sql`
   - `supabase/migrations/0002_usuario_y_precio_general.sql`
   - `supabase/migrations/0003_reservas_alumno.sql`
2. **Authentication → Sign In / Providers → Email**: desactivar **Confirm email**.
3. Crear tu usuario admin y ejecutar `supabase/hacerme_admin.sql`.
4. **Project Settings → API**: copiar **Project URL** y la clave **anon public**.

### 2. GitHub
1. Crear el repositorio `samas-ssgo` y subir todo el contenido de esta carpeta.
2. **Settings → Secrets and variables → Actions → New repository secret**, crear:
   - `VITE_SUPABASE_URL` → la Project URL
   - `VITE_SUPABASE_ANON_KEY` → la clave anon public
3. **Settings → Pages → Source**: elegir **GitHub Actions**.
4. Ir a **Actions** y esperar que termine el deploy (✔ verde).
5. La app queda en: `https://TU_USUARIO.github.io/samas-ssgo/`

> La clave *anon* es pública por diseño: la seguridad la dan los permisos (RLS) de la base. **Nunca** uses la clave *service_role* en el frontend.

### 3. Primer uso (como admin)
1. **Precios**: cargar el precio mensual de cada disciplina.
2. **Profesores**: cargar cada profe con **usuario** y **DNI** y su % de liquidación.
3. **Dojos y clases**: cargar los horarios de cada dojo (Dojo 1 arranca vacío).
4. **Alumnos**: cargar alumnos con usuario y DNI, e inscribirlos en sus disciplinas.

### Cómo crean su cuenta profesores y alumnos
1. El admin (o el profe, para alumnos) los carga con **usuario** y **DNI**.
2. Entran a la app → **Crear cuenta** → usuario + DNI + contraseña.
3. Si usuario y DNI coinciden, quedan vinculados con su rol automáticamente.

---

## Correr en tu PC (opcional)
```bash
npm install
cp .env.example .env.local   # completar con tus datos de Supabase
npm run dev
```

## Estructura
```
supabase/          SQL: esquema, permisos, funciones, datos iniciales
src/lib/           conexión a Supabase, sesión, utilidades
src/components/    layout, menú, componentes compartidos
src/pages/admin/   pantallas del administrador
src/pages/profesor pantallas del profesor
src/pages/alumno/  pantallas del alumno
src/pages/         pantallas compartidas (Alumnos, Cobrar, Pendientes)
```

## Próximas fases
- Alertas de cuota vencida por WhatsApp / email
- Exportación a Excel ampliada y reportes
- Pago online con Mercado Pago (registro automático por webhook)
