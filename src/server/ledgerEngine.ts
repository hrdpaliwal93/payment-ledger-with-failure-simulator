import { db } from './db.ts';
import { LedgerEntry, Wallet } from '../types/payment.ts';

export interface LedgerAuditMetrics {
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  variance: number;
  entriesCount: number;
  walletCount: number;
}

export class LedgerEngine {
  /**
   * Commit a validated payment movement atomically to the ledger.
   * Ensures double-entry accounting: debiting source, crediting destination.
   */
  public async postPaymentMovement(
    transactionId: string,
    sourceWalletId: string,
    destinationWalletId: string,
    amount: number
  ): Promise<{ debit: LedgerEntry; credit: LedgerEntry }> {
    if (amount <= 0) {
      throw new Error(`Invalid ledger posting amount: ${amount}`);
    }

    // Atomic double-entry commit through db layer
    const result = await db.commitLedgerMovement(
      sourceWalletId,
      destinationWalletId,
      amount,
      transactionId
    );

    return {
      debit: result.debitEntry,
      credit: result.creditEntry,
    };
  }

  /**
   * Retrieve ledger audit trail.
   */
  public async getAuditTrail(limit = 100): Promise<LedgerEntry[]> {
    return await db.getLedgerEntries(limit);
  }

  /**
   * Compute accounting invariants and audit metrics across all accounts.
   */
  public async getAuditMetrics(): Promise<LedgerAuditMetrics> {
    const entries = await db.getLedgerEntries(1000);
    const wallets = await db.getWallets();

    let totalDebits = 0;
    let totalCredits = 0;

    for (const e of entries) {
      if (e.entry_type === 'DEBIT') {
        totalDebits += e.amount;
      } else if (e.entry_type === 'CREDIT') {
        totalCredits += e.amount;
      }
    }

    const variance = Math.abs(Number((totalDebits - totalCredits).toFixed(2)));

    return {
      totalDebits: Number(totalDebits.toFixed(2)),
      totalCredits: Number(totalCredits.toFixed(2)),
      isBalanced: variance === 0,
      variance,
      entriesCount: entries.length,
      walletCount: wallets.length,
    };
  }

  /**
   * Post manual accounting adjustment (e.g. during reconciliation resolution)
   */
  public async postAdjustment(
    reconciliationItemId: string,
    targetWalletId: string,
    type: 'DEBIT' | 'CREDIT',
    amount: number,
    reason: string
  ): Promise<LedgerEntry> {
    const clearingWalletId = 'wal_system_clearing';
    const fakeTxnId = `adj_${Date.now()}`;

    if (type === 'CREDIT') {
      // Credit target wallet, debit clearing account
      const res = await db.commitLedgerMovement(clearingWalletId, targetWalletId, amount, fakeTxnId);
      return res.creditEntry;
    } else {
      // Debit target wallet, credit clearing account
      const res = await db.commitLedgerMovement(targetWalletId, clearingWalletId, amount, fakeTxnId);
      return res.debitEntry;
    }
  }
}

export const ledgerEngine = new LedgerEngine();
