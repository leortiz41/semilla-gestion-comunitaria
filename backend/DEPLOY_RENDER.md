# Despliegue del backend en Render

Configuración recomendada:

- Servicio: Web Service
- Rama: `main`
- Directorio raíz: `backend`
- Compilación: `npm install && npm run build`
- Inicio: `npm start`
- Verificación de salud: `/api/health`

Variables iniciales:

```env
NODE_ENV=production
FRONTEND_URL=https://semilla-gestion-comunitaria.vercel.app
```
