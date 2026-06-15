# inventario-bodega-vinculacion

App web independiente para consultar y operar el inventario de la bodega de Vinculación Ciudadana del Gobierno del Estado de Chihuahua.

La app es autónoma: no incluye login, menú global, rutas internas ni integraciones con otros sistemas. Puede abrirse directamente como sitio estático desde `index.html` y puede publicarse como sitio independiente en GitHub Pages.

## Archivos

- `index.html`: estructura de la app, dashboard, filtros, tabla, operaciones y modal.
- `styles.css`: diseño institucional moderno con inspiración de archivo ejecutivo.
- `app.js`: configuración, lectura de CSV, validación de encabezados, KPIs, filtros, movimientos y guardado por Apps Script.
- `apps-script.gs`: código listo para copiarse en Google Apps Script.
- `README.md`: guía de publicación y conexión.
- `version.txt`: datos de versión y fuente de información.

## Fuente de datos

La fuente ejecutiva es la pestaña publicada en CSV de `STOCK_ACTUAL`.

En `app.js`, revisa este bloque:

```js
const CONFIG = {
  stockActualCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3YzCfkRrc-osRMQ9WWQxJLvoKjMgyHe4b_-GpwpeDCNfWrIfoA90GGKO2SAkaPV1yMZwsG2T6oMkz/pub?gid=265782808&single=true&output=csv",
  movimientosCsvUrl: "",
  appsScriptUrl: "",
  refreshIntervalMs: 60000,
  appName: "Inventario Bodega · Vinculación Ciudadana"
};
```

`stockActualCsvUrl` debe apuntar a la pestaña `STOCK_ACTUAL`. El GID actual correcto es `265782808`.

Si quieres mostrar la tabla de últimos movimientos desde Sheets, publica la pestaña `MOVIMIENTOS` como CSV y pega su URL en `movimientosCsvUrl`.

## Validación de STOCK_ACTUAL

La app solo acepta una hoja que contenga estos encabezados mínimos:

- `SKU`
- `Categoría`
- `Artículo / Insumo`
- `Unidad`
- `Existencia física`
- `Disponible real`
- `Stock mínimo`
- `Semáforo`

Si la URL apunta a otra pestaña, muestra:

```text
La URL CSV no corresponde a STOCK_ACTUAL. Copia la URL publicada en CSV de la pestaña STOCK_ACTUAL.
```

## Publicación en GitHub Pages

1. Crear un repositorio nuevo.
2. Subir los archivos `index.html`, `styles.css`, `app.js`, `README.md`, `version.txt` y, como referencia técnica, `apps-script.gs`.
3. Ir a `Settings > Pages`.
4. En `Build and deployment`, seleccionar el branch `main`.
5. Seleccionar la carpeta `root`.
6. Guardar y abrir la URL pública que genere GitHub Pages.

## Conectar Google Sheets publicado en CSV

1. Abrir el Google Sheets del inventario.
2. Ir a `Archivo > Compartir > Publicar en la web`.
3. Publicar la pestaña `STOCK_ACTUAL` en formato CSV.
4. Copiar la URL publicada.
5. Pegar esa URL en `CONFIG.stockActualCsvUrl`.
6. Confirmar que la app cargue 50 registros y que la existencia física total sea `1,930`.

## Crear y desplegar Apps Script

1. Abrir el Google Sheets editable del inventario.
2. Ir a `Extensiones > Apps Script`.
3. Crear un proyecto nuevo o usar el proyecto asociado a la hoja.
4. Copiar el contenido de `apps-script.gs` en el editor.
5. Confirmar que `spreadsheetId` corresponda al archivo editable.
6. Guardar el proyecto.
7. Ir a `Implementar > Nueva implementación`.
8. Elegir tipo `Aplicación web`.
9. Configurar `Ejecutar como: Yo`.
10. Configurar acceso según la política interna. Para una app publicada en GitHub Pages normalmente se usa `Cualquier usuario con el enlace`.
11. Autorizar permisos cuando Google lo solicite.
12. Copiar la URL del Web App que termina en `/exec`.

## Dónde pegar la URL del Web App

Pega la URL del Web App en `app.js`:

```js
appsScriptUrl: "PEGAR_AQUI_LA_URL_DEL_WEB_APP"
```

Ese valor debe ser la URL pública de la implementación de Apps Script, normalmente con terminación `/exec`.

Si `appsScriptUrl` está vacío, la app seguirá cargando el inventario y mostrará:

```text
Registro pendiente de conexión a Apps Script.
```

## Permisos necesarios

El Apps Script necesita permiso para:

- Leer la hoja `STOCK_ACTUAL`.
- Leer o crear la hoja `MOVIMIENTOS`.
- Insertar filas nuevas en `MOVIMIENTOS`.

La app web no escribe directamente en `STOCK_ACTUAL`. El inventario debe actualizarse mediante fórmulas de Google Sheets a partir de `MOVIMIENTOS`.

## Probar una entrada

1. Configurar `appsScriptUrl`.
2. Abrir la app publicada.
3. Presionar `Registrar movimiento`.
4. Elegir `ENTRADA`.
5. Capturar un SKU existente.
6. Capturar cantidad mayor a cero.
7. Capturar responsable y observaciones si aplica.
8. Guardar.
9. Confirmar que aparezca `Movimiento registrado correctamente`.
10. Revisar que se haya agregado una fila en `MOVIMIENTOS` con estatus `APLICADO`.

## Probar una salida

1. Presionar `Registrar movimiento`.
2. Elegir `SALIDA`.
3. Capturar un SKU existente.
4. Capturar una cantidad menor o igual al disponible real.
5. Confirmar la salida cuando la app lo solicite.
6. Guardar.
7. Revisar la fila nueva en `MOVIMIENTOS`.
8. Capturar una salida mayor al disponible real para confirmar que la app la rechaza.

## Errores frecuentes

- Endpoint vacío: pega la URL del Web App en `CONFIG.appsScriptUrl`.
- Error de CORS: confirma que la implementación sea una aplicación web publicada, que uses la URL terminada en `/exec` y que el acceso permita recibir solicitudes desde la app publicada.
- Error de permisos: vuelve a desplegar Apps Script y autoriza el acceso a Google Sheets.
- SKU inexistente: confirma que el SKU esté en `STOCK_ACTUAL`.
- Stock insuficiente: revisa la columna `Disponible real` en `STOCK_ACTUAL`.

## Estructura esperada de MOVIMIENTOS

La hoja `MOVIMIENTOS` debe contener:

- `Fecha`
- `SKU`
- `Artículo / Insumo`
- `Tipo movimiento`
- `Cantidad`
- `Unidad`
- `Origen / Destino`
- `Responsable`
- `Folio / oficio`
- `Evidencia / liga`
- `Estatus movimiento`
- `Observaciones`
- `Capturó`
