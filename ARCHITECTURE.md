# Arquitectura Angular

El prototipo usa Angular en modo standalone y se publica en GitHub Pages a partir de su compilación de producción.

```text
index.html                         Contenedor de la aplicación Angular
src/main.ts                        Punto de inicio y configuración HTTP
src/app/app.component.*            Interfaz y comportamiento de la aplicación
src/app/process-data.service.ts    Carga tipada de los datos del dominio
src/styles.css                     Estilos globales
src/assets/data.json               Datos del mapa de procesos
```

## Desarrollo y publicación

- `npm start`: inicia el servidor local de Angular.
- `npm run build`: genera la aplicación en `dist/procesos/browser`.
- GitHub Actions instala las dependencias, compila el proyecto y publica esa carpeta en GitHub Pages.
