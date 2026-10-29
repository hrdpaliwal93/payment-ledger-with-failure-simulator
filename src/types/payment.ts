export type TransactionStatus =
  | 'INITIATED'
  | 'VALIDATING'
  | 'ROUTED'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'TIMEOUT'
  | 'UNCERTAIN';

export type WalletType = 'CUSTOMER' | 'MERCHANT' | 'ESCROW' | 'SYSTEM_RESERVE';

export interface Wallet {
  id: string;
  owner_name: string;
  account_type: WalletType;
  currency: string;
  balance: number;
  reserved: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  idempotency_key: string;
  source_wallet_id: string;
  destination_wallet_id: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  failure_reason?: string | null;
  failure_code?: string | null;
  routed_gateway: string;
  bank_reference?: string | null;
  created_at: string;
  updated_at: string;
  timeline?: {
    stage: TransactionStatus;
    timestamp: string;
    description: string;
  }[];
}

export type LedgerEntryType = 'DEBIT' | 'CREDIT';

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  wallet_id: string;
  entry_type: LedgerEntryType;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export type BankStatus = 'SETTLED' | 'DECLINED' | 'PENDING' | 'UNKNOWN';

export interface MockBankEvent {
  id: string;
  bank_reference_id: string;
  payment_ref: string;
  amount: number;
  status: BankStatus;
  raw_payload: string;
  settled_at: string;
  created_at: string;
}

export type DiscrepancyCategory =
  | 'MATCHED'
  | 'AMOUNT_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'UNMATCHED_INTERNAL'
  | 'UNMATCHED_EXTERNAL';

export type ResolutionStatus =
  | 'UNRESOLVED'
  | 'INVESTIGATING'
  | 'ADJUSTED'
  | 'SYNCED'
  | 'DISMISSED';

export interface ReconciliationItem {
  id: string;
  category: DiscrepancyCategory;
  internal_txn_id?: string | null;
  bank_event_id?: string | null;
  internal_amount?: number | null;
  bank_amount?: number | null;
  internal_status?: TransactionStatus | null;
  bank_status?: BankStatus | null;
  discrepancy_notes: string;
  resolution_status: ResolutionStatus;
  resolution_notes?: string | null;
}

export interface ReconciliationRun {
  id: string;
  run_timestamp: string;
  total_internal_inspected: number;
  total_bank_inspected: number;
  matched_count: number;
  amount_mismatch_count: number;
  status_mismatch_count: number;
  unmatched_internal_count: number;
  unmatched_external_count: number;
  total_discrepancy_amount: number;
  summary_status: 'HEALTHY' | 'DISCREPANCIES_DETECTED';
  items: ReconciliationItem[];
}

export type FailureScenario =
  | 'NONE'
  | 'NETWORK_TIMEOUT'
  | 'INSUFFICIENT_FUNDS'
  | 'BANK_500_ERROR'
  | 'IDEMPOTENCY_REPLAY'
  | 'DELAYED_SETTLEMENT'
  | 'AMOUNT_TAMPERING'
  | 'PHANTOM_BANK_DEBIT'
  | 'MISSING_BANK_EVENT'
  | 'STATUS_MISMATCH';

export interface SimulationConfig {
  active_scenario: FailureScenario;
  network_delay_ms: number;
  random_failure_rate: number; // 0 to 1
  auto_reconciliation: boolean;
}

export interface ProcessPaymentRequest {
  idempotency_key?: string;
  source_wallet_id: string;
  destination_wallet_id: string;
  amount: number;
  currency?: string;
  scenario?: FailureScenario;
}
