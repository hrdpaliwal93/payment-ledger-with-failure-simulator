import express, { Request, Response } from 'express';
import { db } from './db.ts';
import { paymentSwitch } from './switchEngine.ts';
import { ledgerEngine } from './ledgerEngine.ts';
import { failureSimulator } from './failureSimulator.ts';
import { reconciliationEngine } from './reconciliationEngine.ts';
import { PRISMA_SCHEMA_TEXT, POSTGRES_DDL_TEXT } from './prismaSchema.ts';
import { ProcessPaymentRequest } from '../types/payment.ts';

export const apiRouter = express.Router();

// Middleware: JSON parsing
apiRouter.use(express.json());

// 1. Health & Database Status
apiRouter.get('/status', (req: Request, res: Response) => {
  const dbStatus = db.getStatus();
  const simConfig = failureSimulator.getConfig();
  res.json({
    status: 'ONLINE',
    version: '1.0.0',
    platform: 'Mini Payment Switch & Ledger Platform',
    database: dbStatus,
    simulator: simConfig,
  });
});

// 2. Connect / Test Neon PostgreSQL URL
apiRouter.post('/database/connect', async (req: Request, res: Response) => {
  const { databaseUrl } = req.body;
  if (!databaseUrl) {
    return res.status(400).json({ error: 'databaseUrl is required' });
  }

  try {
    await db.tryConnectPostgres(databaseUrl);
    const status = db.getStatus();
    res.json({
      success: status.connected,
      status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Wallets
apiRouter.get('/wallets', async (req: Request, res: Response) => {
  try {
    const wallets = await db.getWallets();
    res.json(wallets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Payment Processing (Switch Engine)
apiRouter.post('/payments', async (req: Request, res: Response) => {
  try {
    const paymentRequest: ProcessPaymentRequest = req.body;
    if (!paymentRequest.source_wallet_id || !paymentRequest.destination_wallet_id || !paymentRequest.amount) {
      return res.status(400).json({ error: 'source_wallet_id, destination_wallet_id, and amount are required.' });
    }

    const result = await paymentSwitch.processPayment(paymentRequest);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Transactions
apiRouter.get('/transactions', async (req: Request, res: Response) => {
  try {
    const txns = await db.getAllTransactions();
    res.json(txns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/transactions/:id', async (req: Request, res: Response) => {
  try {
    const txn = await db.getTransaction(req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    res.json(txn);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Ledger
apiRouter.get('/ledger', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const entries = await ledgerEngine.getAuditTrail(limit);
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/ledger/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await ledgerEngine.getAuditMetrics();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Mock Bank Events
apiRouter.get('/bank/events', async (req: Request, res: Response) => {
  try {
    const events = await db.getBankEvents();
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Failure Simulator Config & Phantom Events
apiRouter.get('/simulator/config', (req: Request, res: Response) => {
  res.json(failureSimulator.getConfig());
});

apiRouter.post('/simulator/config', (req: Request, res: Response) => {
  const updated = failureSimulator.setConfig(req.body);
  res.json(updated);
});

apiRouter.post('/simulator/phantom', async (req: Request, res: Response) => {
  try {
    const amount = req.body.amount ? parseFloat(req.body.amount) : 249.99;
    const event = await failureSimulator.injectPhantomBankDebit(amount);
    res.json({ success: true, event });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Reconciliation Engine
apiRouter.post('/reconciliation/run', async (req: Request, res: Response) => {
  try {
    const run = await reconciliationEngine.runReconciliation();
    res.json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/reconciliation/runs', async (req: Request, res: Response) => {
  try {
    const runs = await db.getReconciliationRuns();
    res.json(runs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/reconciliation/resolve', async (req: Request, res: Response) => {
  try {
    const { itemId, action, resolutionNotes, targetWalletId } = req.body;
    if (!itemId || !action) {
      return res.status(400).json({ error: 'itemId and action are required.' });
    }
    const result = await reconciliationEngine.resolveDiscrepancy(
      itemId,
      action,
      resolutionNotes,
      targetWalletId
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Database Reset & Seeding
apiRouter.post('/database/reset', async (req: Request, res: Response) => {
  try {
    await db.resetAll();
    failureSimulator.setConfig({
      active_scenario: 'NONE',
      network_delay_ms: 300,
      random_failure_rate: 0,
      auto_reconciliation: false,
    });
    res.json({ success: true, message: 'All database tables, wallets, transactions, and simulator states reset successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Schema & DDL
apiRouter.get('/schema', (req: Request, res: Response) => {
  res.json({
    prisma: PRISMA_SCHEMA_TEXT,
    postgresDdl: POSTGRES_DDL_TEXT,
  });
});
