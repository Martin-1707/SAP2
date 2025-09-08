using { Eco_Power_4 as my } from '../db/schema.cds';

@path: '/service/Eco_Power_4Service'
service Eco_Power_4Service {

    // Monitor Service
    entity Consumos     as projection on my.Consumo;
    entity Dispositivos as projection on my.Dispositivo;
    entity Ubicaciones  as projection on my.Ubicacion;

    // Gestión de Usuarios
    entity Usuarios       as projection on my.Usuario;
    entity Organizaciones as projection on my.Organizacion;

    // Inteligencia Energética
    entity Recomendaciones as projection on my.Recomendacion;
    entity Alertas         as projection on my.Alerta;
    entity Simulaciones    as projection on my.Simulacion;
    entity Objetivos       as projection on my.ObjetivoEnergetico;
    entity Eventos         as projection on my.EventoEnergetico;

    // Tarifas
    entity Tarifas         as projection on my.TarifaEnergia;
    entity Rangos          as projection on my.RangoTarifa;
    entity FactoresCarbono as projection on my.FactorCarbono;
}
