using { Eco_Power_4 as my } from '../db/schema';

@path: '/dispositivos'
service DispositivosService {
    entity Dispositivos as projection on my.Dispositivo;
    entity Consumos     as projection on my.Consumo;
}