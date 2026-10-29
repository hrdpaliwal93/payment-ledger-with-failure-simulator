import {
  Wallet,
  PaymentTransaction,
  LedgerEntry,
  MockBankEvent,
  ReconciliationRun,
  SimulationConfig,
  ProcessPaymentRequest,
  FailureScenario,
  ResolutionStatus,
} from '../types/payment.ts';
import { DatabaseStatus } from '../server/db.ts';
import { LedgerAuditMetrics } from '../server/ledgerEngine.ts';

export const apiClient = {
  async getStatus(): Promise<{
    status: string;
    version: string;
    platform: string;
    database: DatabaseStatus;
    simulator: SimulationConfig;
  }> {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Failed to fetch status');
    return res.json();
  },

  async connectDatabase(databaseUrl: string): Promise<{ success: boolean; status: DatabaseStatus }> {
    const res = await fetch('/api/database/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ databaseUrl }),
    });
    if (!res.ok) throw new Error('Failed to connect to database');
    return res.json();
  },

  async getWallets(): Promise<Wallet[]> {
    const res = await fetch('/api/wallets');
    if (!res.ok) throw new Error('Failed to fetch wallets');
    return res.json();
  },

  async getTransactions(): Promise<PaymentTransaction[]> {
    const res = await fetch('/api/transactions');
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },

  async processPayment(req: ProcessPaymentRequest): Promise<{
    transaction: PaymentTransaction;
    idempotentReplay: boolean;
    ledgerPosted: boolean;
    bankEventCreated: boolean;
  }> {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Payment failed' }));
      throw new Error(err.error || 'Payment failed');
    }
    return res.json();
  },

  async getLedgerEntries(): Promise<LedgerEntry[]> {
    const res = await fetch('/api/ledger');
    if (!res.ok) throw new Error('Failed to fetch ledger entries');
    return res.json();
  },

  async getLedgerMetrics(): Promise<LedgerAuditMetrics> {
    const res = await fetch('/api/ledger/metrics');
    if (!res.ok) throw new Error('Failed to fetch ledger metrics');
    return res.json();
  },

  async getBankEvents(): Promise<MockBankEvent[]> {
    const res = await fetch('/api/bank/events');
    if (!res.ok) throw new Error('Failed to fetch bank events');
    return res.json();
  },

  async getSimulatorConfig(): Promise<SimulationConfig> {
    const res = await fetch('/api/simulator/config');
    if (!res.ok) throw new Error('Failed to fetch simulator config');
    return res.json();
  },

  async updateSimulatorConfig(updates: Partial<SimulationConfig>): Promise<SimulationConfig> {
    const res = await fetch('/api/simulator/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update simulator config');
    return res.json();
  },

  async injectPhantomBankDebit(amount: number = 249.99): Promise<{ success: boolean; event: MockBankEvent }> {
    const res = await fetch('/api/simulator/phantom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) throw new Error('Failed to inject phantom debit');
    return res.json();
  },

  async runReconciliation(): Promise<ReconciliationRun> {
    const res = await fetch('/api/reconciliation/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to run reconciliation');
    return res.json();
  },

  async getReconciliationRuns(): Promise<ReconciliationRun[]> {
    const res = await fetch('/api/reconciliation/runs');
    if (!res.ok) throw new Error('Failed to fetch reconciliation runs');
    return res.json();
  },

  async resolveReconciliationItem(
    itemId: string,
    action: 'POST_ADJUSTMENT' | 'SYNC_STATUS' | 'DISMISS',
    resolutionNotes: string,
    targetWalletId?: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/reconciliation/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, action, resolutionNotes, targetWalletId }),
    });
    if (!res.ok) throw new Error('Failed to resolve item');
    return res.json();
  },

  async resetDatabase(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/database/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to reset database');
    return res.json();
  },

  async getSchema(): Promise<{ prisma: string; postgresDdl: string }> {
    const res = await fetch('/api/schema');
    if (!res.ok) throw new Error('Failed to fetch schema');
    return res.json();
  },
};
