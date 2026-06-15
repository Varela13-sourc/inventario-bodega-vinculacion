const CONFIG = {
  stockActualCsvUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3YzCfkRrc-osRMQ9WWQxJLvoKjMgyHe4b_-GpwpeDCNfWrIfoA90GGKO2SAkaPV1yMZwsG2T6oMkz/pub?gid=265782808&single=true&output=csv",
  movimientosCsvUrl: "",
  appsScriptUrl: "",
  refreshIntervalMs: 60000,
  appName: "Inventario Bodega · Vinculación Ciudadana",
};

const STOCK_ACTUAL_REQUIRED_HEADERS = [
  "SKU",
  "Categoría",
  "Artículo / Insumo",
  "Unidad",
  "Existencia física",
  "Disponible real",
  "Stock mínimo",
  "Semáforo",
];

const STOCK_ACTUAL_HEADER_ERROR =
  "La URL CSV no corresponde a STOCK_ACTUAL. Copia la URL publicada en CSV de la pestaña STOCK_ACTUAL.";

const NEGATIVE_MOVEMENT_TYPES = new Set(["SALIDA", "AJUSTE-"]);
const MOVEMENT_TYPES = ["ENTRADA", "SALIDA", "AJUSTE+", "AJUSTE-", "TRASLADO"];

const FIELD_ALIASES = {
  sku: ["sku", "codigo", "clave"],
  categoria: ["categoria", "category"],
  articulo: ["articulo_insumo", "articulo", "insumo", "producto", "material", "nombre"],
  descripcion: ["descripcion", "detalle", "description"],
  unidad: ["unidad", "unidades", "medida"],
  ubicacion: ["ubicacion", "bodega", "almacen", "localizacion"],
  existenciaInicial: ["existencia_inicial", "inicial"],
  entradas: ["entradas", "entrada"],
  salidas: ["salidas", "salida"],
  ajustesNetos: ["ajustes_netos", "ajuste_neto", "ajustes"],
  existenciaFisica: ["existencia_fisica"],
  comprometidoReservado: ["comprometido_reservado", "comprometido", "reservado"],
  disponibleReal: ["disponible_real", "disponible"],
  stockMinimo: ["stock_minimo", "minimo", "existencia_minima"],
  semaforo: ["semaforo", "estado", "estatus"],
  proveedorPendiente: ["proveedor_pendiente", "pendiente_proveedor", "por_recibir"],
  ultimaActualizacion: ["ultima_actualizacion", "actualizacion", "fecha_actualizacion"],
  responsable: ["responsable", "capturo", "encargado"],
  observaciones: ["observaciones", "observacion", "nota", "notas"],
};

const MOVEMENT_ALIASES = {
  fecha: ["fecha"],
  sku: ["sku"],
  articulo: ["articulo_insumo", "articulo", "insumo"],
  tipo: ["tipo_movimiento", "tipo"],
  cantidad: ["cantidad"],
  unidad: ["unidad"],
  origenDestino: ["origen_destino", "origen", "destino"],
  responsable: ["responsable"],
  folioOficio: ["folio_oficio", "folio", "oficio"],
  evidencia: ["evidencia_liga", "evidencia", "liga"],
  estatusMovimiento: ["estatus_movimiento", "estatus"],
  observaciones: ["observaciones", "observacion"],
  capturo: ["capturo"],
};

const state = {
  rawRows: [],
  rows: [],
  filteredRows: [],
  movements: [],
  loading: false,
  savingMovement: false,
  searchIsActive: false,
  lastLoadedAt: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  document.title = CONFIG.appName;
  bindElements();
  bindEvents();
  renderOperationStatus();
  loadInventory();
  loadMovements();

  window.setInterval(() => {
    if (shouldSkipAutomaticRefresh()) return;
    loadInventory({ silent: true });
    loadMovements({ silent: true });
  }, CONFIG.refreshIntervalMs);
});

function bindElements() {
  const ids = [
    "loadStatus",
    "visualUpdate",
    "kpiTotalItems",
    "kpiPhysicalStock",
    "kpiAvailableStock",
    "kpiReservedStock",
    "kpiRedItems",
    "kpiOutOfStock",
    "kpiPendingProvider",
    "kpiLastSync",
    "alertCount",
    "alertsList",
    "searchInput",
    "clearFiltersBtn",
    "refreshBtn",
    "categoryFilter",
    "semaphoreFilter",
    "unitFilter",
    "locationFilter",
    "tableCount",
    "errorMessage",
    "inventoryBody",
    "operationStatus",
    "openMovementModalBtn",
    "movementDialog",
    "movementForm",
    "movementFormMessage",
    "closeMovementModalBtn",
    "cancelMovementBtn",
    "saveMovementBtn",
    "movementType",
    "movementSku",
    "skuOptions",
    "movementArticle",
    "movementQuantity",
    "movementUnit",
    "movementOriginDestination",
    "movementResponsible",
    "movementFolio",
    "movementEvidence",
    "movementNotes",
    "movementCapturedBy",
    "movementCount",
    "movementsBody",
  ];

  ids.forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  elements.searchInput.addEventListener("input", applyFilters);
  elements.searchInput.addEventListener("focus", () => {
    state.searchIsActive = true;
  });
  elements.searchInput.addEventListener("blur", () => {
    state.searchIsActive = false;
  });

  [
    elements.categoryFilter,
    elements.semaphoreFilter,
    elements.unitFilter,
    elements.locationFilter,
  ].forEach((select) => select.addEventListener("change", applyFilters));

  elements.clearFiltersBtn.addEventListener("click", clearFilters);
  elements.refreshBtn.addEventListener("click", () => {
    loadInventory();
    loadMovements();
  });

  elements.openMovementModalBtn.addEventListener("click", openMovementModal);
  elements.closeMovementModalBtn.addEventListener("click", closeMovementModal);
  elements.cancelMovementBtn.addEventListener("click", closeMovementModal);
  elements.movementDialog.addEventListener("click", closeDialogFromBackdrop);
  elements.movementSku.addEventListener("input", syncMovementSkuFields);
  elements.movementForm.addEventListener("submit", handleMovementSubmit);
}

function shouldSkipAutomaticRefresh() {
  return (
    state.searchIsActive ||
    document.activeElement === elements.searchInput ||
    document.activeElement === elements.movementSku ||
    elements.movementDialog.open
  );
}

async function loadInventory(options = {}) {
  if (state.loading) return;

  state.loading = true;
  setLoadingState(options.silent ? "Actualizando en segundo plano..." : "Sincronizando...");
  hideError();

  try {
    const csvText = await fetchCSV(CONFIG.stockActualCsvUrl);
    const parsedCsv = parseCSVWithHeaders(csvText);
    console.log("Encabezados detectados:", parsedCsv.headers);
    console.log("URL usada:", CONFIG.stockActualCsvUrl);

    validateStockActualHeaders(parsedCsv.headers);

    const rawRows = parsedCsv.rows;
    const normalizedRows = rawRows.map(normalizeRow).filter(isUsefulRow);

    state.rawRows = rawRows;
    state.rows = sortInventory(normalizedRows);
    state.lastLoadedAt = new Date();

    renderFilters(state.rows);
    renderSkuOptions(state.rows);
    applyFilters();
    renderKPIs(state.rows);
    updateLastSync();
    setLoadingState("Datos actualizados");
  } catch (error) {
    console.error(error);
    showError(
      error instanceof StockActualHeaderError
        ? error.message
        : "No se pudieron cargar los datos del inventario. Verifica que la hoja esté publicada en CSV.",
    );
    setLoadingState("Error de carga");
  } finally {
    state.loading = false;
  }
}

async function loadMovements(options = {}) {
  if (!CONFIG.movimientosCsvUrl.trim()) {
    if (!state.movements.length || !options.silent) {
      renderMovementsTable(state.movements);
    }
    return;
  }

  try {
    const csvText = await fetchCSV(CONFIG.movimientosCsvUrl);
    const parsedCsv = parseCSVWithHeaders(csvText);
    state.movements = parsedCsv.rows.map(normalizeMovementRow).filter(isUsefulMovement);
    renderMovementsTable(state.movements);
  } catch (error) {
    console.error(error);
    if (!options.silent) {
      elements.movementsBody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">No se pudieron cargar los últimos movimientos.</div>
          </td>
        </tr>
      `;
    }
  }
}

async function fetchCSV(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`CSV request failed with status ${response.status}`);
  }
  return response.text();
}

function parseCSV(text) {
  return parseCSVWithHeaders(text).rows;
}

function parseCSVWithHeaders(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let insideQuotes = false;
  const cleanText = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < cleanText.length; index += 1) {
    const char = cleanText[index];
    const nextChar = cleanText[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length || currentRow.length) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  if (!rows.length) {
    return {
      headers: [],
      normalizedHeaders: [],
      rows: [],
    };
  }

  const headers = rows[0].map((header) => String(header || "").trim());
  const normalizedHeaders = headers.map((header, index) => {
    const key = normalizeKey(header);
    return key || `columna_${index + 1}`;
  });

  const dataRows = rows.slice(1).map((cells) => {
    const row = {};
    normalizedHeaders.forEach((header, index) => {
      row[header] = cells[index] === undefined ? "" : cells[index].trim();
    });
    return row;
  });

  return {
    headers,
    normalizedHeaders,
    rows: dataRows,
  };
}

function validateStockActualHeaders(headers) {
  const detectedHeaders = new Set(headers.map(normalizeKey));
  const missingHeaders = STOCK_ACTUAL_REQUIRED_HEADERS.filter(
    (header) => !detectedHeaders.has(normalizeKey(header)),
  );

  if (missingHeaders.length > 0) {
    throw new StockActualHeaderError(STOCK_ACTUAL_HEADER_ERROR);
  }
}

class StockActualHeaderError extends Error {
  constructor(message) {
    super(message);
    this.name = "StockActualHeaderError";
  }
}

function normalizeKey(header) {
  return String(header || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRow(row) {
  const getText = (field) => getFirstValue(row, FIELD_ALIASES[field]);
  const physicalValue = getText("existenciaFisica");
  const reservedValue = getText("comprometidoReservado");
  const availableValue = getText("disponibleReal");
  const minimumValue = getText("stockMinimo");
  const pendingProviderValue = getText("proveedorPendiente");

  const normalized = {
    original: row,
    searchText: Object.values(row).join(" ").toLowerCase(),
    sku: getText("sku"),
    categoria: getText("categoria"),
    articulo: getText("articulo"),
    descripcion: getText("descripcion"),
    unidad: getText("unidad"),
    ubicacion: getText("ubicacion"),
    existenciaInicial: makeNumberField(getText("existenciaInicial")),
    entradas: makeNumberField(getText("entradas")),
    salidas: makeNumberField(getText("salidas")),
    ajustesNetos: makeNumberField(getText("ajustesNetos")),
    existenciaFisica: makeNumberField(physicalValue),
    comprometidoReservado: makeNumberField(reservedValue),
    disponibleReal: makeNumberField(availableValue),
    stockMinimo: makeNumberField(minimumValue),
    semaforo: normalizeSemaphore(getText("semaforo")),
    proveedorPendiente: makeNumberField(pendingProviderValue),
    ultimaActualizacion: getText("ultimaActualizacion"),
    responsable: getText("responsable"),
    observaciones: getText("observaciones"),
  };

  if (!normalized.disponibleReal.hasValue && normalized.existenciaFisica.hasValue) {
    normalized.disponibleReal = makeNumberField(
      normalized.existenciaFisica.value - normalized.comprometidoReservado.value,
      true,
    );
  }

  if (!normalized.semaforo) {
    normalized.semaforo = deriveSemaphore(normalized);
  }

  return normalized;
}

function normalizeMovementRow(row) {
  const getText = (field) => getFirstValue(row, MOVEMENT_ALIASES[field]);
  const movement = {
    fecha: getText("fecha"),
    sku: getText("sku"),
    articulo: getText("articulo"),
    tipo: getText("tipo"),
    cantidad: makeNumberField(getText("cantidad")),
    unidad: getText("unidad"),
    origenDestino: getText("origenDestino"),
    responsable: getText("responsable"),
    folioOficio: getText("folioOficio"),
    evidencia: getText("evidencia"),
    estatusMovimiento: getText("estatusMovimiento"),
    observaciones: getText("observaciones"),
    capturo: getText("capturo"),
  };

  movement.sortTime = getMovementSortTime(movement.fecha);
  return movement;
}

function getFirstValue(row, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias) && String(row[alias]).trim() !== "") {
      return row[alias];
    }
  }
  return "";
}

function makeNumberField(value, forced = false) {
  const hasValue = forced || String(value ?? "").trim() !== "";
  return {
    value: parseNumber(value),
    hasValue,
  };
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/\s/g, "").replace(/\$/g, "");
  const decimalComma = /^[+-]?\d+,\d{1,2}$/.test(cleaned);
  const normalized = decimalComma ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSemaphore(value) {
  const normalized = normalizeKey(value);
  if (!normalized) return "";
  if (normalized.includes("sin_stock") || normalized.includes("agotado")) return "SIN STOCK";
  if (normalized.includes("rojo") || normalized.includes("critico")) return "ROJO";
  if (normalized.includes("amarillo") || normalized.includes("preventivo")) return "AMARILLO";
  if (normalized.includes("verde") || normalized.includes("ok")) return "VERDE";
  return String(value || "").trim().toUpperCase();
}

function deriveSemaphore(row) {
  const available = row.disponibleReal;
  const physical = row.existenciaFisica;
  const minimum = row.stockMinimo;

  if ((available.hasValue && available.value <= 0) || (physical.hasValue && physical.value <= 0)) {
    return "SIN STOCK";
  }

  if (available.hasValue && minimum.hasValue && available.value <= minimum.value) {
    return "ROJO";
  }

  if (available.hasValue && minimum.hasValue && available.value <= minimum.value * 1.5) {
    return "AMARILLO";
  }

  if (available.hasValue || physical.hasValue) {
    return "VERDE";
  }

  return "";
}

function isUsefulRow(row) {
  return Boolean(
    row.sku ||
      row.articulo ||
      row.descripcion ||
      row.categoria ||
      row.observaciones ||
      row.existenciaFisica.hasValue,
  );
}

function isUsefulMovement(movement) {
  return Boolean(movement.fecha || movement.sku || movement.articulo || movement.tipo);
}

function sortInventory(rows) {
  return [...rows].sort((a, b) => {
    const rankDiff = getSemaphoreRank(a.semaforo) - getSemaphoreRank(b.semaforo);
    if (rankDiff !== 0) return rankDiff;
    return (a.articulo || a.sku).localeCompare(b.articulo || b.sku, "es");
  });
}

function getSemaphoreRank(value) {
  const semaphore = normalizeSemaphore(value);
  if (semaphore === "SIN STOCK") return 0;
  if (semaphore === "ROJO") return 1;
  if (semaphore === "AMARILLO") return 2;
  if (semaphore === "VERDE") return 3;
  return 4;
}

function renderKPIs(data) {
  const sums = data.reduce(
    (accumulator, row) => {
      accumulator.physical += row.existenciaFisica.value;
      accumulator.available += row.disponibleReal.value;
      accumulator.reserved += row.comprometidoReservado.value;
      accumulator.pendingProvider += row.proveedorPendiente.value;
      accumulator.hasPhysical = accumulator.hasPhysical || row.existenciaFisica.hasValue;
      accumulator.hasAvailable = accumulator.hasAvailable || row.disponibleReal.hasValue;
      accumulator.hasReserved = accumulator.hasReserved || row.comprometidoReservado.hasValue;
      accumulator.hasPendingProvider =
        accumulator.hasPendingProvider || row.proveedorPendiente.hasValue;
      if (normalizeSemaphore(row.semaforo) === "ROJO") accumulator.red += 1;
      if (normalizeSemaphore(row.semaforo) === "SIN STOCK") accumulator.outOfStock += 1;
      return accumulator;
    },
    {
      physical: 0,
      available: 0,
      reserved: 0,
      pendingProvider: 0,
      hasPhysical: false,
      hasAvailable: false,
      hasReserved: false,
      hasPendingProvider: false,
      red: 0,
      outOfStock: 0,
    },
  );

  elements.kpiTotalItems.textContent = formatNumber(data.length, true);
  elements.kpiPhysicalStock.textContent = formatNumber(sums.physical, sums.hasPhysical);
  elements.kpiAvailableStock.textContent = formatNumber(sums.available, sums.hasAvailable);
  elements.kpiReservedStock.textContent = formatNumber(sums.reserved, sums.hasReserved);
  elements.kpiRedItems.textContent = formatNumber(sums.red, true);
  elements.kpiOutOfStock.textContent = formatNumber(sums.outOfStock, true);
  elements.kpiPendingProvider.textContent = formatNumber(
    sums.pendingProvider,
    sums.hasPendingProvider,
  );
  elements.kpiLastSync.textContent = state.lastLoadedAt ? formatTime(state.lastLoadedAt) : "—";
}

function renderAlerts(data) {
  const alerts = data
    .filter((row) => ["SIN STOCK", "ROJO"].includes(normalizeSemaphore(row.semaforo)))
    .slice(0, 9);

  elements.alertCount.textContent = `${alerts.length} ${alerts.length === 1 ? "alerta" : "alertas"}`;

  if (!alerts.length) {
    elements.alertsList.innerHTML =
      '<div class="positive-state">Sin artículos en rojo o sin stock en la lectura actual.</div>';
    return;
  }

  elements.alertsList.innerHTML = alerts
    .map((row) => {
      const isCritical = normalizeSemaphore(row.semaforo) === "SIN STOCK";
      return `
        <article class="alert-item ${isCritical ? "critical" : ""}">
          <strong>${escapeHTML(row.articulo || row.sku || "Artículo sin nombre")}</strong>
          <span>${escapeHTML(row.sku || "—")} · Disponible: ${escapeHTML(
            formatNumber(row.disponibleReal.value, row.disponibleReal.hasValue),
          )} · ${escapeHTML(row.ubicacion || "Ubicación pendiente")}</span>
        </article>
      `;
    })
    .join("");
}

function renderFilters(data) {
  const previousValues = {
    category: elements.categoryFilter.value,
    semaphore: elements.semaphoreFilter.value,
    unit: elements.unitFilter.value,
    location: elements.locationFilter.value,
  };

  fillSelect(elements.categoryFilter, uniqueValues(data, "categoria"), "Todas");
  fillSelect(elements.semaphoreFilter, uniqueValues(data, "semaforo"), "Todos");
  fillSelect(elements.unitFilter, uniqueValues(data, "unidad"), "Todas");
  fillSelect(elements.locationFilter, uniqueValues(data, "ubicacion"), "Todas");

  restoreSelectValue(elements.categoryFilter, previousValues.category);
  restoreSelectValue(elements.semaphoreFilter, previousValues.semaphore);
  restoreSelectValue(elements.unitFilter, previousValues.unit);
  restoreSelectValue(elements.locationFilter, previousValues.location);
}

function restoreSelectValue(select, value) {
  if ([...select.options].some((option) => option.value === value)) {
    select.value = value;
  }
}

function uniqueValues(data, field) {
  return [...new Set(data.map((row) => row[field]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

function fillSelect(select, values, defaultLabel) {
  const options = [`<option value="">${escapeHTML(defaultLabel)}</option>`]
    .concat(
      values.map(
        (value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`,
      ),
    )
    .join("");
  select.innerHTML = options;
}

function renderSkuOptions(data) {
  elements.skuOptions.innerHTML = data
    .filter((row) => row.sku)
    .sort((a, b) => a.sku.localeCompare(b.sku, "es"))
    .map(
      (row) =>
        `<option value="${escapeHTML(row.sku)}" label="${escapeHTML(row.articulo || row.descripcion || "")}"></option>`,
    )
    .join("");
}

function clearFilters() {
  elements.searchInput.value = "";
  elements.categoryFilter.value = "";
  elements.semaphoreFilter.value = "";
  elements.unitFilter.value = "";
  elements.locationFilter.value = "";
  applyFilters();
}

function applyFilters() {
  const searchTerm = normalizeKey(elements.searchInput.value);
  const category = elements.categoryFilter.value;
  const semaphore = elements.semaphoreFilter.value;
  const unit = elements.unitFilter.value;
  const location = elements.locationFilter.value;

  state.filteredRows = state.rows.filter((row) => {
    const searchMatch =
      !searchTerm ||
      normalizeKey(
        [
          row.searchText,
          row.sku,
          row.articulo,
          row.descripcion,
          row.categoria,
          row.unidad,
          row.ubicacion,
          row.responsable,
          row.observaciones,
        ].join(" "),
      ).includes(searchTerm);

    return (
      searchMatch &&
      matchesFilter(row.categoria, category) &&
      matchesFilter(row.semaforo, semaphore) &&
      matchesFilter(row.unidad, unit) &&
      matchesFilter(row.ubicacion, location)
    );
  });

  renderAlerts(state.filteredRows);
  renderInventoryTable(state.filteredRows);
}

function matchesFilter(value, selectedValue) {
  return !selectedValue || value === selectedValue;
}

function renderInventoryTable(data) {
  elements.tableCount.textContent = `${data.length} ${data.length === 1 ? "registro" : "registros"}`;

  if (!data.length) {
    elements.inventoryBody.innerHTML = `
      <tr>
        <td colspan="12">
          <div class="empty-state">No hay registros que coincidan con los filtros actuales.</div>
        </td>
      </tr>
    `;
    return;
  }

  elements.inventoryBody.innerHTML = data
    .map(
      (row) => `
      <tr>
        <td class="sku-cell">${escapeHTML(displayValue(row.sku))}</td>
        <td>${escapeHTML(displayValue(row.categoria))}</td>
        <td class="article-cell">${escapeHTML(displayValue(row.articulo))}</td>
        <td>${escapeHTML(displayValue(row.unidad))}</td>
        <td class="number-cell">${escapeHTML(
          formatNumber(row.existenciaFisica.value, row.existenciaFisica.hasValue),
        )}</td>
        <td class="number-cell">${escapeHTML(
          formatNumber(row.comprometidoReservado.value, row.comprometidoReservado.hasValue),
        )}</td>
        <td class="number-cell">${escapeHTML(
          formatNumber(row.disponibleReal.value, row.disponibleReal.hasValue),
        )}</td>
        <td class="number-cell">${escapeHTML(
          formatNumber(row.stockMinimo.value, row.stockMinimo.hasValue),
        )}</td>
        <td>${renderSemaphoreChip(row.semaforo)}</td>
        <td>${escapeHTML(displayValue(row.ubicacion))}</td>
        <td>${escapeHTML(displayValue(row.responsable))}</td>
        <td class="notes-cell">${escapeHTML(displayValue(row.observaciones))}</td>
      </tr>
    `,
    )
    .join("");
}

function renderSemaphoreChip(value) {
  const semaphore = normalizeSemaphore(value);
  const chipClass = {
    VERDE: "green",
    AMARILLO: "amber",
    ROJO: "red",
    "SIN STOCK": "critical",
  }[semaphore];

  if (!chipClass) {
    return '<span class="chip neutral">—</span>';
  }

  return `<span class="chip ${chipClass}">${escapeHTML(semaphore)}</span>`;
}

function renderOperationStatus(message) {
  const connected = Boolean(CONFIG.appsScriptUrl.trim());
  elements.operationStatus.classList.toggle("connected", connected);
  elements.operationStatus.textContent =
    message ||
    (connected
      ? "Conexión a Apps Script configurada. Los movimientos se registrarán en MOVIMIENTOS."
      : "Registro pendiente de conexión a Apps Script.");
}

function renderMovementsTable(movements) {
  const orderedMovements = [...movements]
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 25);

  elements.movementCount.textContent = `${orderedMovements.length} ${
    orderedMovements.length === 1 ? "movimiento" : "movimientos"
  }`;

  if (!orderedMovements.length) {
    elements.movementsBody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">Últimos movimientos pendientes de conexión.</div>
        </td>
      </tr>
    `;
    return;
  }

  elements.movementsBody.innerHTML = orderedMovements
    .map(
      (movement) => `
        <tr>
          <td>${escapeHTML(displayValue(movement.fecha))}</td>
          <td class="sku-cell">${escapeHTML(displayValue(movement.sku))}</td>
          <td>${escapeHTML(displayValue(movement.articulo))}</td>
          <td>${escapeHTML(displayValue(movement.tipo))}</td>
          <td class="number-cell">${escapeHTML(
            formatNumber(movement.cantidad.value, movement.cantidad.hasValue),
          )}</td>
          <td>${escapeHTML(displayValue(movement.responsable))}</td>
          <td>${escapeHTML(displayValue(movement.folioOficio))}</td>
          <td class="notes-cell">${escapeHTML(displayValue(movement.observaciones))}</td>
        </tr>
      `,
    )
    .join("");
}

function getMovementSortTime(value) {
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;
  return 0;
}

function openMovementModal() {
  resetMovementForm();
  renderOperationStatus();
  if (typeof elements.movementDialog.showModal === "function") {
    elements.movementDialog.showModal();
  } else {
    elements.movementDialog.setAttribute("open", "");
  }
  elements.movementSku.focus();
}

function closeMovementModal() {
  hideMovementMessage();
  if (elements.movementDialog.open && typeof elements.movementDialog.close === "function") {
    elements.movementDialog.close();
  } else {
    elements.movementDialog.removeAttribute("open");
  }
}

function closeDialogFromBackdrop(event) {
  if (event.target === elements.movementDialog) {
    closeMovementModal();
  }
}

function resetMovementForm() {
  elements.movementForm.reset();
  elements.movementType.value = "ENTRADA";
  elements.movementArticle.value = "";
  elements.movementUnit.value = "";
  hideMovementMessage();
  setSaveButtonLoading(false);
}

function syncMovementSkuFields() {
  const item = findInventoryBySku(elements.movementSku.value);
  elements.movementArticle.value = item ? item.articulo || item.descripcion || "" : "";
  elements.movementUnit.value = item ? item.unidad || "" : "";
}

async function handleMovementSubmit(event) {
  event.preventDefault();
  hideMovementMessage();

  const validation = validateMovementForm();
  if (!validation.ok) {
    showMovementMessage(validation.message, "error");
    return;
  }

  const movement = validation.movement;
  if (
    NEGATIVE_MOVEMENT_TYPES.has(movement.tipo) &&
    !window.confirm(`Confirmar ${movement.tipo} por ${formatNumber(movement.cantidad, true)} ${movement.unidad}.`)
  ) {
    return;
  }

  if (!CONFIG.appsScriptUrl.trim()) {
    showMovementMessage("Registro pendiente de conexión a Apps Script.", "info");
    renderOperationStatus("Registro pendiente de conexión a Apps Script.");
    return;
  }

  try {
    setSaveButtonLoading(true);
    const response = await postMovement(movement);
    if (!response.ok) {
      throw new Error(response.message || "No se pudo registrar el movimiento.");
    }

    showMovementMessage(response.message || "Movimiento registrado correctamente", "success");
    addLocalMovement(movement);
    renderOperationStatus("Movimiento registrado correctamente.");
    await loadInventory({ silent: true });
    if (CONFIG.movimientosCsvUrl.trim()) {
      await loadMovements({ silent: true });
    }
    window.setTimeout(closeMovementModal, 900);
  } catch (error) {
    console.error(error);
    showMovementMessage(error.message || "No se pudo registrar el movimiento.", "error");
  } finally {
    setSaveButtonLoading(false);
  }
}

function validateMovementForm() {
  const sku = elements.movementSku.value.trim();
  const item = findInventoryBySku(sku);
  const tipo = elements.movementType.value.trim().toUpperCase();
  const cantidadText = elements.movementQuantity.value.trim();
  const cantidad = parseNumber(cantidadText);

  if (!MOVEMENT_TYPES.includes(tipo)) {
    return { ok: false, message: "Selecciona un tipo de movimiento válido." };
  }

  if (!sku) {
    return { ok: false, message: "Captura un SKU." };
  }

  if (!item) {
    return { ok: false, message: "El SKU capturado no existe en STOCK_ACTUAL." };
  }

  if (!cantidadText) {
    return { ok: false, message: "Captura la cantidad del movimiento." };
  }

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { ok: false, message: "La cantidad debe ser mayor a cero." };
  }

  if (NEGATIVE_MOVEMENT_TYPES.has(tipo) && cantidad > item.disponibleReal.value) {
    return {
      ok: false,
      message: `No hay suficiente stock disponible. Disponible real: ${formatNumber(
        item.disponibleReal.value,
        item.disponibleReal.hasValue,
      )}.`,
    };
  }

  return {
    ok: true,
    movement: {
      sku: item.sku,
      articulo: item.articulo || item.descripcion || "",
      tipo,
      cantidad,
      unidad: item.unidad || "",
      origenDestino: elements.movementOriginDestination.value.trim(),
      responsable: elements.movementResponsible.value.trim(),
      folioOficio: elements.movementFolio.value.trim(),
      evidencia: elements.movementEvidence.value.trim(),
      observaciones: elements.movementNotes.value.trim(),
      capturo: elements.movementCapturedBy.value.trim(),
    },
  };
}

function findInventoryBySku(value) {
  const requestedSku = normalizeKey(value);
  if (!requestedSku) return null;
  return state.rows.find((row) => normalizeKey(row.sku) === requestedSku) || null;
}

async function postMovement(movement) {
  const payload = {
    action: "createMovement",
    movement: {
      sku: movement.sku,
      tipo: movement.tipo,
      cantidad: movement.cantidad,
      origenDestino: movement.origenDestino,
      responsable: movement.responsable,
      folioOficio: movement.folioOficio,
      evidencia: movement.evidencia,
      observaciones: movement.observaciones,
      capturo: movement.capturo,
    },
  };

  const response = await fetch(CONFIG.appsScriptUrl.trim(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("El endpoint no respondió con JSON válido.");
  }

  if (!response.ok) {
    throw new Error(parsed.message || `Error HTTP ${response.status}`);
  }

  return parsed;
}

function addLocalMovement(movement) {
  const localMovement = {
    fecha: formatTime(new Date()),
    sku: movement.sku,
    articulo: movement.articulo,
    tipo: movement.tipo,
    cantidad: { value: movement.cantidad, hasValue: true },
    unidad: movement.unidad,
    origenDestino: movement.origenDestino,
    responsable: movement.responsable,
    folioOficio: movement.folioOficio,
    evidencia: movement.evidencia,
    estatusMovimiento: "APLICADO",
    observaciones: movement.observaciones,
    capturo: movement.capturo,
    sortTime: Date.now(),
  };

  state.movements = [localMovement, ...state.movements].slice(0, 25);
  renderMovementsTable(state.movements);
}

function showMovementMessage(message, type) {
  elements.movementFormMessage.hidden = false;
  elements.movementFormMessage.classList.remove("success", "info");
  if (type === "success") elements.movementFormMessage.classList.add("success");
  if (type === "info") elements.movementFormMessage.classList.add("info");
  elements.movementFormMessage.textContent = message;
}

function hideMovementMessage() {
  elements.movementFormMessage.hidden = true;
  elements.movementFormMessage.classList.remove("success", "info");
  elements.movementFormMessage.textContent = "";
}

function setSaveButtonLoading(isLoading) {
  state.savingMovement = isLoading;
  elements.saveMovementBtn.disabled = isLoading;
  elements.saveMovementBtn.textContent = isLoading ? "Guardando..." : "Guardar movimiento";
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function displayValue(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function formatNumber(value, hasValue = true) {
  if (!hasValue) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: Number.isInteger(number) ? 0 : 2,
  }).format(number);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function updateLastSync() {
  const text = state.lastLoadedAt ? `Actualizado ${formatTime(state.lastLoadedAt)}` : "—";
  elements.visualUpdate.textContent = text;
}

function setLoadingState(message) {
  elements.loadStatus.textContent = message;
}

function showError(message) {
  elements.errorMessage.hidden = false;
  elements.errorMessage.textContent = message;
}

function hideError() {
  elements.errorMessage.hidden = true;
  elements.errorMessage.textContent = "";
}

window.InventoryBodega = {
  CONFIG,
  parseCSV,
  normalizeKey,
  normalizeRow,
  parseNumber,
  getSemaphoreRank,
  escapeHTML,
  formatNumber,
  loadInventory,
  loadMovements,
};
