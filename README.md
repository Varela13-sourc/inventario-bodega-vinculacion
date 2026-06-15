# inventario-bodega-vinculacion

App web independiente para consultar el inventario de la bodega de Vinculacion Ciudadana del Gobierno del Estado de Chihuahua.

La app es autonoma: no incluye login, menu global, rutas internas ni integraciones con otros sistemas. Puede abrirse directamente como sitio estatico desde `index.html` y tambien puede publicarse como sitio independiente en GitHub Pages.

## Archivos

- `index.html`: estructura de la app.
- `styles.css`: estilos visuales del dashboard, filtros, tabla y vista responsive.
- `app.js`: configuracion, lectura del CSV, validacion de encabezados, filtros, KPIs, alertas, semaforos y refresco automatico.
- `version.txt`: datos de version y fuente de informacion.

## Fuente de datos

La fuente principal es la pestana publicada en CSV de `STOCK_ACTUAL`.

El archivo `app.js` mantiene la configuracion en `CONFIG`:

```js
const CONFIG = {
  stockActualCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3YzCfkRrc-osRMQ9WWQxJLvoKjMgyHe4b_-GpwpeDCNfWrIfoA90GGKO2SAkaPV1yMZwsG2T6oMkz/pub?gid=265782808&single=true&output=csv",
  refreshIntervalMs: 60000,
  appName: "Inventario Bodega · Vinculacion Ciudadana"
};
```

Si se publica otra pestana o cambia el archivo, reemplaza `stockActualCsvUrl` por la nueva URL CSV publicada de `STOCK_ACTUAL`.

## Validacion

La app solo acepta una hoja que contenga estos encabezados minimos:

- `SKU`
- `Categoria`
- `Articulo / Insumo`
- `Unidad`
- `Existencia fisica`
- `Disponible real`
- `Stock minimo`
- `Semaforo`

Si la URL apunta a otra pestana, muestra:

```text
La URL CSV no corresponde a STOCK_ACTUAL. Copia la URL publicada en CSV de la pestaña STOCK_ACTUAL.
```

## Funcionalidad

- Dashboard ejecutivo.
- Filtros por busqueda, categoria, semaforo, unidad y ubicacion.
- Tabla de inventario.
- Semaforos visuales.
- Alertas de atencion inmediata.
- Refresco manual y automatico cada 60 segundos.
- Modulo visual de entradas y salidas preparado, deshabilitado hasta conectar Apps Script.

## Publicación en GitHub Pages

1. Crear un repositorio nuevo.
2. Subir los 4 archivos principales: `index.html`, `styles.css`, `app.js` y `README.md`.
3. Subir tambien `version.txt` si se desea conservar el archivo de version.
4. Ir a `Settings > Pages`.
5. En `Build and deployment`, publicar desde el branch `main` y la carpeta `root`.
6. Abrir la URL publica que genere GitHub Pages.
