import React, { useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  AlertOctagon,
  Clock,
  Sparkles,
  Zap,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import {
  Wallet,
  PaymentTransaction,
  FailureScenario,
  ProcessPaymentRequest,
} from '../types/payment.ts';

interface PaymentSwitchTerminalProps {
  wallets: Wallet[];
  transactions: PaymentTransaction[];
  onProcessPayment: (req: ProcessPaymentRequest) => Promise<any>;
  isLoading: boolean;
  onRefresh: () => void;
}

export const PaymentSwitchTerminal: React.FC<PaymentSwitchTerminalProps> = ({
  wallets,
  transactions,
  onProcessPayment,
  isLoading,
  onRefresh,
}) => {
  const [sourceWalletId, setSourceWalletId] = useState<string>('wal_alice_customer');
  const [destWalletId, setDestWalletId] = useState<string>('wal_megacorp_merchant');
  const [amount, setAmount] = useState<string>('150.00');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`
  );
  const [scenario, setScenario] = useState<FailureScenario>('NONE');
  const [copiedKey, setCopiedKey] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<PaymentTransaction | null>(null);
  const [lastResult, setLastResult] = useState<any | null>(null);

  // Active source wallet
  const sourceWallet = wallets.find((w) => w.id === sourceWalletId);
  const destWallet = wallets.find((w) => w.id === destWalletId);

  const generateNewIdempotencyKey = () => {
    setIdempotencyKey(`req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(idempotencyKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    try {
      const res = await onProcessPayment({
        source_wallet_id: sourceWalletId,
        destination_wallet_id: destWalletId,
        amount: numAmount,
        currency: 'USD',
        idempotency_key: idempotencyKey,
        scenario,
      });
      setLastResult(res);
      if (res?.transaction) {
        setSelectedTxn(res.transaction);
      }
    } catch (err) {
      console.error('Payment error:', err);
    }
  };

  const triggerPreset = async (
    presetScenario: FailureScenario,
    presetAmount: string,
    useSameKey: boolean = false
  ) => {
    const key = useSameKey
      ? idempotencyKey
      : `preset_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`;
    if (!useSameKey) setIdempotencyKey(key);
    setScenario(presetScenario);
    setAmount(presetAmount);

    try {
      const res = await onProcessPayment({
        source_wallet_id: sourceWalletId,
        destination_wallet_id: destWalletId,
        amount: parseFloat(presetAmount),
        currency: 'USD',
        idempotency_key: key,
        scenario: presetScenario,
      });
      setLastResult(res);
      if (res?.transaction) setSelectedTxn(res.transaction);
    } catch (err) {
      console.error(err);
    }
  };

  // Status badge styling helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 font-mono">
            <CheckCircle className="w-3 h-3 mr-1" />
            SUCCESS
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-950/70 text-rose-300 border border-rose-800/60 font-mono">
            <XCircle className="w-3 h-3 mr-1" />
            FAILED
          </span>
        );
      case 'UNCERTAIN':
      case 'TIMEOUT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-950/70 text-amber-300 border border-amber-800/60 font-mono">
            <Clock className="w-3 h-3 mr-1" />
            {status}
          </span>
        );
      case 'PROCESSING':
      case 'VALIDATING':
      case 'ROUTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 font-mono animate-pulse">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 font-mono">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Test Presets Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              1-Click Switch Test Scenarios
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Instantly test pipeline routing & failure modes</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            onClick={() => triggerPreset('NONE', '125.00')}
            disabled={isLoading}
            className="flex flex-col items-start p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-left transition-all group disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-emerald-400 flex items-center">
              <Zap className="w-3 h-3 mr-1" /> Happy Path
            </span>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-300">$125.00 Clean Post</span>
          </button>

          <button
            onClick={() => triggerPreset('NETWORK_TIMEOUT', '200.00')}
            disabled={isLoading}
            className="flex flex-col items-start p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-950/20 text-left transition-all group disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-amber-400 flex items-center">
              <Clock className="w-3 h-3 mr-1" /> 504 Timeout
            </span>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-300">Bank drops packet</span>
          </button>

          <button
            onClick={() => triggerPreset('INSUFFICIENT_FUNDS', '9999.00')}
            disabled={isLoading}
            className="flex flex-col items-start p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-rose-500/50 hover:bg-rose-950/20 text-left transition-all group disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-rose-400 flex items-center">
              <AlertOctagon className="w-3 h-3 mr-1" /> Low Balance
            </span>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-300">Amount exceeds balance</span>
          </button>

          <button
            onClick={() => triggerPreset('IDEMPOTENCY_REPLAY', '75.00', true)}
            disabled={isLoading}
            className="flex flex-col items-start p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 text-left transition-all group disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-indigo-400 flex items-center">
              <RefreshCw className="w-3 h-3 mr-1" /> Idempotent Replay
            </span>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-300">Re-send duplicate key</span>
          </button>

          <button
            onClick={() => triggerPreset('BANK_500_ERROR', '80.00')}
            disabled={isLoading}
            className="flex flex-col items-start p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-red-500/50 hover:bg-red-950/20 text-left transition-all group disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-red-400 flex items-center">
              <XCircle className="w-3 h-3 mr-1" /> Bank 500 Crash
            </span>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-300">Downstream 500 fatal</span>
          </button>

          <button
            onClick={() => triggerPreset('AMOUNT_TAMPERING', '100.00')}
            disabled={isLoading}
            className="flex flex-col items-start p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/20 text-left transition-all group disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-purple-400 flex items-center">
              <ShieldCheck className="w-3 h-3 mr-1" /> Recon Variance
            </span>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-300">Switch $100 vs Bank $90</span>
          </button>
        </div>
      </div>

      {/* Main Switch Terminal Grid: Left is Form, Right is Pipeline visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Payment Dispatch Form */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm flex items-center">
                <span className="w-2 h-2 rounded-full bg-cyan-400 mr-2 animate-ping" />
                Dispatch Payment Request
              </h3>
              <span className="text-xs text-slate-400 font-mono">POST /api/payments</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Source Account */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Source Wallet (Debited)
                </label>
                <select
                  value={sourceWalletId}
                  onChange={(e) => setSourceWalletId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.owner_name} — Balance: ${w.balance.toFixed(2)} ({w.account_type})
                    </option>
                  ))}
                </select>
                {sourceWallet && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
                    <span>Available: ${(sourceWallet.balance - sourceWallet.reserved).toFixed(2)}</span>
                    <span className="font-mono text-cyan-400">{sourceWallet.currency}</span>
                  </div>
                )}
              </div>

              {/* Destination Account */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Destination Wallet (Credited)
                </label>
                <select
                  value={destWalletId}
                  onChange={(e) => setDestWalletId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                >
                  {wallets
                    .filter((w) => w.id !== sourceWalletId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.owner_name} — Balance: ${w.balance.toFixed(2)} ({w.account_type})
                      </option>
                    ))}
                </select>
                {destWallet && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
                    <span>Current Balance: ${destWallet.balance.toFixed(2)}</span>
                    <span className="font-mono text-cyan-400">{destWallet.currency}</span>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Amount ($ USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500 text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Idempotency Key */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Idempotency Key (Deduplication)
                  </label>
                  <button
                    type="button"
                    onClick={generateNewIdempotencyKey}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>New Key</span>
                  </button>
                </div>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    value={idempotencyKey}
                    onChange={(e) => setIdempotencyKey(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Submitting with an existing key tests idempotent caching (no duplicate charges).
                </p>
              </div>

              {/* Failure Simulator Override */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Failure Simulator Injection
                </label>
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value as FailureScenario)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                >
                  <option value="NONE">NONE — Clean Execution (Happy Path)</option>
                  <option value="NETWORK_TIMEOUT">NETWORK_TIMEOUT — 504 Gateway Timeout (Uncertain)</option>
                  <option value="INSUFFICIENT_FUNDS">INSUFFICIENT_FUNDS — Reject at Switch Validation</option>
                  <option value="BANK_500_ERROR">BANK_500_ERROR — Bank drops transaction</option>
                  <option value="AMOUNT_TAMPERING">AMOUNT_TAMPERING — Bank settles different amount</option>
                  <option value="MISSING_BANK_EVENT">MISSING_BANK_EVENT — Bank record lost</option>
                  <option value="STATUS_MISMATCH">STATUS_MISMATCH — Switch Fails vs Bank Settles</option>
                  <option value="DELAYED_SETTLEMENT">DELAYED_SETTLEMENT — Left in PROCESSING</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-900/40 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing through Switch Pipeline...</span>
                  </>
                ) : (
                  <>
                    <span>Route & Execute Payment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Design principle note */}
          <div className="pt-4 mt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Design Guarantee:</strong> Financial records are updated strictly upon validated payment
              outcomes. Failed operations leave wallet balances intact.
            </span>
          </div>
        </div>

        {/* Right Column: Real-time State Machine Visualizer */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm flex items-center">
                <span className="w-2 h-2 rounded-full bg-indigo-400 mr-2" />
                Switch State Machine & Transaction Inspector
              </h3>
              {selectedTxn && renderStatusBadge(selectedTxn.status)}
            </div>

            {selectedTxn ? (
              <div className="space-y-4">
                {/* Result Highlights */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Amount</span>
                    <span className="font-mono font-semibold text-white text-sm">
                      ${selectedTxn.amount.toFixed(2)} {selectedTxn.currency}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Ledger Posted</span>
                    <span
                      className={`font-semibold ${
                        lastResult?.ledgerPosted ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    >
                      {lastResult?.ledgerPosted ? 'Double-Entry OK' : 'Zero (Untouched)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Idempotency</span>
                    <span
                      className={`font-semibold ${
                        lastResult?.idempotentReplay ? 'text-indigo-400' : 'text-slate-300'
                      }`}
                    >
                      {lastResult?.idempotentReplay ? 'Cache Hit (Replay)' : 'Unique Request'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Bank Event</span>
                    <span
                      className={`font-semibold ${
                        lastResult?.bankEventCreated ? 'text-cyan-400' : 'text-slate-400'
                      }`}
                    >
                      {lastResult?.bankEventCreated ? 'Logged by Bank' : 'None / Dropped'}
                    </span>
                  </div>
                </div>

                {/* State Machine Pipeline */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-2 font-mono uppercase tracking-wider">
                    Pipeline Stages
                  </h4>
                  <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                    {(selectedTxn.timeline || [
                      {
                        stage: selectedTxn.status,
                        timestamp: selectedTxn.created_at,
                        description: 'Transaction state recorded',
                      },
                    ]).map((item, idx) => (
                      <div key={idx} className="relative">
                        <div
                          className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 ${
                            item.stage === 'SUCCESS'
                              ? 'bg-emerald-500 border-emerald-950'
                              : item.stage === 'FAILED'
                              ? 'bg-rose-500 border-rose-950'
                              : item.stage === 'UNCERTAIN' || item.stage === 'TIMEOUT'
                              ? 'bg-amber-500 border-amber-950'
                              : 'bg-cyan-500 border-cyan-950'
                          }`}
                        />
                        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono font-semibold text-white">{item.stage}</span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px]">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key metadata */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Transaction ID:</span>
                    <span className="text-white">{selectedTxn.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Idempotency Key:</span>
                    <span className="text-slate-300 truncate max-w-[240px]">{selectedTxn.idempotency_key}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gateway Reference:</span>
                    <span className="text-cyan-400">{selectedTxn.bank_reference || 'N/A'}</span>
                  </div>
                  {selectedTxn.failure_code && (
                    <div className="flex justify-between text-rose-400">
                      <span>Failure Code:</span>
                      <span>{selectedTxn.failure_code}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs text-center space-y-2">
                <ArrowRight className="w-8 h-8 opacity-40 animate-pulse text-cyan-400" />
                <p>No transaction selected yet.</p>
                <p className="text-[11px] text-slate-600">
                  Dispatch a payment or click a 1-click test preset above to inspect the switch execution pipeline.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Processed Transactions History Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-white text-sm">Payment Switch Transaction Journal</h3>
            <span className="text-xs font-mono text-slate-400">({transactions.length} records)</span>
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No transactions executed yet. Run your first payment to view history.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Txn ID</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Source &rarr; Destination</th>
                  <th className="py-2.5 px-3">Bank Reference</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {transactions.map((txn) => {
                  const src = wallets.find((w) => w.id === txn.source_wallet_id)?.owner_name || txn.source_wallet_id;
                  const dst = wallets.find((w) => w.id === txn.destination_wallet_id)?.owner_name || txn.destination_wallet_id;
                  const isSelected = selectedTxn?.id === txn.id;

                  return (
                    <tr
                      key={txn.id}
                      onClick={() => setSelectedTxn(txn)}
                      className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        isSelected ? 'bg-cyan-950/30' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">{renderStatusBadge(txn.status)}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{txn.id}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-white">
                        ${txn.amount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 truncate max-w-xs">
                        <span className="text-slate-400">{src.split(' ')[0]}</span> &rarr;{' '}
                        <span className="text-white">{dst.split(' ')[0]}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {txn.bank_reference || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                        {new Date(txn.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTxn(txn);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
