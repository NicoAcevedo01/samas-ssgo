-- =====================================================================
-- SAMAS SSGO · Datos iniciales
-- Dojo 1 queda vacío a propósito. Clases, horarios, profesores y precios
-- se cargan desde la app (menú Administrador).
-- =====================================================================
insert into dojos (nombre) values ('Dojo 1'), ('Dojo 2');

insert into disciplinas (nombre) values
  ('Taekwondo'), ('Karate'), ('Kickboxing'), ('Boxeo'), ('MMA');

-- Después de crear tu usuario en la app (o en Supabase > Authentication),
-- convertilo en administrador reemplazando el email:
-- update perfiles set rol = 'admin'
-- where id = (select id from auth.users where email = 'TU_EMAIL@ejemplo.com');
