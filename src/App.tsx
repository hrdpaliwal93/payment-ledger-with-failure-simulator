import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, TabType } from './components/Navbar.tsx';
import { PaymentSwitchTerminal } from './components/PaymentSwitchTerminal.tsx';
import { LedgerWalletsView } from './components/LedgerWalletsView.tsx';
import { FailureSimulatorView } from './components/FailureSimulatorView.tsx';
import { ReconciliationView } from './components/ReconciliationView.tsx';
import { SchemaView } from './components/SchemaView.tsx';
import { DatabaseModal } from './components/DatabaseModal.tsx';
import { ResetConfirmModal } from './components/ResetConfirmModal.tsx';
import { apiClient } from './services/apiClient.ts';
import { CheckCircle2 } from 'lucide-react';
import {
  Wallet,
  PaymentTransaction,
  LedgerEntry,
  MockBankEvent,
  ReconciliationRun,
  SimulationConfig,
  ProcessPaymentRequest,
} from './types/payment.ts';
import { DatabaseStatus } from './server/db.ts';
import { LedgerAuditMetrics } from './server/ledgerEngine.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('switch');
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerMetrics, setLedgerMetrics] = useState<LedgerAuditMetrics | null>(null);
  const [bankEvents, setBankEvents] = useState<MockBankEvent[]>([]);
  const [simulatorConfig, setSimulatorConfig] = useState<SimulationConfig>({
    active_scenario: 'NONE',
    network_delay_ms: 300,
    random_failure_rate: 0,
    auto_reconciliation: false,
  });
  const [latestReconRun, setLatestReconRun] = useState<ReconciliationRun | null>(null);
  const [prismaSchema, setPrismaSchema] = useState<string>('');
  const [postgresDdl, setPostgresDdl] = useState<string>('');

  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetSuccessToast, setResetSuccessToast] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isStressRunning, setIsStressRunning] = useState(false);

  // Load baseline data from Express backend
  const refreshAllData = useCallback(async () => {
    try {
      const [
        statusRes,
        walletsRes,
        txnsRes,
        ledgerRes,
        metricsRes,
        bankRes,
        reconRes,
        schemaRes,
      ] = await Promise.all([
        apiClient.getStatus().catch(() => null),
        apiClient.getWallets().catch(() => []),
        apiClient.getTransactions().catch(() => []),
        apiClient.getLedgerEntries().catch(() => []),
        apiClient.getLedgerMetrics().catch(() => null),
        apiClient.getBankEvents().catch(() => []),
        apiClient.getReconciliationRuns().catch(() => []),
        apiClient.getSchema().catch(() => ({ prisma: '', postgresDdl: '' })),
      ]);

      if (statusRes) {
        setDbStatus(statusRes.database);
        setSimulatorConfig(statusRes.simulator);
      }
      setWallets(walletsRes);
      setTransactions(txnsRes);
      setLedgerEntries(ledgerRes);
      setLedgerMetrics(metricsRes);
      setBankEvents(bankRes);
      if (reconRes && reconRes.length > 0) {
        setLatestReconRun(reconRes[0]);
      } else {
        setLatestReconRun(null);
      }
      if (schemaRes) {
        setPrismaSchema(schemaRes.prisma);
        setPostgresDdl(schemaRes.postgresDdl);
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Handler: Process Payment via Switch
  const handleProcessPayment = async (req: ProcessPaymentRequest) => {
    setIsLoading(true);
    try {
      const res = await apiClient.processPayment(req);
      await refreshAllData();
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Update Simulator Config
  const handleUpdateSimulatorConfig = async (updates: Partial<SimulationConfig>) => {
    const updated = await apiClient.updateSimulatorConfig(updates);
    setSimulatorConfig(updated);
  };

  // Handler: Inject Phantom Bank Debit
  const handleInjectPhantom = async (amt: number) => {
    const res = await apiClient.injectPhantomBankDebit(amt);
    await refreshAllData();
    return res.event;
  };

  // Handler: Run Batch Stress Simulation
  const handleRunBatchStress = async (count: number = 10) => {
    setIsStressRunning(true);
    try {
      const scenarios: ProcessPaymentRequest['scenario'][] = [
        'NONE',
        'NONE',
        'NETWORK_TIMEOUT',
        'INSUFFICIENT_FUNDS',
        'NONE',
        'BANK_500_ERROR',
        'AMOUNT_TAMPERING',
        'NONE',
        'STATUS_MISMATCH',
        'NONE',
      ];

      for (let i = 0; i < count; i++) {
        const sc = scenarios[i % scenarios.length];
        const randomAmount = Number((20 + Math.random() * 150).toFixed(2));
        const src = i % 3 === 0 ? 'wal_bob_customer' : 'wal_alice_customer';
        const dst = i % 2 === 0 ? 'wal_megacorp_merchant' : 'wal_coffee_merchant';

        await apiClient.processPayment({
          source_wallet_id: src,
          destination_wallet_id: dst,
          amount: randomAmount,
          currency: 'USD',
          idempotency_key: `stress_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
          scenario: sc,
        });
      }

      await refreshAllData();
    } catch (err) {
      console.error('Stress simulation error:', err);
    } finally {
      setIsStressRunning(false);
    }
  };

  // Handler: Run Reconciliation
  const handleRunReconciliation = async () => {
    setIsLoading(true);
    try {
      const run = await apiClient.runReconciliation();
      setLatestReconRun(run);
      await refreshAllData();
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Resolve Discrepancy
  const handleResolveItem = async (
    itemId: string,
    action: 'POST_ADJUSTMENT' | 'SYNC_STATUS' | 'DISMISS',
    notes: string,
    targetWalletId?: string
  ) => {
    await apiClient.resolveReconciliationItem(itemId, action, notes, targetWalletId);
    await refreshAllData();
  };

  // Handler: Open Reset Modal
  const handleOpenResetModal = () => {
    setIsResetModalOpen(true);
  };

  // Handler: Execute Complete Database & Platform Reset
  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await apiClient.resetDatabase();
      await refreshAllData();
      setIsResetModalOpen(false);
      setResetSuccessToast('All platform data, transactions, and ledger entries reset to baseline seed.');
      setTimeout(() => setResetSuccessToast(null), 4000);
    } catch (err: any) {
      console.error('Reset error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Handler: Connect to Neon Database
  const handleConnectDb = async (url: string) => {
    const res = await apiClient.connectDatabase(url);
    if (res.success) {
      setDbStatus(res.status);
      await refreshAllData();
      return true;
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dbStatus={dbStatus}
        ledgerMetrics={ledgerMetrics}
        onOpenDbModal={() => setIsDbModalOpen(true)}
        onResetData={handleOpenResetModal}
        isResetting={isResetting}
      />

      {/* Floating Reset / Notification Toast */}
      {resetSuccessToast && (
        <div className="fixed top-20 right-6 z-50 p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-700/80 text-emerald-200 text-xs font-medium shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{resetSuccessToast}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'switch' && (
          <PaymentSwitchTerminal
            wallets={wallets}
            transactions={transactions}
            onProcessPayment={handleProcessPayment}
            isLoading={isLoading}
            onRefresh={refreshAllData}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerWalletsView
            wallets={wallets}
            ledgerEntries={ledgerEntries}
            metrics={ledgerMetrics}
            onRefresh={refreshAllData}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'simulator' && (
          <FailureSimulatorView
            config={simulatorConfig}
            onUpdateConfig={handleUpdateSimulatorConfig}
            onInjectPhantom={handleInjectPhantom}
            onRunBatchStress={handleRunBatchStress}
            isStressRunning={isStressRunning}
          />
        )}

        {activeTab === 'reconciliation' && (
          <ReconciliationView
            latestRun={latestReconRun}
            onRunReconciliation={handleRunReconciliation}
            onResolveItem={handleResolveItem}
            wallets={wallets}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'schema' && (
          <SchemaView
            prismaSchema={prismaSchema}
            postgresDdl={postgresDdl}
            bankEvents={bankEvents}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Mini Payment Switch & Ledger Platform • TDD Educational Implementation</span>
          <div className="flex items-center space-x-3 text-[11px] font-mono">
            <span className="text-cyan-400">Node.js + Express</span>
            <span>•</span>
            <span className="text-indigo-400">PostgreSQL (Neon) / Prisma</span>
            <span>•</span>
            <span className="text-emerald-400">React + Tailwind</span>
          </div>
        </div>
      </footer>

      {/* Database Connection & Inspector Modal */}
      <DatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        status={dbStatus}
        onConnect={handleConnectDb}
        onRefresh={refreshAllData}
      />

      {/* Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmReset}
        isResetting={isResetting}
      />
    </div>
  );
}
