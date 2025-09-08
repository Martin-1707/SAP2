namespace Eco_Power_4;

entity Alerta
{
    key ID : UUID;
    atendida : Boolean default false;
    fecha : Timestamp;
    mensaje : String(255);
    severidad : String(20);
    tipo : String(50);
    dispositivo : Association to one Dispositivo;
}

entity Consumo
{
    key ID : UUID;
    co2 : Double;
    costo : Double;
    fecha : Timestamp;
    kwh : Double;
    potencia : Double;
    dispositivo : Association to one Dispositivo;
}

entity Dispositivo
{
    key ID : UUID;
    consumoBase : Double;
    estado : String(20);
    nombre : String(100);
    tipo : String(50);
    ubicacion : Association to one Ubicacion;
}

entity EventoEnergetico
{
    key ID : UUID;
    descripcion : String(255);
    fecha : Timestamp;
    impactoKwh : Double;
    ubicacion : Association to one Ubicacion;
}

entity FactorCarbono
{
    key ID : UUID;
    factor : Double;
    fuente : String(100);
    region : String(100);
}

entity MantenimientoDispositivo
{
    key ID : UUID;
    costo : Double;
    descripcion : String(255);
    fecha : Date;
    tipo : String(100);
    dispositivo : Association to one Dispositivo;
}

entity ObjetivoEnergetico
{
    key ID : UUID;
    cumplido : Boolean default false;
    metaCO2 : Double;
    metaDinero : Double;
    metaKwh : Double;
    nombreObjetivo : String(100);
    periodo : String(50);
    organizacion : Association to one Organizacion;
}

entity Organizacion
{
    key ID : UUID;
    nombre : String(100);
    tipo : String(20);
}

entity RangoTarifa
{
    key ID : UUID;
    precioKwh : Double;
    rangoFinKwh : Double;
    rangoInicioKwh : Double;
    tarifa : Association to one TarifaEnergia;
}

entity Recomendacion
{
    key ID : UUID;
    ahorroDinero : Double;
    ahorroKwh : Double;
    co2Reducido : Double;
    mensaje : String(255);
    dispositivo : Association to one Dispositivo;
}

entity Simulacion
{
    key ID : UUID;
    ahorroDinero : Double;
    ahorroKwh : Double;
    co2Reducido : Double;
    fecha : Timestamp;
    medida : String(100);
    dispositivo : Association to one Dispositivo;
    usuario : Association to one Usuario;
}

entity TarifaEnergia
{
    key ID : UUID;
    horarioFin : Time;
    horarioInicio : Time;
    moneda : String(5);
    tipoUsuario : String(20);
    vigenteDesde : Date;
    vigenteHasta : Date;
    organizacion : Association to one Organizacion;
    rangos : Composition of many RangoTarifa on rangos.tarifa = $self;
}

entity Ubicacion
{
    key ID : UUID;
    direccion : String(255);
    nombre : String(100);
    organizacion : Association to one Organizacion;
}

entity Usuario
{
    key ID : UUID;
    correo : String(100);
    nombre : String(100);
    rol : String(20);
    tipo : String(20);
    organizacion : Association to one Organizacion;
}