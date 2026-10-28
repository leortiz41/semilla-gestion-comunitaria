# Backend de Semilla

API REST desarrollada con Node.js, Express y TypeScript.

## Desarrollo local

```bash
npm install
npm run dev
```

## Compilación

```bash
npm run build
```

## Producción

```bash
npm start
```

## Verificación de salud

```text
GET /api/health
```

El servidor usa la variable `PORT` proporcionada por el entorno y escucha en `0.0.0.0` para permitir su publicación como Web Service en Render.
