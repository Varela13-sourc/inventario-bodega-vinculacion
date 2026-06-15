const INVENTARIO_CONFIG = {
  spreadsheetId: "1jX8QeKa6kqT3HtDyN6Oib7PMeH7_DCaP4hzB26j264c",
  stockSheetName: "STOCK_ACTUAL",
  movementsSheetName: "MOVIMIENTOS",
};

const MOVEMENT_HEADERS = [
  "Fecha",
  "SKU",
  "Artículo / Insumo",
  "Tipo movimiento",
  "Cantidad",
  "Unidad",
  "Origen / Destino",
  "Responsable",
  "Folio / oficio",
  "Evidencia / liga",
  "Estatus movimiento",
  "Observaciones",
  "Capturó",
];

const VALID_MOVEMENT_TYPES = ["ENTRADA", "SALIDA", "AJUSTE+", "AJUSTE-", "TRASLADO"];
const NEGATIVE_MOVEMENT_TYPES = ["SALIDA", "AJUSTE-"];

function doPost(e) {
  try {
    const payload = parsePayload(e);

    if (payload.action !== "createMovement") {
      throw new Error("Acción no soportada.");
    }

    const result = registerMovement(payload.movement);
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error.message || "No se pudo registrar el movimiento.",
    });
  }
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Payload vacío.");
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error("Payload JSON inválido.");
  }
}

function registerMovement(movement) {
  const cleanMovement = validateMovementPayload(movement);
  const stockItem = findSkuInStockActual(cleanMovement.sku);

  if (
    NEGATIVE_MOVEMENT_TYPES.indexOf(cleanMovement.tipo) !== -1 &&
    cleanMovement.cantidad > stockItem.disponibleReal
  ) {
    throw new Error(
      "No hay suficiente stock disponible. Disponible real: " + stockItem.disponibleReal + ".",
    );
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const spreadsheet = SpreadsheetApp.openById(INVENTARIO_CONFIG.spreadsheetId);
    const movementsSheet = getOrCreateMovementsSheet(spreadsheet);

    movementsSheet.appendRow([
      new Date(),
      stockItem.sku,
      stockItem.articulo,
      cleanMovement.tipo,
      cleanMovement.cantidad,
      stockItem.unidad,
      cleanMovement.origenDestino,
      cleanMovement.responsable,
      cleanMovement.folioOficio,
      cleanMovement.evidencia,
      "APLICADO",
      cleanMovement.observaciones,
      cleanMovement.capturo,
    ]);
  } finally {
    lock.releaseLock();
  }

  return {
    ok: true,
    message: "Movimiento registrado correctamente",
  };
}

function validateMovementPayload(movement) {
  if (!movement || typeof movement !== "object") {
    throw new Error("Movimiento vacío o inválido.");
  }

  const sku = String(movement.sku || "").trim();
  const tipo = String(movement.tipo || "").trim().toUpperCase();
  const cantidad = parseNumber(movement.cantidad);

  if (!sku) {
    throw new Error("SKU obligatorio.");
  }

  if (VALID_MOVEMENT_TYPES.indexOf(tipo) === -1) {
    throw new Error("Tipo de movimiento inválido.");
  }

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error("La cantidad debe ser mayor a cero.");
  }

  return {
    sku: sku,
    tipo: tipo,
    cantidad: cantidad,
    origenDestino: String(movement.origenDestino || "").trim(),
    responsable: String(movement.responsable || "").trim(),
    folioOficio: String(movement.folioOficio || "").trim(),
    evidencia: String(movement.evidencia || "").trim(),
    observaciones: String(movement.observaciones || "").trim(),
    capturo: String(movement.capturo || "").trim(),
  };
}

function findSkuInStockActual(sku) {
  const spreadsheet = SpreadsheetApp.openById(INVENTARIO_CONFIG.spreadsheetId);
  const stockSheet = spreadsheet.getSheetByName(INVENTARIO_CONFIG.stockSheetName);

  if (!stockSheet) {
    throw new Error("No existe la hoja STOCK_ACTUAL.");
  }

  const values = stockSheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    throw new Error("STOCK_ACTUAL no tiene datos.");
  }

  const headerMap = getHeaderMap(values[0]);
  const skuIndex = requireHeader(headerMap, "SKU");
  const articleIndex = requireHeader(headerMap, "Artículo / Insumo");
  const unitIndex = requireHeader(headerMap, "Unidad");
  const availableIndex = requireHeader(headerMap, "Disponible real");

  const normalizedRequestedSku = normalizeHeader(sku);

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const currentSku = String(row[skuIndex] || "").trim();

    if (normalizeHeader(currentSku) === normalizedRequestedSku) {
      return {
        sku: currentSku,
        articulo: String(row[articleIndex] || "").trim(),
        unidad: String(row[unitIndex] || "").trim(),
        disponibleReal: parseNumber(row[availableIndex]),
      };
    }
  }

  throw new Error("El SKU no existe en STOCK_ACTUAL.");
}

function getOrCreateMovementsSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(INVENTARIO_CONFIG.movementsSheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(INVENTARIO_CONFIG.movementsSheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(MOVEMENT_HEADERS);
    return sheet;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const headerMap = getHeaderMap(currentHeaders);
  const hasAllHeaders = MOVEMENT_HEADERS.every((header) =>
    Object.prototype.hasOwnProperty.call(headerMap, normalizeHeader(header)),
  );

  if (!hasAllHeaders) {
    throw new Error("La hoja MOVIMIENTOS no tiene la estructura esperada.");
  }

  return sheet;
}

function getHeaderMap(headers) {
  return headers.reduce((map, header, index) => {
    const key = normalizeHeader(header);
    if (key) {
      map[key] = index;
    }
    return map;
  }, {});
}

function requireHeader(headerMap, header) {
  const key = normalizeHeader(header);
  if (!Object.prototype.hasOwnProperty.call(headerMap, key)) {
    throw new Error("Falta encabezado requerido: " + header + ".");
  }
  return headerMap[key];
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value || "").trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/\s/g, "").replace(/\$/g, "");
  const decimalComma = /^[+-]?\d+,\d{1,2}$/.test(cleaned);
  const normalized = decimalComma ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
