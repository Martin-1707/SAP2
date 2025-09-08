using { Eco_Power_4 as my } from '../db/schema';

@path: '/inteligencia'
service InteligenciaService {
    entity Recomendaciones as projection on my.Recomendacion;
    entity Alertas         as projection on my.Alerta;
    entity Simulaciones    as projection on my.Simulacion;
}