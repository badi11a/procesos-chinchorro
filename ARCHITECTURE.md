# Arquitectura y transición a Angular

El sitio sigue siendo una aplicación estática publicada por GitHub Pages.

## Estructura actual

```text
index.html              Punto de entrada estático
src/main.js             Inicio, estado, rutas y renderizado actual
src/styles.css          Estilos de la interfaz
src/assets/data.json    Datos del mapa de procesos
```

## Migración futura

Al adoptar Angular:

1. Crear el espacio de trabajo Angular sin reemplazar `src/assets/data.json`.
2. Migrar `src/main.js` a `src/main.ts`.
3. Dividir la interfaz en componentes de mapa, navegación lateral y detalle.
4. Mover la carga y transformación de datos a un servicio Angular.
5. Cambiar el workflow de GitHub Pages para publicar el resultado de `ng build` desde `dist/`.

Mientras tanto, el workflow actual continúa publicando el sitio estático desde la raíz del repositorio.
