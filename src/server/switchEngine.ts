import {
  PaymentTransaction,
  ProcessPaymentRequest,
  TransactionStatus,
  MockBankEvent,
} from '../types/payment.ts';
import { db } from './db.ts';
import { ledgerEngine } from './ledgerEngine.ts';
import { failureSimulator } from './failureSimulator.ts';

export class PaymentSwitch {
  /**
   * Process a payment request through the switch pipeline.
   */
  public async processPayment(req: ProcessPaymentRequest): Promise<{
    transaction: PaymentTransaction;
    idempotentReplay: boolean;
    ledgerPosted: boolean;
    bankEventCreated: boolean;
  }> {
    const idempotencyKey =
      req.idempotency_key && req.idempotency_key.trim() !== ''
        ? req.idempotency_key.trim()
        : `idem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const scenario = failureSimulator.resolveScenario(req.scenario);
    const delay = failureSimulator.getConfig().network_delay_ms;

    // --- STEP 1: Idempotency Check ---
    const existingTxn = await db.getTransactionByIdempotencyKey(idempotencyKey);
    if (existingTxn) {
      // If client requests IDEMPOTENCY_REPLAY or sends same key: return immediately!
      return {
        transaction: existingTxn,
        idempotentReplay: true,
        ledgerPosted: false,
        bankEventCreated: false,
      };
    }

    const txnId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const transaction: PaymentTransaction = {
      id: txnId,
      idempotency_key: idempotencyKey,
      source_wallet_id: req.source_wallet_id,
      destination_wallet_id: req.destination_wallet_id,
      amount: req.amount,
      currency: req.currency || 'USD',
      status: 'INITIATED',
      routed_gateway: 'MOCK_BANK_GATEWAY_V1',
      created_at: now,
      updated_at: now,
      timeline: [
        {
          stage: 'INITIATED',
          timestamp: now,
          description: `Transaction initiated with key ${idempotencyKey}`,
        },
      ],
    };

    await db.createTransaction(transaction);

    // --- STEP 2: Validation ---
    const validationTime = new Date().toISOString();
    transaction.status = 'VALIDATING';
    transaction.timeline?.push({
      stage: 'VALIDATING',
      timestamp: validationTime,
      description: 'Validating accounts, balances, and routing policies',
    });
    await db.updateTransaction(txnId, { status: 'VALIDATING', timeline: transaction.timeline });

    // Validate accounts
    const sourceWallet = await db.getWallet(req.source_wallet_id);
    const destWallet = await db.getWallet(req.destination_wallet_id);

    if (!sourceWallet) {
      return this.failTransaction(txnId, transaction, 'SOURCE_WALLET_NOT_FOUND', 'Source wallet not found');
    }
    if (!destWallet) {
      return this.failTransaction(txnId, transaction, 'DESTINATION_WALLET_NOT_FOUND', 'Destination wallet not found');
    }
    if (req.amount <= 0) {
      return this.failTransaction(txnId, transaction, 'INVALID_AMOUNT', 'Amount must be greater than zero');
    }

    // Check balance / Insufficient Funds scenario
    const effectiveBalance = sourceWallet.balance - sourceWallet.reserved;
    if (scenario === 'INSUFFICIENT_FUNDS' || effectiveBalance < req.amount) {
      return this.failTransaction(
        txnId,
        transaction,
        'INSUFFICIENT_FUNDS',
        `Insufficient funds. Available: $${effectiveBalance.toFixed(2)}, Requested: $${req.amount.toFixed(2)}`
      );
    }

    // --- STEP 3: Routing ---
    const routedTime = new Date().toISOString();
    transaction.status = 'ROUTED';
    transaction.timeline?.push({
      stage: 'ROUTED',
      timestamp: routedTime,
      description: 'Routed to Mock Bank Gateway via ACH/Interbank Switch',
    });
    await db.updateTransaction(txnId, { status: 'ROUTED', timeline: transaction.timeline });

    // --- STEP 4: Processing with Failure Simulator scenarios ---
    const processingTime = new Date().toISOString();
    transaction.status = 'PROCESSING';
    transaction.timeline?.push({
      stage: 'PROCESSING',
      timestamp: processingTime,
      description: 'Dispatching payload to banking partner clearing network',
    });
    await db.updateTransaction(txnId, { status: 'PROCESSING', timeline: transaction.timeline });

    // Simulated network delay
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 2000)));
    }

    // SCENARIO: Network Timeout (504 Gateway Timeout -> UNCERTAIN)
    if (scenario === 'NETWORK_TIMEOUT') {
      const timeoutTime = new Date().toISOString();
      transaction.status = 'UNCERTAIN';
      transaction.failure_code = 'GATEWAY_TIMEOUT_504';
      transaction.failure_reason = 'Network timeout waiting for bank acknowledgement. Transaction state uncertain.';
      transaction.timeline?.push({
        stage: 'UNCERTAIN',
        timestamp: timeoutTime,
        description: 'Gateway timeout (504). Downstream bank status unknown. Held for reconciliation.',
      });
      await db.updateTransaction(txnId, {
        status: 'UNCERTAIN',
        failure_code: transaction.failure_code,
        failure_reason: transaction.failure_reason,
        timeline: transaction.timeline,
      });

      return {
        transaction,
        idempotentReplay: false,
        ledgerPosted: false,
        bankEventCreated: false,
      };
    }

    // SCENARIO: Bank 500 Internal Error
    if (scenario === 'BANK_500_ERROR') {
      return this.failTransaction(
        txnId,
        transaction,
        'BANK_500_INTERNAL_ERROR',
        'Downstream bank host returned HTTP 500 Internal Server Error'
      );
    }

    // SCENARIO: Status Mismatch (Switch fails, but bank actually settled!)
    if (scenario === 'STATUS_MISMATCH') {
      const bankRef = `BNK_REF_${Date.now()}`;
      // Bank settled event
      const bankEvt: MockBankEvent = {
        id: `bnk_evt_${Date.now()}`,
        bank_reference_id: bankRef,
        payment_ref: txnId,
        amount: req.amount,
        status: 'SETTLED',
        raw_payload: JSON.stringify({ note: 'Processed successfully by core banking core' }),
        settled_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      await db.createBankEvent(bankEvt);

      // Switch falsely thought it failed (e.g. lost response packet)
      return this.failTransaction(
        txnId,
        transaction,
        'CLIENT_CONNECTION_DROPPED',
        'Response connection dropped before ACK received; marked FAILED on switch'
      );
    }

    // SCENARIO: Delayed Settlement
    if (scenario === 'DELAYED_SETTLEMENT') {
      const bankRef = `BNK_REF_${Date.now()}`;
      const bankEvt: MockBankEvent = {
        id: `bnk_evt_${Date.now()}`,
        bank_reference_id: bankRef,
        payment_ref: txnId,
        amount: req.amount,
        status: 'PENDING',
        raw_payload: JSON.stringify({ settlement_window: 'T+2 Business Days' }),
        settled_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      await db.createBankEvent(bankEvt);

      transaction.bank_reference = bankRef;
      transaction.timeline?.push({
        stage: 'PROCESSING',
        timestamp: new Date().toISOString(),
        description: 'Payment in settlement queue. Pending clearing house window.',
      });
      await db.updateTransaction(txnId, { bank_reference: bankRef, timeline: transaction.timeline });

      return {
        transaction,
        idempotentReplay: false,
        ledgerPosted: false,
        bankEventCreated: true,
      };
    }

    // --- STEP 5: SUCCESS FLOW ---
    const bankRef = `BNK_REF_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const successTime = new Date().toISOString();
    transaction.status = 'SUCCESS';
    transaction.bank_reference = bankRef;
    transaction.timeline?.push({
      stage: 'SUCCESS',
      timestamp: successTime,
      description: `Payment confirmed by bank. Bank Reference: ${bankRef}`,
    });

    await db.updateTransaction(txnId, {
      status: 'SUCCESS',
      bank_reference: bankRef,
      timeline: transaction.timeline,
    });

    // Post to Ledger atomically (Double-entry DEBIT & CREDIT)
    await ledgerEngine.postPaymentMovement(txnId, req.source_wallet_id, req.destination_wallet_id, req.amount);

    // Create Mock Bank Event (unless scenario is MISSING_BANK_EVENT)
    let bankEventCreated = false;
    if (scenario !== 'MISSING_BANK_EVENT') {
      let settledAmount = req.amount;
      if (scenario === 'AMOUNT_TAMPERING') {
        // Bank settles different amount (e.g., fee deduction or mismatch)
        settledAmount = Number((req.amount * 0.9).toFixed(2));
      }

      const bankEvt: MockBankEvent = {
        id: `bnk_evt_${Date.now()}`,
        bank_reference_id: bankRef,
        payment_ref: txnId,
        amount: settledAmount,
        status: 'SETTLED',
        raw_payload: JSON.stringify({
          gateway_ref: bankRef,
          interchange_rate: '0.015',
          original_requested: req.amount,
          settled_amount: settledAmount,
          clearing_cycle: 'CYCLE_1',
        }),
        settled_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      await db.createBankEvent(bankEvt);
      bankEventCreated = true;
    }

    return {
      transaction,
      idempotentReplay: false,
      ledgerPosted: true,
      bankEventCreated,
    };
  }

  private async failTransaction(
    txnId: string,
    transaction: PaymentTransaction,
    code: string,
    reason: string
  ): Promise<{
    transaction: PaymentTransaction;
    idempotentReplay: boolean;
    ledgerPosted: boolean;
    bankEventCreated: boolean;
  }> {
    const failTime = new Date().toISOString();
    transaction.status = 'FAILED';
    transaction.failure_code = code;
    transaction.failure_reason = reason;
    transaction.timeline?.push({
      stage: 'FAILED',
      timestamp: failTime,
      description: `Failed: ${reason} (code: ${code})`,
    });

    await db.updateTransaction(txnId, {
      status: 'FAILED',
      failure_code: code,
      failure_reason: reason,
      timeline: transaction.timeline,
    });

    // Failure creates NO ledger entries!
    return {
      transaction,
      idempotentReplay: false,
      ledgerPosted: false,
      bankEventCreated: false,
    };
  }
}

export const paymentSwitch = new PaymentSwitch();
