using { Eco_Power_4 as my } from '../db/schema';

@path: '/sostenibilidad'
service SostenibilidadService {
    entity Objetivos       as projection on my.ObjetivoEnergetico;
    entity FactoresCarbono as projection on my.FactorCarbono;
    entity Tarifas         as projection on my.TarifaEnergia;
    entity Rangos          as projection on my.RangoTarifa;
}
