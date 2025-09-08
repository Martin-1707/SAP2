const cds = require('@sap/cds')
module.exports = cds.service.impl(async function() {
  const { Consumo, Dispositivo, Ubicacion, Organizacion,
          TarifaEnergia, RangoTarifa, FactorCarbono,
          Alerta, Recomendacion, Simulacion, ObjetivoEnergetico } = this.entities

  // -------- Helpers --------
  const q = cds.ql
  const inWindow = (ts, start, end) => {
    // Asume mismos day-bounds; si end < start => ventana cruza medianoche
    const t = new Date(ts); const hhmm = t.toTimeString().slice(0,5)
    return start <= end ? (hhmm >= start && hhmm <= end) : (hhmm >= start || hhmm <= end)
  }

  async function precioTarifa(ts, orgID, kwhBloque=0) {
    // 1) Selecciona la tarifa vigente y cuyo horario cubre la hora de ts
    const tarifas = await SELECT.from(TarifaEnergia).where({
      organizacion_ID: orgID
    })
    const tjs = new Date(ts)
    for (const t of tarifas) {
      if (t.vigenteDesde && t.vigenteHasta) {
        const d = tjs.toISOString().slice(0,10)
        if (d < t.vigenteDesde || d > t.vigenteHasta) continue
      }
      if (inWindow(ts, String(t.horarioInicio).slice(0,5), String(t.horarioFin).slice(0,5))) {
        // 2) Busca rango de bloques (si existen)
        const rangos = await SELECT.from(RangoTarifa).where({ tarifa_ID: t.ID })
        if (rangos?.length) {
          const r = rangos.find(r => kwhBloque >= r.rangoInicioKwh && kwhBloque <= r.rangoFinKwh)
          if (r) return r.precioKwh
        }
        // fallback: no hay rangos => precio base inexistente; devuelve 0
        return 0
      }
    }
    return 0
  }

  async function factorCO2(region) {
    const r = await SELECT.one`factor`.from(FactorCarbono).where({ region })
    return r?.factor ?? 0.0
  }

  async function orgDeDispositivo(dispositivoID) {
    const row = await SELECT.one.from(Dispositivo, d => {
      d.ID, d.ubicacion_ID
    }).where({ ID: dispositivoID })
    if (!row) return null
    const ub = await SELECT.one.from(Ubicacion, u => { u.organizacion_ID }).where({ ID: row.ubicacion_ID })
    return ub?.organizacion_ID || null
  }

  // -------- Reglas: completar costo y CO2 al insertar Consumo --------
  this.before('CREATE', 'Consumos', async (req) => {
    const { kwh, fecha, dispositivo_ID } = req.data
    const orgID = await orgDeDispositivo(dispositivo_ID)
    const precio = await precioTarifa(fecha, orgID, kwh ?? 0)
    // Si tu tabla Consumo ya trae costo/co2, solo recalcula si vienen nulos
    if (req.data.costo == null) req.data.costo = (kwh ?? 0) * precio

    // Factor por región de la ubicación del dispositivo
    const ub = await SELECT.one.from(Ubicacion).where({ ID: (await SELECT.one.from(Dispositivo).where({ ID: dispositivo_ID })).ubicacion_ID })
    const fco2 = await factorCO2(ub?.nombre /* o ub.region si lo añades */)
    if (req.data.co2 == null) req.data.co2 = (kwh ?? 0) * fco2
  })

  // -------- Acción: Alertas por reglas simples --------
  this.on('TriggerAlerts', async (req) => {
    const { orgID } = req.data
    let creadas = 0

    // Regla 1: consumo > 3 * consumoBase en la última hora
    const hace1h = new Date(Date.now() - 60*60*1000).toISOString()
    const rows = await SELECT.from(Consumo).where`fecha >= ${hace1h}`
    // Agrupa por dispositivo
    const porDisp = {}
    rows.forEach(r => { (porDisp[r.dispositivo_ID] ??= []).push(r) })

    for (const dispID of Object.keys(porDisp)) {
      const disp = await SELECT.one.from(Dispositivo).where({ ID: dispID })
      const org = await orgDeDispositivo(dispID)
      if (orgID && org !== orgID) continue
      const totalKwh = porDisp[dispID].reduce((a,b)=>a+(b.kwh||0),0)
      if (disp?.consumoBase && totalKwh > 3*disp.consumoBase) {
        await INSERT.into(Alerta).entries({
          ID: cds.utils.uuid(), fecha: new Date(), atendida: false,
          severidad: 'alta', tipo: 'pico_consumo',
          mensaje: `Pico de consumo en ${disp?.nombre} >3x base (${totalKwh.toFixed(2)} kWh)`,
          dispositivo_ID: dispID
        })
        creadas++
      }
    }

    // Regla 2: consumo fuera de horario laboral (ej: 22:00–06:00)
    const rows2 = await SELECT.from(Consumo).where`fecha >= ${hace1h}`
    for (const r of rows2) {
      const hh = new Date(r.fecha).getHours()
      if (hh >= 22 || hh < 6) {
        const org = await orgDeDispositivo(r.dispositivo_ID)
        if (orgID && org !== orgID) continue
        await INSERT.into(Alerta).entries({
          ID: cds.utils.uuid(), fecha: new Date(), atendida: false,
          severidad: 'media', tipo: 'fuera_horario',
          mensaje: 'Consumo fuera de horario laboral',
          dispositivo_ID: r.dispositivo_ID
        })
        creadas++
      }
    }

    return creadas
  })

  // -------- Acción: Recomendaciones por reglas simples --------
  this.on('GenerateRecommendations', async (req) => {
    const { orgID } = req.data
    let creadas = 0

    // Heurística: si promedio potencia > X, sugiere mantenimiento o cambio a modelo eficiente
    const desde = new Date(Date.now() - 24*60*60*1000).toISOString()
    const rows = await SELECT.from(Consumo).where`fecha >= ${desde}`

    const map = new Map()
    for (const r of rows) {
      if (orgID && (await orgDeDispositivo(r.dispositivo_ID)) !== orgID) continue
      const agg = map.get(r.dispositivo_ID) || { kwh:0, n:0 }
      agg.kwh += (r.kwh||0); agg.n++
      map.set(r.dispositivo_ID, agg)
    }

    for (const [dispID, agg] of map) {
      const prom = agg.kwh / Math.max(1, agg.n)
      if (prom > 1.0) { // umbral de ejemplo
        const ahorroKwh = prom * 0.15
        await INSERT.into(Recomendacion).entries({
          ID: cds.utils.uuid(),
          mensaje: 'Cambiar a equipo eficiente o revisar mantenimiento',
          ahorroKwh, ahorroDinero: null, co2Reducido: null, // se pueden completar con tarifa/factor
          dispositivo_ID: dispID
        })
        creadas++
      }
    }
    return creadas
  })

  // -------- Acción: Acknowledgement de alerta --------
  this.on('AckAlerta', async (req) => {
    const { ID } = req.data
    await UPDATE(Alerta).set({ atendida: true }).where({ ID })
  })

  // -------- Simulación “¿Qué pasa si…?” --------
  this.on('SimularAhorro', async (req) => {
    const { dispositivoID, medida, valor, desde, hasta } = req.data
    // 1) Lee consumo histórico del periodo
    const base = await SELECT.from(Consumo).where({
      dispositivo_ID: dispositivoID,
      fecha: { between: [desde, hasta] }
    })

    const totalKwh = base.reduce((a,b)=>a+(b.kwh||0),0)
    const orgID = await orgDeDispositivo(dispositivoID)
    const precio = await precioTarifa(desde, orgID, totalKwh)
    const ub = await SELECT.one.from(Ubicacion).join(Dispositivo).on({ 'Ubicacion.ID': 'Dispositivo.ubicacion_ID' })
                        .where({ 'Dispositivo.ID': dispositivoID })
    const fco2 = await factorCO2(ub?.nombre)

    // 2) Modelo simple de qué pasaría
    let factor = 1
    if (medida === 'reducir_uso_horas') factor = Math.max(0, 1 - (valor || 0)/24)  // proporcional
    if (medida === 'cambiar_equipo')    factor = 0.8                                  // 20% mejor

    const kwhNew   = totalKwh * factor
    const ahorro   = totalKwh - kwhNew
    const ahorroS = ahorro * precio
    const co2Red   = ahorro * fco2

    const sim = {
      ID: cds.utils.uuid(),
      fecha: new Date(),
      medida, ahorroKwh: ahorro, ahorroDinero: ahorroS, co2Reducido: co2Red,
      dispositivo_ID: dispositivoID, usuario_ID: null
    }
    await INSERT.into(Simulacion).entries(sim)
    return sim
  })

  // -------- Funciones expuestas --------
  this.on('PrecioTarifaEn', req => precioTarifa(req.data.ts, req.data.orgID, req.data.kwhBloque))
  this.on('FactorCO2', req => factorCO2(req.data.region))

  // -------- Filtro multi-cliente por organización (lecturas) --------
  // Si en auth pones el atributo orgID, aquí lo aplicas automáticamente:
  this.before(['READ'], ['Consumos','Dispositivos','Ubicaciones','ConsumosView','Alertas','Recomendaciones'], async (req) => {
    const orgID = req.user?.attr?.orgID
    if (!orgID) return // mock: sin restricción
    // inyecta where por organización
    if (req.target.name.endsWith('Consumos') || req.target.name.endsWith('ConsumosView')) {
      req.query.where({ 'organizacion_ID': orgID })
    }
  })
})
