/* Vista de prueba. Solo lee datos_intradia; no altera rawData ni rawHistory. */
let graficoIntradia = null;
let graficoFAIntradia = null;
let indiceCorteIntradia = -1;
let modoClientesIntradia = 'saldos';
let paginaClientesIntradia = 0;
let paginaOrdenesIntradia = 0;
let filtroEstadoIntradia = 'todas';
let detalleIntradiaAbierto = false;
let firmaFiltroIntradia = '';
let ordenClientesIntradia = 'estimado';
let direccionOrdenClientesIntradia = 'desc';
const TAM_PAGINA_INTRADIA = 50;
const ESTADOS_INTRADIA = {ci: 'Incluida CI', futuro: 'Compromiso futuro', revisar: 'Revisar', pendiente: 'Pendiente', sin_ejecucion: 'Sin ejecución', sin_efectivo: 'Sin efectivo', fuera_base: 'Fuera de la base'};

function escIntradia(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}
function destruirGraficoIntradia() {
    if (graficoIntradia) { graficoIntradia.destroy(); graficoIntradia = null; }
    if (graficoFAIntradia) { graficoFAIntradia.destroy(); graficoFAIntradia = null; }
}
function horaIntradia(iso) {
    return new Intl.DateTimeFormat('es-AR', {timeZone:'America/Argentina/Buenos_Aires', hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(iso));
}
function elegirCorteIntradia(v) { indiceCorteIntradia = Number(v); paginaClientesIntradia = 0; paginaOrdenesIntradia = 0; renderizarIntradia(); }
function elegirClientesIntradia(v) { modoClientesIntradia = v; paginaClientesIntradia = 0; renderizarIntradia(); }
function ordenarClientesIntradia(columna) {
    if (!['cuenta','asesor','inicial','delta','estimado','futuro','incluidas','revision'].includes(columna)) return;
    if (ordenClientesIntradia === columna) {
        direccionOrdenClientesIntradia = direccionOrdenClientesIntradia === 'asc' ? 'desc' : 'asc';
    } else {
        ordenClientesIntradia = columna;
        direccionOrdenClientesIntradia = ['cuenta','asesor'].includes(columna) ? 'asc' : 'desc';
    }
    paginaClientesIntradia = 0;
    renderizarIntradia();
}
function elegirEstadoIntradia(v) { filtroEstadoIntradia = v; paginaOrdenesIntradia = 0; detalleIntradiaAbierto = true; renderizarIntradia(); }
function paginarIntradia(tipo, delta) {
    if (tipo === 'clientes') paginaClientesIntradia += delta;
    else { paginaOrdenesIntradia += delta; detalleIntradiaAbierto = true; }
    renderizarIntradia();
}
function verOrdenesIntradia(id) {
    detalleIntradiaAbierto = true;
    filtroEstadoIntradia = 'todas';
    seleccionarCliente(id);
    document.getElementById('detalleIntradia')?.scrollIntoView({behavior:'smooth', block:'start'});
}
function paginadorIntradia(tipo, pagina, paginas, total) {
    const estilo = 'px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg disabled:opacity-30';
    return `<div class="flex items-center justify-between text-xs text-slate-400 mt-3 gap-2"><span>${total.toLocaleString('es-AR')} registros · Página ${pagina+1} de ${paginas}</span><div class="flex gap-2"><button class="${estilo}" ${pagina===0?'disabled':''} onclick="paginarIntradia('${tipo}',-1)">Anterior</button><button class="${estilo}" ${pagina>=paginas-1?'disabled':''} onclick="paginarIntradia('${tipo}',1)">Siguiente</button></div></div>`;
}

function renderizarIntradia() {
    destruirGraficoIntradia();
    const container = document.getElementById('tabContent');
    if (typeof datosIntradia === 'undefined' || !datosIntradia.base || datosIntradia.version !== 1) {
        container.innerHTML = '<div class="card rounded-2xl p-8 text-center"><h3 class="font-bold text-white">Prepará la base de la mañana</h3><p class="text-slate-400 mt-2 text-sm">Ejecutá procesar_cluster.py y elegí el modo 1. Después, el modo 2 incorporará las órdenes, acreditaciones, cupones y dividendos a esta pestaña.</p></div>';
        return;
    }
    const {base, cortes} = datosIntradia;
    if (typeof idBaseCluster === 'undefined' || base.id !== idBaseCluster || typeof fechaCorteCluster === 'undefined' || base.fecha !== fechaCorteCluster) {
        container.innerHTML = '<div class="card border-amber-700 rounded-2xl p-8 text-center text-amber-200">La estimación y el cluster corresponden a bases diferentes. Actualizá juntos datos_cluster.js y datos_intradia.js, y recargá la página.</div>';
        return;
    }
    const monedaFiltro = document.getElementById('filtroMoneda').value;
    const monedas = monedaFiltro === 'Cable_CV7000' ? ['CABLE','CV7000'] : [monedaFiltro];
    const etiquetaMoneda = monedaFiltro === 'Cable_CV7000' ? 'USD Cable + CV7000' : monedaFiltro === 'MEP' ? 'USD MEP' : 'ARS';
    const prefijo = monedaFiltro === 'ARS' ? '$' : 'USD';
    const dinero = v => v == null || !Number.isFinite(v) ? '—' : `${v<0?'−':''}${prefijo} ${fmt(Math.abs(v))}`;
    const color = v => v < 0 ? 'text-rose-300' : v > 0 ? 'text-emerald-300' : 'text-slate-400';
    const fa = document.getElementById('filtroFA').value;
    const negocio = document.getElementById('filtroNegocio').value;
    const todosAsesores = asesoresSeleccionados.size === 0 || asesoresSeleccionados.size === listaAsesoresVisibles.length;
    const firma = JSON.stringify([monedaFiltro, fa, negocio, [...asesoresSeleccionados].sort(), clienteSeleccionadoId]);
    if (firma !== firmaFiltroIntradia) { paginaClientesIntradia = 0; paginaOrdenesIntradia = 0; firmaFiltroIntradia = firma; }
    const clientes = base.clientes.filter(c => (fa === 'Todas' || c.fa === fa) && (negocio === 'Todas' || c.negocio === negocio)
        && (todosAsesores || asesoresSeleccionados.has(c.asesor)) && (!clienteSeleccionadoId || c.id === clienteSeleccionadoId));
    const ids = new Set(clientes.map(c => c.id));
    const indice = indiceCorteIntradia < 0 ? cortes.length-1 : Math.min(indiceCorteIntradia, cortes.length-1);
    const corte = cortes[indice];
    const movs = corte?.movimientos || {};
    const saldoMoneda = (c,m) => m === 'CV7000' && c.saldos?.[m] == null ? 0 : c.saldos?.[m];
    const sumarSaldos = valores => valores.every(Number.isFinite) ? valores.reduce((a,v)=>a+v,0) : null;
    const movimientoCorte = (fuente,id,indice) => monedas.reduce((a,m)=>a+(fuente?.[id]?.[m]?.[indice] || 0),0);
    const filas = clientes.map(c => {
        const inicial = sumarSaldos(monedas.map(m=>saldoMoneda(c,m)));
        const delta = movimientoCorte(movs,c.id,0);
        const futuro = movimientoCorte(movs,c.id,1);
        const incluidas = movimientoCorte(movs,c.id,2);
        const revision = movimientoCorte(movs,c.id,3);
        return {...c, inicial, delta, futuro, incluidas, revision,
            estimado: inicial == null ? null : inicial+delta,
            tieneMovimientos: !!(delta || futuro || incluidas || revision)};
    });
    const conocidas = filas.filter(c => c.inicial != null);
    const suma = campo => conocidas.length ? conocidas.reduce((a,c)=>a+c[campo],0) : null;
    const inicial = suma('inicial'), delta = filas.reduce((a,c)=>a+c.delta,0), estimado = suma('estimado');
    const futuro = filas.reduce((a,c)=>a+c.futuro,0);
    const sinBase = filas.length-conocidas.length;
    const revisiones = filas.reduce((a,c)=>a+c.revision,0);
    const cuentasConOperaciones = filas.filter(c => c.incluidas > 0).length;
    const cuentasSoloRevision = filas.filter(c => c.incluidas === 0 && c.revision > 0).length;
    // La tabla muestra saldos, no actividad: dos operaciones que se cancelan
    // dejan fuera a una cuenta que empezó y terminó en cero. Una base vacía
    // permanece desconocida; solo se conserva si hay flujo CI neto conocido.
    const saldoVisible = valor => valor != null && Math.abs(valor) >= 0.005;
    const mostrarSaldo = c => saldoVisible(c.inicial) || saldoVisible(c.estimado)
        || (c.inicial == null && saldoVisible(c.delta));
    const cuentasConSaldo = filas.filter(mostrarSaldo).length;
    // La distribución replica la de Liquidez: suma saldos estimados positivos
    // por FA, respetando moneda, fecha y filtros de personas.
    const saldosPorFA = new Map();
    filas.forEach(c => {
        if (c.estimado != null && c.estimado > 0) {
            const nombre = c.fa || 'Otro';
            saldosPorFA.set(nombre, (saldosPorFA.get(nombre) || 0) + c.estimado);
        }
    });
    const distribucionFA = [...saldosPorFA].sort((a,b) => b[1]-a[1]);
    const totalDistribucionFA = distribucionFA.reduce((a,[,valor]) => a+valor,0);
    let tabla = filas.filter(c => modoClientesIntradia === 'todos'
        || (modoClientesIntradia === 'negativos' ? c.estimado != null && c.estimado < -0.005
            : modoClientesIntradia === 'movimientos' ? c.tieneMovimientos : mostrarSaldo(c)));
    const compararTexto = new Intl.Collator('es-AR', {numeric:true, sensitivity:'base'}).compare;
    const valorOrden = c => ordenClientesIntradia === 'revision' ? (c.inicial == null ? null : c.revision) : c[ordenClientesIntradia];
    tabla.sort((a,b) => {
        if (ordenClientesIntradia === 'magnitud') {
            return Math.abs(b.delta)-Math.abs(a.delta) || b.incluidas-a.incluidas || b.revision-a.revision
                || Math.abs(b.futuro)-Math.abs(a.futuro) || compararTexto(a.cuenta,b.cuenta);
        }
        const va = valorOrden(a), vb = valorOrden(b);
        if (va == null || vb == null) return (va == null ? 1 : 0)-(vb == null ? 1 : 0) || compararTexto(a.cuenta,b.cuenta);
        const comparacion = typeof va === 'string' ? compararTexto(va,vb) : va-vb;
        return (direccionOrdenClientesIntradia === 'asc' ? comparacion : -comparacion) || compararTexto(a.cuenta,b.cuenta);
    });
    const paginas = Math.max(1,Math.ceil(tabla.length/TAM_PAGINA_INTRADIA));
    paginaClientesIntradia = Math.min(Math.max(0,paginaClientesIntradia),paginas-1);
    const pagina = tabla.slice(paginaClientesIntradia*TAM_PAGINA_INTRADIA,(paginaClientesIntradia+1)*TAM_PAGINA_INTRADIA);
    const sinFiltrosPersonas = fa === 'Todas' && negocio === 'Todas' && todosAsesores && !clienteSeleccionadoId;
    const ordenes = (corte?.ordenes || []).map(r => {
        const fila = Object.fromEntries(datosIntradia.camposOrden.map((k,i)=>[k,r[i]]));
        fila.fuente = fila.fuente || 'Órdenes';
        return fila;
    })
        .filter(r => (ids.has(r.cliente) || (sinFiltrosPersonas && r.resultado === 'fuera_base'))
            && (monedas.includes(r.moneda) || r.moneda === 'OTRA'));
    const resultadosOrdenes = corte?.conteo_fuente?.['Órdenes'] || {};
    const totalOrdenesFuente = Number(corte?.fuentes?.ordenes || 0);
    const ordenesVisibles = ordenes.filter(r => r.fuente === 'Órdenes').length;
    const efectosCi = ordenes.filter(r => ids.has(r.cliente) && monedas.includes(r.moneda)
        && r.resultado === 'ci' && Number.isFinite(r.efecto));
    const entradas = efectosCi.reduce((a,r)=>a+Math.max(0,r.efecto),0);
    const salidas = efectosCi.reduce((a,r)=>a+Math.max(0,-r.efecto),0);
    const auditar = ordenes.filter(r => filtroEstadoIntradia === 'todas' ||
        (filtroEstadoIntradia === 'incluidas' ? ['ci','futuro'].includes(r.resultado) :
         filtroEstadoIntradia === 'revision' ? ['revisar','pendiente'].includes(r.resultado) :
         filtroEstadoIntradia === 'sin_efecto' ? ['sin_ejecucion','sin_efectivo'].includes(r.resultado) : r.resultado === filtroEstadoIntradia));
    const pagsOrdenes = Math.max(1,Math.ceil(auditar.length/TAM_PAGINA_INTRADIA));
    paginaOrdenesIntradia = Math.min(Math.max(0,paginaOrdenesIntradia),pagsOrdenes-1);
    const auditPagina = auditar.slice(paginaOrdenesIntradia*TAM_PAGINA_INTRADIA,(paginaOrdenesIntradia+1)*TAM_PAGINA_INTRADIA);
    const tarjeta = (titulo, valor, nota, clase) => `<div class="card rounded-2xl p-5"><p class="text-xs text-slate-400">${titulo}</p><p class="text-xl font-bold mt-2 ${clase}">${dinero(valor)}</p><p class="text-[11px] text-slate-500 mt-2">${nota}</p></div>`;
    const encabezado = (campo, titulo, numerico=false) => {
        const activo = ordenClientesIntradia === campo;
        const sentido = activo ? direccionOrdenClientesIntradia : 'none';
        const flecha = activo ? (sentido === 'asc' ? '▲' : '▼') : '↕';
        return `<th class="p-3 ${numerico?'text-right':''}" aria-sort="${sentido === 'none' ? 'none' : sentido === 'asc' ? 'ascending' : 'descending'}"><button type="button" class="w-full flex items-center gap-1.5 ${numerico?'justify-end':''} hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 rounded" title="Ordenar por ${titulo}" onclick="ordenarClientesIntradia('${campo}')">${titulo}<span class="text-[10px] ${activo?'text-violet-300':'text-slate-600'}" aria-hidden="true">${flecha}</span></button></th>`;
    };
    container.innerHTML = `
        <section class="card rounded-2xl p-5 border-violet-500/30">
            <div class="flex flex-wrap items-start justify-between gap-4">
                <div><span class="text-[10px] uppercase tracking-widest text-violet-300 font-bold">Prueba · Estimación parcial</span>
                    <h2 class="text-lg font-bold text-white mt-1">Liquidez intradiaria en ${etiquetaMoneda}</h2>
                    <p class="text-xs text-slate-400 mt-1">Base del ${formatearFechaCorta(base.fecha)} · Corte ${base.corte.slice(0,5)}${base.corte_confirmado?' informado':' supuesto, pendiente de validar'}</p>
                </div>
                <label class="text-xs text-slate-400">Actualización procesada
                    <select id="corteIntradia" class="block mt-1 bg-slate-900 text-violet-200 border border-slate-700 rounded-lg px-3 py-2" onchange="elegirCorteIntradia(this.value)">
                        ${cortes.length ? cortes.map((c,i)=>`<option value="${i}" ${i===indice?'selected':''}>${formatearFechaActualizacion(c.generado)} · #${i+1}</option>`).join('') : '<option>Solo base de la mañana</option>'}
                    </select>
                </label>
            </div>
            <p class="text-xs text-amber-200/90 mt-4 leading-relaxed">A tener en cuenta que este dashboard de liquidez intradiaria es un aproximado de cálculos que vienen de los reportes del clúster, órdenes, acreditaciones y pago de cupones/dividendos. La idea es tener una visualización rápida de los movimientos durante el día de los saldos líquidos, <strong>no tomar lo que dice como la verdad absoluta y siempre chequear en los comitentes</strong>.</p>
            ${corte?.fuentes?`<p class="text-[11px] text-slate-500 mt-3">Fuentes de esta actualización: ${Number(corte.fuentes.ordenes||0).toLocaleString('es-AR')} órdenes · ${Number(corte.fuentes.acreditaciones||0).toLocaleString('es-AR')} acreditaciones · ${Number(corte.fuentes.cupones_dividendos||0).toLocaleString('es-AR')} cupones/dividendos · ${Number(corte.comprobantes_conciliados||0).toLocaleString('es-AR')} comprobantes conciliados con transferencias</p>`:''}
            ${corte?.conteo_fuente?.['Órdenes']?`<p class="text-[11px] text-sky-200 mt-2">Órdenes del reporte (${totalOrdenesFuente.toLocaleString('es-AR')}, todas las monedas): ${Number(resultadosOrdenes.ci||0).toLocaleString('es-AR')} incorporadas CI · ${Number(resultadosOrdenes.futuro||0).toLocaleString('es-AR')} compromisos futuros · ${Number((resultadosOrdenes.revisar||0)+(resultadosOrdenes.pendiente||0)).toLocaleString('es-AR')} para revisar/pendientes · ${Number((resultadosOrdenes.sin_efectivo||0)+(resultadosOrdenes.sin_ejecucion||0)).toLocaleString('es-AR')} sin efecto/ejecución · ${Number(resultadosOrdenes.fuera_base||0).toLocaleString('es-AR')} fuera de SS/VL. Con la moneda y los filtros actuales se ven ${ordenesVisibles.toLocaleString('es-AR')} órdenes en el detalle.</p>`:''}
            ${!corte?'<p class="mt-3 text-sky-300 text-sm">Para agregar una actualización, ejecutá el Python en modo 2 con uno o más reportes completos del día.</p>':''}
        </section>
        <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            ${tarjeta('Saldo de la mañana',inicial,'Suma de saldos iniciales informados','text-slate-100')}
            ${tarjeta('Movimientos incorporados',delta,`Entradas ${dinero(entradas)} · Salidas ${dinero(salidas)}. Neto de todas las cuentas seleccionadas.`,color(delta))}
            ${tarjeta('Saldo estimado',estimado,'Base + movimientos de cuentas con saldo inicial informado','text-violet-300')}
            ${tarjeta('Compromisos futuros netos',futuro,'Negativo: pagos · Positivo: cobros. Liquidación posterior a hoy, separada del CI.',color(futuro))}
        </section>
        <div class="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400 px-1">
            <span>${filas.length.toLocaleString('es-AR')} cuentas del clúster bajo los filtros · ${conocidas.length.toLocaleString('es-AR')} con saldo inicial informado</span>
            <span>${cuentasConSaldo.toLocaleString('es-AR')} cuentas con saldo inicial o estimado distinto de cero en esta moneda</span>
            <span>${cuentasConOperaciones.toLocaleString('es-AR')} cuentas con operaciones CI o futuras · ${cuentasSoloRevision.toLocaleString('es-AR')} solo para revisar en esta moneda</span>
            <span class="${sinBase?'text-amber-300':''}">${sinBase.toLocaleString('es-AR')} sin saldo inicial informado: movimientos incluidos, saldo absoluto no calculable</span>
            <span class="text-amber-300">${revisiones.toLocaleString('es-AR')} movimientos pendientes o para revisar en la moneda seleccionada</span>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <section class="card rounded-2xl p-5 lg:col-span-7"><h3 class="text-sm font-bold text-white">Evolución intradiaria del saldo estimado</h3><p class="text-xs text-slate-400 mt-1">Foto de la mañana y estimaciones hasta la actualización seleccionada. Horarios de procesamiento, sin actualización en vivo.</p><div class="h-72 mt-4 relative"><canvas id="graficoIntradia"></canvas></div></section>
            <section class="card rounded-2xl p-5 lg:col-span-5"><h3 class="text-sm font-bold text-white">Distribución del saldo estimado por FA</h3><p class="text-xs text-slate-400 mt-1">Saldos positivos de las cuentas filtradas · ${dinero(totalDistribucionFA)}. Los negativos quedan fuera de la torta.</p><div class="h-72 mt-4 relative">${distribucionFA.length?'<canvas id="graficoFAIntradia"></canvas>':'<p class="h-full flex items-center justify-center text-sm text-slate-500">No hay saldos positivos en esta selección.</p>'}</div></section>
        </div>
        <section class="card rounded-2xl p-5">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h3 class="text-sm font-bold text-white">Saldo estimado por cliente</h3><p class="text-xs text-slate-500 mt-1">Se muestran todas las cuentas con saldo al inicio o al cierre, hayan operado o no. Las que empiezan y terminan en cero quedan fuera de esta vista. Movimiento indica el neto; tocá una columna para ordenar. Los filtros superiores gobiernan los totales y el gráfico.</p></div>
            <select class="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs" onchange="elegirClientesIntradia(this.value)">
                ${[['saldos','Con saldo inicial o estimado'],['movimientos','Con actividad o revisión'],['todos','Todos los clientes (incluye cero)'],['negativos','Estimados negativos']].map(([v,l])=>`<option value="${v}" ${modoClientesIntradia===v?'selected':''}>${l}</option>`).join('')}
            </select></div>
            <div class="overflow-x-auto"><table class="w-full text-xs text-left"><thead class="text-slate-400 bg-slate-900"><tr>
                ${encabezado('cuenta','Cliente / Comitente')}${encabezado('asesor','Asesor')}${encabezado('inicial','Base',true)}${encabezado('delta','Movimiento neto',true)}${encabezado('estimado','Estimado',true)}${encabezado('futuro','Compromiso futuro',true)}${encabezado('incluidas','Operaciones',true)}${encabezado('revision','Revisión')}<th class="p-3"></th>
            </tr></thead><tbody class="divide-y divide-slate-800">${pagina.map(c=>`<tr class="hover:bg-slate-800/50"><td class="p-3 font-medium text-slate-200">${escIntradia(c.cuenta)}<span class="block text-[10px] text-slate-500">${escIntradia(c.comitente)}</span></td><td class="p-3 text-slate-400">${escIntradia(c.asesor)}</td><td class="p-3 text-right whitespace-nowrap">${dinero(c.inicial)}</td><td class="p-3 text-right whitespace-nowrap ${color(c.delta)}">${dinero(c.delta)}</td><td class="p-3 text-right whitespace-nowrap font-bold ${c.estimado<0?'text-rose-300':'text-violet-200'}">${dinero(c.estimado)}</td><td class="p-3 text-right whitespace-nowrap ${color(c.futuro)}">${dinero(c.futuro)}</td><td class="p-3 text-right tabular-nums" title="Operaciones CI o futuras incorporadas">${c.incluidas.toLocaleString('es-AR')}</td><td class="p-3 text-amber-300">${c.inicial==null?'Sin base':c.revision?`${c.revision} movimientos`:'—'}</td><td class="p-3"><button data-cliente-intradia="${escIntradia(c.id)}" class="text-sky-300 whitespace-nowrap hover:underline">Ver movimientos</button></td></tr>`).join('') || '<tr><td colspan="9" class="p-8 text-center text-slate-500">No hay clientes para esta selección.</td></tr>'}</tbody></table></div>
            ${paginadorIntradia('clientes',paginaClientesIntradia,paginas,tabla.length)}
        </section>
        <details id="detalleIntradia" class="card rounded-2xl p-5" ${detalleIntradiaAbierto?'open':''}>
            <summary class="cursor-pointer text-sm font-bold text-white">Detalle de movimientos: incorporados, pendientes y excepciones (${ordenes.length.toLocaleString('es-AR')})</summary>
            <div class="mt-4 flex flex-wrap gap-3 items-center justify-between"><p class="text-xs text-slate-400">Revisá la fuente y el motivo de cada movimiento. Los registros fuera de la base solo aparecen sin filtros de personas.</p>
                <select class="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs" onchange="elegirEstadoIntradia(this.value)">${[['todas','Todas'],['incluidas','Incorporadas'],['revision','Pendientes / revisar'],['sin_efecto','Sin ejecución / sin efectivo'],['fuera_base','Fuera de la base']].map(([v,l])=>`<option value="${v}" ${filtroEstadoIntradia===v?'selected':''}>${l}</option>`).join('')}</select>
            </div>
            <div class="overflow-x-auto mt-3"><table class="w-full text-xs text-left"><thead class="bg-slate-900 text-slate-400"><tr><th class="p-3">ID / Fuente / Hora</th><th class="p-3">Cliente</th><th class="p-3">Operación / Estado</th><th class="p-3">Liquidación / Moneda</th><th class="p-3 text-right">Monto del reporte</th><th class="p-3 text-right">Bruto / capital calculado</th><th class="p-3">Tratamiento / Motivo</th></tr></thead>
            <tbody class="divide-y divide-slate-800">${auditPagina.map(r=>`<tr><td class="p-3">${escIntradia(r.orden)}<span class="block text-violet-300">${escIntradia(r.fuente)}</span><span class="block text-slate-500">${escIntradia(r.hora)}</span></td><td class="p-3">${escIntradia(r.cuenta)}<span class="block text-slate-500">${escIntradia(r.comitente)}</span></td><td class="p-3">${escIntradia(r.operacion)}<span class="block text-slate-500">${escIntradia(r.estado)}</span></td><td class="p-3">${escIntradia(r.liquidacion)}<span class="block text-slate-500">${escIntradia(r.moneda)}</span></td><td class="p-3 text-right whitespace-nowrap">${r.solicitado == null ? '—' : fmt(r.solicitado)}</td><td class="p-3 text-right whitespace-nowrap">${r.calculado == null ? '—' : fmt(r.calculado)}</td><td class="p-3 min-w-[220px]"><span class="font-semibold ${['ci','futuro'].includes(r.resultado)?'text-violet-300':'text-amber-200'}">${escIntradia(ESTADOS_INTRADIA[r.resultado] || r.resultado)}</span><span class="block text-slate-400 mt-1">${escIntradia(r.motivo)}</span></td></tr>`).join('') || '<tr><td colspan="7" class="p-8 text-center text-slate-500">No hay movimientos para esta selección.</td></tr>'}</tbody></table></div>
            ${paginadorIntradia('ordenes',paginaOrdenesIntradia,pagsOrdenes,auditar.length)}
        </details>`;
    document.querySelectorAll('[data-cliente-intradia]').forEach(btn => btn.addEventListener('click',()=>verOrdenesIntradia(btn.dataset.clienteIntradia)));
    document.getElementById('detalleIntradia').addEventListener('toggle', e => { detalleIntradiaAbierto = e.target.open; });
    const puntos = [inicial, ...cortes.slice(0,indice+1).map(c=>conocidas.length ? conocidas.reduce((a,r)=>a+r.inicial+movimientoCorte(c.movimientos,r.id,0),0) : null)];
    graficoIntradia = new Chart(document.getElementById('graficoIntradia'), {
        type:'line', data:{labels:[`Base ${base.corte.slice(0,5)}`, ...cortes.slice(0,indice+1).map(c=>horaIntradia(c.generado))], datasets:[{label:'Saldo estimado',data:puntos,borderColor:'#a78bfa',backgroundColor:'rgba(167,139,250,.12)',pointBackgroundColor:'#a78bfa',pointBorderColor:'#ede9fe',pointBorderWidth:2,pointRadius:5,fill:true,tension:0}]},
        options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:30,left:24,right:50}},scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y:{grace:'18%',ticks:{color:'#94a3b8',callback:v=>formatAbrev(v,prefijo+' ')},grid:{color:'#1e293b'}}},plugins:{legend:{display:false},datalabels:{display:puntos.length<=10,align:'top',anchor:'end',offset:8,clip:false,color:'#ddd6fe',font:{size:10,weight:'bold'},formatter:v=>v==null?'':formatAbrev(v,prefijo+' ')},tooltip:{callbacks:{label:ctx=>' Estimación parcial: '+dinero(ctx.parsed.y)}}}}
    });
    if (distribucionFA.length) {
        const paleta = ['#800000','#ea580c','#0284c7','#1e3a8a','#d97706','#9333ea','#10b981','#06b6d4','#f43f5e','#8b5cf6','#eab308','#14b8a6','#6366f1','#ec4899','#0d9488','#64748b'];
        graficoFAIntradia = new Chart(document.getElementById('graficoFAIntradia'), {
            type:'doughnut',
            data:{labels:distribucionFA.map(([fa])=>fa),datasets:[{data:distribucionFA.map(([,saldo])=>saldo),backgroundColor:distribucionFA.map((_,i)=>paleta[i%paleta.length])}]},
            options:{responsive:true,maintainAspectRatio:false,plugins:{datalabels:{display:false},legend:{position:'right',labels:{color:'#cbd5e1',boxWidth:10,font:{size:10}}},tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${dinero(ctx.raw)} (${(ctx.raw/totalDistribucionFA*100).toFixed(1)}%)`}}}}
        });
    }
}
