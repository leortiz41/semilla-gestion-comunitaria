import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { checkDatabaseConnection } from './config/database.js';
import { authRouter } from './routes/auth.routes.js';

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
  });
});

app.listen(port, host, () => {
  console.log(`Semilla API ejecutándose en http://${host}:${port}`);
});
