import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb } from './db.js';
import authRoutes from './routes/auth.js';
import mediaRoutes from './routes/media.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../frontend');

dotenv.config({ path: path.join(__dirname, '.env') });

const port = Number(process.env.PORT) || 8000;
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error(
    'Missing MONGODB_URI. Copy backend/.env.example to backend/.env and set your Atlas connection string.',
  );
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in backend/.env');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'triply' });
});

app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);

// Destination and avatar images are streamed from MongoDB GridFS (see routes/media.js).
// Never expose backend secrets via static hosting.
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (
    p === '/.env' ||
    p.startsWith('/.env.') ||
    p.startsWith('/backend/') ||
    p.startsWith('/node_modules/') ||
    p.startsWith('/.git/') ||
    p.startsWith('/.cursor/')
  ) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(frontendRoot, { index: 'index.html', extensions: ['html'] }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, reason: 'storage' });
});

await connectDb(uri);
app.listen(port, '0.0.0.0', () => {
  console.log(`Triply API + frontend on http://0.0.0.0:${port}`);
  console.log(`Images: /api/media/dest/<id>/hero`);
});
