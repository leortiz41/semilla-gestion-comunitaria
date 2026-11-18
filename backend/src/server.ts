import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { checkDatabaseConnection } from './config/database.js';
import { authRouter } from './routes/auth.routes.js';
import { comunidadesRouter } from './routes/comunidades.routes.js';
import { familiasRouter } from './routes/familias.routes.js';
import { asignacionesFamiliasRouter } from './routes/asignaciones-familias.routes.js';
import { asignacionViviendasRouter } from './routes/asignacion-viviendas.routes.js';
import { documentosFamiliaRouter } from './routes/documentos-familia.routes.js';
import { perfilesFamiliaRouter } from './routes/perfiles-familia.routes.js';
import { integrantesFamiliaRouter } from './routes/integrantes-familia.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { donantesRouter } from './routes/donantes.routes.js';
import { zonasRouter } from './routes/zonas.routes.js';
import { usuariosRouter } from './routes/usuarios.routes.js';
import { auditoriaRouter } from './routes/auditoria.routes.js';
import { configuracionInstitucionalRouter } from './routes/configuracion-institucional.routes.js';
import { administracionAccesosRouter } from './routes/administracion-accesos.routes.js';
import { proyectosRouter } from './routes/proyectos.routes.js';
import { proveedoresRouter } from './routes/proveedores.routes.js';
import { pagosRouter } from './routes/pagos.routes.js';
import { gestorContratosRouter } from './routes/gestor-contratos.routes.js';
import { pagosOperacionesRouter } from './routes/pagos-operaciones.routes.js';
import { mapaImpactoRouter } from './routes/mapa-impacto.routes.js';
import { plataformaRouter } from './routes/plataforma.routes.js';
import { inicializacionSuperadministradorRouter } from './routes/inicializacion-superadministrador.routes.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRouter);
app.use('/api/inicializacion-superadministrador', inicializacionSuperadministradorRouter);
app.use('/api/comunidades', comunidadesRouter);
app.use('/api/familias/viviendas', asignacionViviendasRouter);
app.use('/api/familias', asignacionesFamiliasRouter);
app.use('/api/familias', documentosFamiliaRouter);
app.use('/api/familias', integrantesFamiliaRouter);
app.use('/api/familias', perfilesFamiliaRouter);
app.use('/api/familias', familiasRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/zonas', zonasRouter);
app.use('/api/usuarios/administracion', administracionAccesosRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/auditoria', auditoriaRouter);
app.use('/api/configuracion-institucional', configuracionInstitucionalRouter);
app.use('/api/plataforma', plataformaRouter);
app.use('/api/donantes', donantesRouter);
app.use('/api/proyectos', proyectosRouter);
app.use('/api/proveedores', proveedoresRouter);
app.use('/api/pagos/gestor-contratos', gestorContratosRouter);
app.use('/api/pagos', pagosOperacionesRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/mapa-impacto', mapaImpactoRouter);

app.get('/api/health', async (_req, res) => {
  const database = await checkDatabaseConnection();
  const databaseConfigured = database.status !== 'not_configured';
  const databaseAvailable = database.status === 'connected';

  const status = databaseConfigured && !databaseAvailable ? 'degraded' : 'ok';
  const httpStatus = status === 'degraded' ? 503 : 200;

  res.status(httpStatus).json({
    status,
    app: 'Semilla',
    environment: process.env.NODE_ENV ?? 'development',
    database,
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Semilla API',
    slogan: 'Recursos que generan desarrollo',
    health: '/api/health',
    auth: '/api/auth',
    comunidades: '/api/comunidades',
    dashboard: '/api/dashboard',
    zonas: '/api/zonas',
  });
});

app.listen(port, host, () => {
  console.log(`Semilla API ejecutándose en http://${host}:${port}`);
});
