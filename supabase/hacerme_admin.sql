-- Ejecutar COMPLETO (las dos líneas juntas) en SQL Editor.
-- Antes: crear el usuario en Authentication > Users > Add user.
update perfiles set rol = 'admin'
where id = (select id from auth.users where email = 'nicoacevedo0495@gmail.com');

-- Verificación: debería devolver una fila con rol = admin
select p.rol, u.email from perfiles p join auth.users u on u.id = p.id
where u.email = 'nicoacevedo0495@gmail.com';
