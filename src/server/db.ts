import pg from 'pg';
import {
  Wallet,
  PaymentTransaction,
  LedgerEntry,
  MockBankEvent,
  ReconciliationRun,
  ReconciliationItem,
  ResolutionStatus,
} from '../types/payment.ts';
import { POSTGRES_DDL_TEXT } from './prismaSchema.ts';

const { Pool } = pg;

export interface DatabaseStatus {
  provider: 'NEON_POSTGRES' | 'IN_MEMORY_TRANSACTIONAL';
  connected: boolean;
  databaseUrlSet: boolean;
  activePoolSize: number;
  message: string;
}

// Initial seed data for wallets
const INITIAL_WALLETS: Wallet[] = [
  {
    id: 'wal_alice_customer',
    owner_name: 'Alice Johnson (Customer)',
    account_type: 'CUSTOMER',
    currency: 'USD',
    balance: 5000.0,
    reserved: 0.0,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'wal_bob_customer',
    owner_name: 'Bob Smith (Customer)',
    account_type: 'CUSTOMER',
    currency: 'USD',
    balance: 120.0, // Low balance for testing insufficient funds
    reserved: 0.0,
    created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'wal_megacorp_merchant',
    owner_name: 'MegaCorp Retail (Merchant)',
    account_type: 'MERCHANT',
    currency: 'USD',
    balance: 18500.0,
    reserved: 0.0,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'wal_coffee_merchant',
    owner_name: 'Artisan Coffee Roasters (Merchant)',
    account_type: 'MERCHANT',
    currency: 'USD',
    balance: 1420.5,
    reserved: 0.0,
    created_at: new Date(Date.now() - 3600000 * 30).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'wal_escrow_holding',
    owner_name: 'Switch Settlement Escrow',
    account_type: 'ESCROW',
    currency: 'USD',
    balance: 0.0,
    reserved: 0.0,
    created_at: new Date(Date.now() - 3600000 * 100).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'wal_system_clearing',
    owner_name: 'Central Bank Clearing Account',
    account_type: 'SYSTEM_RESERVE',
    currency: 'USD',
    balance: 1000000.0,
    reserved: 0.0,
    created_at: new Date(Date.now() - 3600000 * 200).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

class DatabaseManager {
  private pgPool: pg.Pool | null = null;
  private isConnectedToPostgres: boolean = false;
  private connectionError: string | null = null;

  // In-memory transactional data stores (always available as fallback & immediate cache)
  private memoryWallets: Map<string, Wallet> = new Map();
  private memoryTransactions: Map<string, PaymentTransaction> = new Map();
  private memoryLedgerEntries: LedgerEntry[] = [];
  private memoryBankEvents: Map<string, MockBankEvent> = new Map();
  private memoryReconciliations: ReconciliationRun[] = [];

  constructor() {
    this.seedInMemory();
    this.tryConnectPostgres();
  }

  private seedInMemory() {
    this.memoryWallets.clear();
    for (const w of INITIAL_WALLETS) {
      this.memoryWallets.set(w.id, { ...w });
    }
  }

  public async tryConnectPostgres(customUrl?: string) {
    const connStr = customUrl || process.env.DATABASE_URL;
    if (!connStr || connStr.includes('MY_') || connStr.includes('username:password@ep-sample')) {
      this.isConnectedToPostgres = false;
      this.connectionError = 'No valid Neon DATABASE_URL provided. Using in-memory transactional storage.';
      return;
    }

    try {
      if (this.pgPool) {
        await this.pgPool.end();
      }
      this.pgPool = new Pool({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false }, // Neon DB SSL requirement
        max: 5,
        connectionTimeoutMillis: 5000,
      });

      // Quick test query
      const client = await this.pgPool.connect();
      await client.query('SELECT 1 as test');
      client.release();

      this.isConnectedToPostgres = true;
      this.connectionError = null;
      console.log('Successfully connected to Neon PostgreSQL database.');

      // Initialize tables if needed
      await this.initPostgresTables();
    } catch (err: any) {
      console.warn('Postgres connection failed, falling back to in-memory store:', err.message);
      this.isConnectedToPostgres = false;
      this.connectionError = err.message;
    }
  }

  private async initPostgresTables() {
    if (!this.pgPool || !this.isConnectedToPostgres) return;
    try {
      const client = await this.pgPool.connect();
      try {
        await client.query(POSTGRES_DDL_TEXT);
        // Check if wallets table has entries
        const { rows } = await client.query('SELECT COUNT(*) as count FROM wallets');
        if (parseInt(rows[0].count, 10) === 0) {
          for (const w of INITIAL_WALLETS) {
            await client.query(
              `INSERT INTO wallets (id, owner_name, account_type, currency, balance, reserved, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO NOTHING`,
              [w.id, w.owner_name, w.account_type, w.currency, w.balance, w.reserved, w.created_at, w.updated_at]
            );
          }
        }
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Error initializing tables on Neon Postgres:', err);
    }
  }

  public getStatus(): DatabaseStatus {
    const hasEnv = Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('username:password'));
    return {
      provider: this.isConnectedToPostgres ? 'NEON_POSTGRES' : 'IN_MEMORY_TRANSACTIONAL',
      connected: this.isConnectedToPostgres,
      databaseUrlSet: hasEnv,
      activePoolSize: this.pgPool?.totalCount || 0,
      message: this.isConnectedToPostgres
        ? 'Connected to Neon PostgreSQL DB with ACID transaction support.'
        : this.connectionError || 'Using high-fidelity in-memory transactional database engine.',
    };
  }

  // --- WALLET OPERATIONS ---
  public async getWallets(): Promise<Wallet[]> {
    if (this.isConnectedToPostgres && this.pgPool) {
      try {
        const { rows } = await this.pgPool.query('SELECT * FROM wallets ORDER BY id ASC');
        return rows.map((r) => ({
          id: r.id,
          owner_name: r.owner_name,
          account_type: r.account_type,
          currency: r.currency,
          balance: parseFloat(r.balance),
          reserved: parseFloat(r.reserved),
          created_at: r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at),
          updated_at: r.updated_at.toISOString ? r.updated_at.toISOString() : String(r.updated_at),
        }));
      } catch (err) {
        console.error('Postgres error in getWallets, falling back to memory:', err);
      }
    }
    return Array.from(this.memoryWallets.values());
  }

  public async getWallet(id: string): Promise<Wallet | null> {
    if (this.isConnectedToPostgres && this.pgPool) {
      try {
        const { rows } = await this.pgPool.query('SELECT * FROM wallets WHERE id = $1', [id]);
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            owner_name: r.owner_name,
            account_type: r.account_type,
            currency: r.currency,
            balance: parseFloat(r.balance),
            reserved: parseFloat(r.reserved),
            created_at: r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at),
            updated_at: r.updated_at.toISOString ? r.updated_at.toISOString() : String(r.updated_at),
          };
        }
        return null;
      } catch (err) {
        console.error('Postgres error in getWallet:', err);
      }
    }
    return this.memoryWallets.get(id) || null;
  }

  // --- TRANSACTION OPERATIONS ---
  public async getTransactionByIdempotencyKey(key: string): Promise<PaymentTransaction | null> {
    if (this.isConnectedToPostgres && this.pgPool) {
      try {
        const { rows } = await this.pgPool.query('SELECT * FROM payment_transactions WHERE idempotency_key = $1', [key]);
        if (rows.length > 0) {
          return this.mapTxnRow(rows[0]);
        }
        return null;
      } catch (err) {
        console.error('Postgres getTransactionByIdempotencyKey error:', err);
      }
    }
    for (const txn of this.memoryTransactions.values()) {
      if (txn.idempotency_key === key) return txn;
    }
    return null;
  }

  public async getTransaction(id: string): Promise<PaymentTransaction | null> {
    if (this.isConnectedToPostgres && this.pgPool) {
      try {
        const { rows } = await this.pgPool.query('SELECT * FROM payment_transactions WHERE id = $1', [id]);
        if (rows.length > 0) return this.mapTxnRow(rows[0]);
        return null;
      } catch (err) {
        console.error('Postgres getTransaction error:', err);
      }
    }
    return this.memoryTransactions.get(id) || null;
  }

  public async getAllTransactions(): Promise<PaymentTransaction[]> {
    if (this.isConnectedToPostgres && this.pgPool) {
      try {
        const { rows } = await this.pgPool.query('SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT 100');
        return rows.map((r) => this.mapTxnRow(r));
      } catch (err) {
        console.error('Postgres getAllTransactions error:', err);
      }
    }
    return Array.from(this.memoryTransactions.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public async createTransaction(txn: PaymentTransaction): Promise<PaymentTransaction> {
    this.memoryTransactions.set(txn.id, txn);
    if (this.isConnectedToPostgres && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO payment_transactions
           (id, idempotency_key, source_wallet_id, destination_wallet_id, amount, currency, status, failure_reason, failure_code, routed_gateway, bank_reference, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            txn.id,
            txn.idempotency_key,
            txn.source_wallet_id,
            txn.destination_wallet_id,
            txn.amount,
            txn.currency,
            txn.status,
            txn.failure_reason || null,
            txn.failure_code || null,
            txn.routed_gateway,
            txn.bank_reference || null,
            txn.created_at,
            txn.updated_at,
          ]
        );
      } catch (err) {
        console.error('Postgres createTransaction error:', err);
      }
    }
    return txn;
  }

  public async updateTransaction(id: string, updates: Partial<PaymentTransaction>): Promise<PaymentTransaction | null> {
    const existing = this.memoryTransactions.get(id);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
        timeline: updates.timeline || existing.timeline,
      };
      this.memoryTransactions.set(id, updated);

      if (this.isConnectedToPostgres && this.pgPool) {
        try {
          await this.pgPool.query(
            `UPDATE payment_transactions
             SET status = COALESCE($1, status),
                 failure_reason = COALESCE($2, failure_reason),
                 failure_code = COALESCE($3, failure_code),
                 bank_reference = COALESCE($4, bank_reference),
                 updated_at = NOW()
             WHERE id = $5`,
            [updates.status || null, updates.failure_reason || null, updates.failure_code || null, updates.bank_reference || null, id]
          );
        } catch (err) {
          console.error('Postgres updateTransaction error:', err);
        }
      }
      return updated;
    }
    return null;
  }

  // --- ATOMIC LEDGER + WALLET UPDATE (ACID TRANSACTION) ---
  public async commitLedgerMovement(
    sourceWalletId: string,
    destWalletId: string,
    amount: number,
    transactionId: string
  ): Promise<{ debitEntry: LedgerEntry; creditEntry: LedgerEntry }> {
    // 1. Memory transactional execution
    const src = this.memoryWallets.get(sourceWalletId);
    const dst = this.memoryWallets.get(destWalletId);
    if (!src || !dst) {
      throw new Error(`Wallet not found: src=${sourceWalletId}, dst=${destWalletId}`);
    }

    const srcBefore = src.balance;
    const dstBefore = dst.balance;
    const srcAfter = Number((srcBefore - amount).toFixed(2));
    const dstAfter = Number((dstBefore + amount).toFixed(2));

    src.balance = srcAfter;
    src.updated_at = new Date().toISOString();
    dst.balance = dstAfter;
    dst.updated_at = new Date().toISOString();

    const timestamp = new Date().toISOString();
    const debitEntry: LedgerEntry = {
      id: `led_deb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      transaction_id: transactionId,
      wallet_id: sourceWalletId,
      entry_type: 'DEBIT',
      amount,
      balance_before: srcBefore,
      balance_after: srcAfter,
      description: `Payment Switch Transfer DEBIT for txn ${transactionId}`,
      created_at: timestamp,
    };

    const creditEntry: LedgerEntry = {
      id: `led_crd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      transaction_id: transactionId,
      wallet_id: destWalletId,
      entry_type: 'CREDIT',
      amount,
      balance_before: dstBefore,
      balance_after: dstAfter,
      description: `Payment Switch Transfer CREDIT for txn ${transactionId}`,
      created_at: timestamp,
    };

    this.memoryLedgerEntries.unshift(debitEntry, creditEntry);

    // 2. Real PostgreSQL atomic transaction if connected
    if (this.isConnectedToPostgres && this.pgPool) {
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        // Update source wallet
        await client.query('UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2', [amount, sourceWalletId]);
        // Update dest wallet
        await client.query('UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2', [amount, destWalletId]);
        // Insert debit ledger
        await client.query(
          `INSERT INTO ledger_entries (id, transaction_id, wallet_id, entry_type, amount, balance_before, balance_after, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [debitEntry.id, debitEntry.transaction_id, debitEntry.wallet_id, debitEntry.entry_type, debitEntry.amount, debitEntry.balance_before, debitEntry.balance_after, debitEntry.description, debitEntry.created_at]
        );
        // Insert credit ledger
        await client.query(
          `INSERT INTO ledger_entries (id, transaction_id, wallet_id, entry_type, amount, balance_before, balance_after, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [creditEntry.id, creditEntry.transaction_id, creditEntry.wallet_id, creditEntry.entry_type, creditEntry.amount, creditEntry.balance_before, creditEntry.balance_after, creditEntry.description, creditEntry.created_at]
        );
        await client.query('COMMIT');
      } catch (pgErr) {
        await client.query('ROLLBACK');
        console.error('PostgreSQL transaction rolled back:', pgErr);
        throw pgErr;
      } finally {
        client.release();
      }
    }

    return { debitEntry, creditEntry };
  }

  // --- LEDGER ENTRIES ---
  public async getLedgerEntries(limit: number = 100): Promise<LedgerEntry[]> {
    if (this.isConnectedToPostgres && this.pgPool) {
      try {
        const { rows } = await this.pgPool.query('SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT $1', [limit]);
        return rows.map((r) => ({
          id: r.id,
          transaction_id: r.transaction_id,
          wallet_id: r.wallet_id,
          entry_type: r.entry_type,
          amount: parseFloat(r.amount),
          balance_before: parseFloat(r.balance_before),
          balance_after: parseFloat(r.balance_after),
          description: r.description,
          created_at: r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at),
        }));
      } catch (err) {
        console.error('Postgres getLedgerEntries error:', err);
      }
    }
    return this.memoryLedgerEntries.slice(0, limit);
  }

  // --- MOCK BANK EVENTS ---
  public async createBankEvent(event: MockBankEvent): Promise<MockBankEvent> {
    this.memoryBankEvents.set(event.bank_reference_id, event);
    if (this.isConnectedToPostgres && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO mock_bank_events (id, bank_reference_id, payment_ref, amount, status, raw_payload, settled_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (bank_reference_id) DO UPDATE SET status = EXCLUDED.status, amount = EXCLUDED.amount`,
          [
            event.id,
            event.bank_reference_id,
            event.payment_ref,
            event.amount,
            event.status,
            event.raw_payload,
            event.settled_at,
            event.created_at,
          ]
        );
      } catch (err) {
        console.error('Postgres createBankEvent error:', err);
      }
    }
    return event;
  }

  public async getBankEvents(): Promise<MockBankEvent[]> {
    if (this.isConnectedToPostgres && this.pgPool) {
      try {
        const { rows } = await this.pgPool.query('SELECT * FROM mock_bank_events ORDER BY created_at DESC LIMIT 100');
        return rows.map((r) => ({
          id: r.id,
          bank_reference_id: r.bank_reference_id,
          payment_ref: r.payment_ref,
          amount: parseFloat(r.amount),
          status: r.status,
          raw_payload: r.raw_payload,
          settled_at: r.settled_at.toISOString ? r.settled_at.toISOString() : String(r.settled_at),
          created_at: r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at),
        }));
      } catch (err) {
        console.error('Postgres getBankEvents error:', err);
      }
    }
    return Array.from(this.memoryBankEvents.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // --- RECONCILIATION RUNS ---
  public async saveReconciliationRun(run: ReconciliationRun): Promise<void> {
    this.memoryReconciliations.unshift(run);
    if (this.isConnectedToPostgres && this.pgPool) {
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO reconciliation_runs
           (id, run_timestamp, total_internal_inspected, total_bank_inspected, matched_count, amount_mismatch_count, status_mismatch_count, unmatched_internal_count, unmatched_external_count, total_discrepancy_amount, summary_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            run.id,
            run.run_timestamp,
            run.total_internal_inspected,
            run.total_bank_inspected,
            run.matched_count,
            run.amount_mismatch_count,
            run.status_mismatch_count,
            run.unmatched_internal_count,
            run.unmatched_external_count,
            run.total_discrepancy_amount,
            run.summary_status,
          ]
        );

        for (const item of run.items) {
          await client.query(
            `INSERT INTO reconciliation_items
             (id, reconciliation_id, category, internal_txn_id, bank_event_id, internal_amount, bank_amount, internal_status, bank_status, discrepancy_notes, resolution_status, resolution_notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              item.id,
              run.id,
              item.category,
              item.internal_txn_id || null,
              item.bank_event_id || null,
              item.internal_amount ?? null,
              item.bank_amount ?? null,
              item.internal_status || null,
              item.bank_status || null,
              item.discrepancy_notes,
              item.resolution_status,
              item.resolution_notes || null,
            ]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Postgres saveReconciliationRun error:', err);
      } finally {
        client.release();
      }
    }
  }

  public async getReconciliationRuns(): Promise<ReconciliationRun[]> {
    return this.memoryReconciliations;
  }

  public async updateReconciliationItemResolution(
    itemId: string,
    status: ResolutionStatus,
    notes?: string
  ): Promise<boolean> {
    for (const run of this.memoryReconciliations) {
      const item = run.items.find((i) => i.id === itemId);
      if (item) {
        item.resolution_status = status;
        if (notes) item.resolution_notes = notes;
        return true;
      }
    }
    return false;
  }

  // --- RESET & SEEDING ---
  public async resetAll(): Promise<void> {
    this.seedInMemory();
    this.memoryTransactions.clear();
    this.memoryLedgerEntries = [];
    this.memoryBankEvents.clear();
    this.memoryReconciliations = [];

    if (this.isConnectedToPostgres && this.pgPool) {
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        await client.query('TRUNCATE reconciliation_items, reconciliation_runs, mock_bank_events, ledger_entries, payment_transactions CASCADE');
        await client.query('DELETE FROM wallets');
        for (const w of INITIAL_WALLETS) {
          await client.query(
            `INSERT INTO wallets (id, owner_name, account_type, currency, balance, reserved, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [w.id, w.owner_name, w.account_type, w.currency, w.balance, w.reserved, w.created_at, w.updated_at]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error resetting Postgres database:', err);
      } finally {
        client.release();
      }
    }
  }

  private mapTxnRow(r: any): PaymentTransaction {
    return {
      id: r.id,
      idempotency_key: r.idempotency_key,
      source_wallet_id: r.source_wallet_id,
      destination_wallet_id: r.destination_wallet_id,
      amount: parseFloat(r.amount),
      currency: r.currency,
      status: r.status,
      failure_reason: r.failure_reason,
      failure_code: r.failure_code,
      routed_gateway: r.routed_gateway,
      bank_reference: r.bank_reference,
      created_at: r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at),
      updated_at: r.updated_at.toISOString ? r.updated_at.toISOString() : String(r.updated_at),
    };
  }
}

export const db = new DatabaseManager();
