import express, { type Request, type Response } from 'express';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '4000', 10);

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok' }, error: null, meta: null });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
