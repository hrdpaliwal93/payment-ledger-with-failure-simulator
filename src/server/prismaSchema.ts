/**
 * Prisma Schema and PostgreSQL DDL definitions for Mini Payment Switch & Ledger Platform
 * Compatible with Neon DB PostgreSQL
 */

export const PRISMA_SCHEMA_TEXT = `// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum AccountType {
  CUSTOMER
  MERCHANT
  ESCROW
  SYSTEM_RESERVE
}

enum TransactionStatus {
  INITIATED
  VALIDATING
  ROUTED
  PROCESSING
  SUCCESS
  FAILED
  TIMEOUT
  UNCERTAIN
}

enum LedgerEntryType {
  DEBIT
  CREDIT
}

enum BankStatus {
  SETTLED
  DECLINED
  PENDING
  UNKNOWN
}

enum DiscrepancyCategory {
  MATCHED
  AMOUNT_MISMATCH
  STATUS_MISMATCH
  UNMATCHED_INTERNAL
  UNMATCHED_EXTERNAL
}

enum ResolutionStatus {
  UNRESOLVED
  INVESTIGATING
  ADJUSTED
  SYNCED
  DISMISSED
}

model Wallet {
  id           String             @id
  ownerName    String             @map("owner_name")
  accountType  AccountType        @map("account_type")
  currency     String             @default("USD")
  balance      Decimal            @db.Decimal(14, 2)
  reserved     Decimal            @default(0.00) @db.Decimal(14, 2)
  createdAt    DateTime           @default(now()) @map("created_at")
  updatedAt    DateTime           @updatedAt @map("updated_at")

  sourceTxns   PaymentTransaction[] @relation("SourceWallet")
  destTxns     PaymentTransaction[] @relation("DestinationWallet")
  ledgerEntries LedgerEntry[]

  @@map("wallets")
}

model PaymentTransaction {
  id                  String             @id
  idempotencyKey      String             @unique @map("idempotency_key")
  sourceWalletId      String             @map("source_wallet_id")
  destinationWalletId String             @map("destination_wallet_id")
  amount              Decimal            @db.Decimal(14, 2)
  currency            String             @default("USD")
  status              TransactionStatus  @default(INITIATED)
  failureReason       String?            @map("failure_reason")
  failureCode         String?            @map("failure_code")
  routedGateway       String             @default("MOCK_BANK_GATEWAY") @map("routed_gateway")
  bankReference       String?            @map("bank_reference")
  createdAt           DateTime           @default(now()) @map("created_at")
  updatedAt           DateTime           @updatedAt @map("updated_at")

  sourceWallet        Wallet             @relation("SourceWallet", fields: [sourceWalletId], references: [id])
  destinationWallet   Wallet             @relation("DestinationWallet", fields: [destinationWalletId], references: [id])
  ledgerEntries       LedgerEntry[]

  @@index([idempotencyKey])
  @@index([status])
  @@map("payment_transactions")
}

model LedgerEntry {
  id             String          @id
  transactionId  String          @map("transaction_id")
  walletId       String          @map("wallet_id")
  entryType      LedgerEntryType @map("entry_type")
  amount         Decimal         @db.Decimal(14, 2)
  balanceBefore  Decimal         @map("balance_before") @db.Decimal(14, 2)
  balanceAfter   Decimal         @map("balance_after") @db.Decimal(14, 2)
  description    String
  createdAt      DateTime        @default(now()) @map("created_at")

  transaction    PaymentTransaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  wallet         Wallet             @relation(fields: [walletId], references: [id])

  @@index([transactionId])
  @@index([walletId])
  @@map("ledger_entries")
}

model MockBankEvent {
  id              String     @id
  bankReferenceId String     @unique @map("bank_reference_id")
  paymentRef      String     @map("payment_ref")
  amount          Decimal    @db.Decimal(14, 2)
  status          BankStatus @default(PENDING)
  rawPayload      String     @map("raw_payload")
  settledAt       DateTime   @default(now()) @map("settled_at")
  createdAt       DateTime   @default(now()) @map("created_at")

  @@index([paymentRef])
  @@map("mock_bank_events")
}

model ReconciliationRun {
  id                      String          @id
  runTimestamp            DateTime        @default(now()) @map("run_timestamp")
  totalInternalInspected  Int             @map("total_internal_inspected")
  totalBankInspected      Int             @map("total_bank_inspected")
  matchedCount            Int             @map("matched_count")
  amountMismatchCount     Int             @map("amount_mismatch_count")
  statusMismatchCount     Int             @map("status_mismatch_count")
  unmatchedInternalCount  Int             @map("unmatched_internal_count")
  unmatchedExternalCount  Int             @map("unmatched_external_count")
  totalDiscrepancyAmount  Decimal         @map("total_discrepancy_amount") @db.Decimal(14, 2)
  summaryStatus           String          @map("summary_status")
  items                   ReconciliationItem[]

  @@map("reconciliation_runs")
}

model ReconciliationItem {
  id                 String              @id
  reconciliationId   String              @map("reconciliation_id")
  category           DiscrepancyCategory
  internalTxnId      String?             @map("internal_txn_id")
  bankEventId        String?             @map("bank_event_id")
  internalAmount     Decimal?            @map("internal_amount") @db.Decimal(14, 2)
  bankAmount         Decimal?            @map("bank_amount") @db.Decimal(14, 2)
  internalStatus     String?             @map("internal_status")
  bankStatus         String?             @map("bank_status")
  discrepancyNotes   String              @map("discrepancy_notes")
  resolutionStatus   ResolutionStatus    @default(UNRESOLVED) @map("resolution_status")
  resolutionNotes    String?             @map("resolution_notes")

  reconciliation     ReconciliationRun   @relation(fields: [reconciliationId], references: [id], onDelete: Cascade)

  @@index([reconciliationId])
  @@map("reconciliation_items")
}
`;

export const POSTGRES_DDL_TEXT = `-- PostgreSQL DDL for Neon DB
-- Mini Payment Switch & Ledger Platform

CREATE TABLE IF NOT EXISTS wallets (
    id VARCHAR(64) PRIMARY KEY,
    owner_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(32) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    reserved NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id VARCHAR(64) PRIMARY KEY,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    source_wallet_id VARCHAR(64) NOT NULL REFERENCES wallets(id),
    destination_wallet_id VARCHAR(64) NOT NULL REFERENCES wallets(id),
    amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(32) NOT NULL,
    failure_reason TEXT,
    failure_code VARCHAR(64),
    routed_gateway VARCHAR(64) DEFAULT 'MOCK_BANK_GATEWAY',
    bank_reference VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_txn_idempotency ON payment_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_txn_status ON payment_transactions(status);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
    wallet_id VARCHAR(64) NOT NULL REFERENCES wallets(id),
    entry_type VARCHAR(10) NOT NULL, -- 'DEBIT' or 'CREDIT'
    amount NUMERIC(14, 2) NOT NULL,
    balance_before NUMERIC(14, 2) NOT NULL,
    balance_after NUMERIC(14, 2) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_txn ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet ON ledger_entries(wallet_id);

CREATE TABLE IF NOT EXISTS mock_bank_events (
    id VARCHAR(64) PRIMARY KEY,
    bank_reference_id VARCHAR(128) UNIQUE NOT NULL,
    payment_ref VARCHAR(64) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    status VARCHAR(32) NOT NULL,
    raw_payload TEXT NOT NULL,
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_pay_ref ON mock_bank_events(payment_ref);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id VARCHAR(64) PRIMARY KEY,
    run_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_internal_inspected INT NOT NULL,
    total_bank_inspected INT NOT NULL,
    matched_count INT NOT NULL,
    amount_mismatch_count INT NOT NULL,
    status_mismatch_count INT NOT NULL,
    unmatched_internal_count INT NOT NULL,
    unmatched_external_count INT NOT NULL,
    total_discrepancy_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    summary_status VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS reconciliation_items (
    id VARCHAR(64) PRIMARY KEY,
    reconciliation_id VARCHAR(64) NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
    category VARCHAR(64) NOT NULL,
    internal_txn_id VARCHAR(64),
    bank_event_id VARCHAR(64),
    internal_amount NUMERIC(14, 2),
    bank_amount NUMERIC(14, 2),
    internal_status VARCHAR(32),
    bank_status VARCHAR(32),
    discrepancy_notes TEXT NOT NULL,
    resolution_status VARCHAR(32) DEFAULT 'UNRESOLVED',
    resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_recon_items_run ON reconciliation_items(reconciliation_id);
`;
