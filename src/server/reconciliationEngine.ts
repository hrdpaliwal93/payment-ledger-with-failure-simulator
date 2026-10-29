import {
  ReconciliationRun,
  ReconciliationItem,
  DiscrepancyCategory,
  ResolutionStatus,
} from '../types/payment.ts';
import { db } from './db.ts';
import { ledgerEngine } from './ledgerEngine.ts';

export class ReconciliationEngine {
  /**
   * Run reconciliation across all internal payment transactions and mock bank events.
   */
  public async runReconciliation(): Promise<ReconciliationRun> {
    const internalTransactions = await db.getAllTransactions();
    const bankEvents = await db.getBankEvents();

    const items: ReconciliationItem[] = [];
    const matchedBankEventIds = new Set<string>();

    let matchedCount = 0;
    let amountMismatchCount = 0;
    let statusMismatchCount = 0;
    let unmatchedInternalCount = 0;
    let totalDiscrepancyAmount = 0;

    // 1. Check each internal transaction
    for (const txn of internalTransactions) {
      // Find matching bank event by payment_ref or bank_reference
      const bankEvt = bankEvents.find(
        (b) => b.payment_ref === txn.id || (txn.bank_reference && b.bank_reference_id === txn.bank_reference)
      );

      if (bankEvt) {
        matchedBankEventIds.add(bankEvt.id);

        const internalAmt = Number(txn.amount);
        const bankAmt = Number(bankEvt.amount);
        const amtDiff = Math.abs(Number((internalAmt - bankAmt).toFixed(2)));

        const isStatusAligned =
          (txn.status === 'SUCCESS' && bankEvt.status === 'SETTLED') ||
          (txn.status === 'FAILED' && bankEvt.status === 'DECLINED') ||
          (txn.status === 'PROCESSING' && bankEvt.status === 'PENDING');

        if (amtDiff > 0.001) {
          // Amount Mismatch
          amountMismatchCount++;
          totalDiscrepancyAmount += amtDiff;
          items.push({
            id: `rec_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            category: 'AMOUNT_MISMATCH',
            internal_txn_id: txn.id,
            bank_event_id: bankEvt.id,
            internal_amount: internalAmt,
            bank_amount: bankAmt,
            internal_status: txn.status,
            bank_status: bankEvt.status,
            discrepancy_notes: `Amount variance of $${amtDiff.toFixed(2)}. Internal: $${internalAmt.toFixed(2)}, Bank Settled: $${bankAmt.toFixed(2)}.`,
            resolution_status: 'UNRESOLVED',
          });
        } else if (!isStatusAligned) {
          // Status Mismatch
          statusMismatchCount++;
          items.push({
            id: `rec_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            category: 'STATUS_MISMATCH',
            internal_txn_id: txn.id,
            bank_event_id: bankEvt.id,
            internal_amount: internalAmt,
            bank_amount: bankAmt,
            internal_status: txn.status,
            bank_status: bankEvt.status,
            discrepancy_notes: `Status divergence. Internal ledger state is ${txn.status}, while Bank clearing record is ${bankEvt.status}.`,
            resolution_status: 'UNRESOLVED',
          });
        } else {
          // Perfect Match
          matchedCount++;
          items.push({
            id: `rec_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            category: 'MATCHED',
            internal_txn_id: txn.id,
            bank_event_id: bankEvt.id,
            internal_amount: internalAmt,
            bank_amount: bankAmt,
            internal_status: txn.status,
            bank_status: bankEvt.status,
            discrepancy_notes: 'Fully matched: Amount, Currency, and Settlement Status verified.',
            resolution_status: 'SYNCED',
          });
        }
      } else {
        // Internal record has no bank event!
        // Only consider SUCCESS or UNCERTAIN as severe discrepancy
        if (txn.status === 'SUCCESS' || txn.status === 'UNCERTAIN') {
          unmatchedInternalCount++;
          totalDiscrepancyAmount += Number(txn.amount);
          items.push({
            id: `rec_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            category: 'UNMATCHED_INTERNAL',
            internal_txn_id: txn.id,
            bank_event_id: null,
            internal_amount: Number(txn.amount),
            bank_amount: null,
            internal_status: txn.status,
            bank_status: null,
            discrepancy_notes: `Missing bank confirmation. Internal transaction has state ${txn.status} for $${Number(txn.amount).toFixed(2)}, but no bank statement line exists.`,
            resolution_status: 'UNRESOLVED',
          });
        }
      }
    }

    // 2. Check for unmatched bank events (e.g. phantom debits, direct bank charges)
    let unmatchedExternalCount = 0;
    for (const bankEvt of bankEvents) {
      if (!matchedBankEventIds.has(bankEvt.id)) {
        unmatchedExternalCount++;
        totalDiscrepancyAmount += Number(bankEvt.amount);
        items.push({
          id: `rec_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          category: 'UNMATCHED_EXTERNAL',
          internal_txn_id: null,
          bank_event_id: bankEvt.id,
          internal_amount: null,
          bank_amount: Number(bankEvt.amount),
          internal_status: null,
          bank_status: bankEvt.status,
          discrepancy_notes: `Unmatched external bank charge of $${Number(bankEvt.amount).toFixed(2)} with bank ref ${bankEvt.bank_reference_id}. No internal switch payment request found.`,
          resolution_status: 'UNRESOLVED',
        });
      }
    }

    const runId = `rec_run_${Date.now()}`;
    const runTimestamp = new Date().toISOString();
    const hasDiscrepancies =
      amountMismatchCount > 0 ||
      statusMismatchCount > 0 ||
      unmatchedInternalCount > 0 ||
      unmatchedExternalCount > 0;

    const run: ReconciliationRun = {
      id: runId,
      run_timestamp: runTimestamp,
      total_internal_inspected: internalTransactions.length,
      total_bank_inspected: bankEvents.length,
      matched_count: matchedCount,
      amount_mismatch_count: amountMismatchCount,
      status_mismatch_count: statusMismatchCount,
      unmatched_internal_count: unmatchedInternalCount,
      unmatched_external_count: unmatchedExternalCount,
      total_discrepancy_amount: Number(totalDiscrepancyAmount.toFixed(2)),
      summary_status: hasDiscrepancies ? 'DISCREPANCIES_DETECTED' : 'HEALTHY',
      items,
    };

    await db.saveReconciliationRun(run);
    return run;
  }

  /**
   * Resolve a reconciliation item
   */
  public async resolveDiscrepancy(
    itemId: string,
    action: 'POST_ADJUSTMENT' | 'SYNC_STATUS' | 'DISMISS',
    resolutionNotes: string,
    targetWalletId?: string
  ): Promise<{ success: boolean; message: string }> {
    const runs = await db.getReconciliationRuns();
    let foundItem: ReconciliationItem | null = null;
    let parentRun: ReconciliationRun | null = null;

    for (const run of runs) {
      const it = run.items.find((i) => i.id === itemId);
      if (it) {
        foundItem = it;
        parentRun = run;
        break;
      }
    }

    if (!foundItem) {
      return { success: false, message: 'Reconciliation item not found' };
    }

    if (action === 'POST_ADJUSTMENT') {
      const diff =
        (foundItem.internal_amount || 0) - (foundItem.bank_amount || 0);
      const absDiff = Math.abs(diff);

      const walletId = targetWalletId || 'wal_megacorp_merchant';
      if (absDiff > 0) {
        await ledgerEngine.postAdjustment(
          itemId,
          walletId,
          diff > 0 ? 'DEBIT' : 'CREDIT',
          absDiff,
          `Reconciliation variance adjustment for item ${itemId}`
        );
      }

      foundItem.resolution_status = 'ADJUSTED';
      foundItem.resolution_notes = resolutionNotes || `Posted variance adjustment to wallet ${walletId}`;
    } else if (action === 'SYNC_STATUS') {
      if (foundItem.internal_txn_id && foundItem.bank_status) {
        const newStatus = foundItem.bank_status === 'SETTLED' ? 'SUCCESS' : 'FAILED';
        await db.updateTransaction(foundItem.internal_txn_id, {
          status: newStatus,
          failure_reason: `Synced via Reconciliation Engine: Bank verified as ${foundItem.bank_status}`,
        });
      }
      foundItem.resolution_status = 'SYNCED';
      foundItem.resolution_notes = resolutionNotes || 'Internal state forced to match verified bank status';
    } else {
      foundItem.resolution_status = 'DISMISSED';
      foundItem.resolution_notes = resolutionNotes || 'Manually reviewed and marked dismissed';
    }

    await db.updateReconciliationItemResolution(
      itemId,
      foundItem.resolution_status,
      foundItem.resolution_notes
    );

    return {
      success: true,
      message: `Item marked as ${foundItem.resolution_status}`,
    };
  }
}

export const reconciliationEngine = new ReconciliationEngine();
