import express from 'express';
import { apiRouter } from './api.ts';

export const app = express();

app.use(express.json());
app.use('/api', apiRouter);

export default app;
