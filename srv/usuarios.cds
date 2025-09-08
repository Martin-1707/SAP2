using { Eco_Power_4 as my } from '../db/schema.cds';

@path: '/usuarios'
service UsuariosService {
    entity Usuarios       as projection on my.Usuario;
    entity Organizaciones as projection on my.Organizacion;
    entity Ubicaciones    as projection on my.Ubicacion;
}