import React, { useState } from 'react';
import {
  Wallet as WalletIcon,
  Layers,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  RefreshCw,
  Building,
  User,
  Lock,
} from 'lucide-react';
import { Wallet, LedgerEntry } from '../types/payment.ts';
import { LedgerAuditMetrics } from '../server/ledgerEngine.ts';

interface LedgerWalletsViewProps {
  wallets: Wallet[];
  ledgerEntries: LedgerEntry[];
  metrics: LedgerAuditMetrics | null;
  onRefresh: () => void;
  isLoading: boolean;
}

export const LedgerWalletsView: React.FC<LedgerWalletsViewProps> = ({
  wallets,
  ledgerEntries,
  metrics,
  onRefresh,
  isLoading,
}) => {
  const [walletFilter, setWalletFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const filteredEntries = ledgerEntries.filter((entry) => {
    if (walletFilter !== 'ALL' && entry.wallet_id !== walletFilter) return false;
    if (typeFilter !== 'ALL' && entry.entry_type !== typeFilter) return false;
    return true;
  });

  const getWalletBadgeIcon = (type: string) => {
    switch (type) {
      case 'MERCHANT':
        return <Building className="w-3.5 h-3.5 text-indigo-400" />;
      case 'CUSTOMER':
        return <User className="w-3.5 h-3.5 text-cyan-400" />;
      case 'ESCROW':
      case 'SYSTEM_RESERVE':
        return <Lock className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <WalletIcon className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const handleRefreshClick = async () => {
    setIsRefreshingLocal(true);
    setRefreshSuccess(false);
    try {
      await onRefresh();
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 2500);
    } finally {
      setIsRefreshingLocal(false);
    }
  };

  const isSpinning = isLoading || isRefreshingLocal;

  return (
    <div className="space-y-6">
      {/* Accounting Invariants & Audit Status Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-white text-base">Double-Entry Ledger Integrity Engine</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Enforcing the core accounting equation: <span className="font-mono text-cyan-300">Total Debits == Total Credits</span> across all internal accounts.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {refreshSuccess && (
              <span className="text-xs font-mono text-emerald-400 flex items-center space-x-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Refreshed just now</span>
              </span>
            )}

            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center space-x-1.5 ${
                metrics?.isBalanced
                  ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-700/80 text-rose-300 animate-bounce'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{metrics?.isBalanced ? 'BALANCE INVARIANT SATISFIED' : 'UNBALANCED VARIANCE'}</span>
            </div>

            <button
              onClick={handleRefreshClick}
              disabled={isSpinning}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
              title="Refresh ledger records and balances"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{isSpinning ? 'Refreshing...' : 'Refresh Ledger'}</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">Total Debits Posted</span>
            <span className="text-lg font-mono font-bold text-rose-400 mt-0.5 block">
              ${metrics?.totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
            </span>
            <span className="text-[10px] text-slate-500">Source wallet deductions</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">Total Credits Posted</span>
            <span className="text-lg font-mono font-bold text-emerald-400 mt-0.5 block">
              ${metrics?.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
            </span>
            <span className="text-[10px] text-slate-500">Destination wallet deposits</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">Ledger Variance</span>
            <span className="text-lg font-mono font-bold text-cyan-400 mt-0.5 block">
              ${metrics?.variance.toFixed(2) || '0.00'}
            </span>
            <span className="text-[10px] text-slate-500">Net accounting delta</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">Journal Entries</span>
            <span className="text-lg font-mono font-bold text-white mt-0.5 block">
              {metrics?.entriesCount || ledgerEntries.length}
            </span>
            <span className="text-[10px] text-slate-500">Audited double-entry records</span>
          </div>
        </div>
      </div>

      {/* Wallets & Balances Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <WalletIcon className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-white text-sm">System Wallets & Chart of Accounts</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{wallets.length} Active Accounts</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-lg transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    {getWalletBadgeIcon(wallet.account_type)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-xs truncate max-w-[180px]">
                      {wallet.owner_name}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500">{wallet.id}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                  {wallet.account_type}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Current Balance</span>
                  <span className="text-xl font-mono font-bold text-white">
                    ${wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Currency</span>
                  <span className="text-xs font-mono font-semibold text-cyan-400">{wallet.currency}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Immutable Ledger Entries Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-white text-sm">Double-Entry Journal Stream (Audit Trail)</h3>
            <span className="text-xs font-mono text-slate-500">({filteredEntries.length} entries)</span>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <select
                value={walletFilter}
                onChange={(e) => setWalletFilter(e.target.value)}
                className="bg-transparent text-slate-300 focus:outline-none text-xs"
              >
                <option value="ALL">All Wallets</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.owner_name.split(' ')[0]}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent text-slate-300 focus:outline-none text-xs"
              >
                <option value="ALL">All Types</option>
                <option value="DEBIT">Debits Only</option>
                <option value="CREDIT">Credits Only</option>
              </select>
            </div>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No ledger entries found matching filters. Execute a payment to post journal records.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Entry ID</th>
                  <th className="py-2.5 px-3">Transaction Ref</th>
                  <th className="py-2.5 px-3">Wallet</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Balance Before &rarr; After</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredEntries.map((entry) => {
                  const walletObj = wallets.find((w) => w.id === entry.wallet_id);
                  const isDebit = entry.entry_type === 'DEBIT';

                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3">
                        {isDebit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-950/70 text-rose-300 border border-rose-800/60">
                            <ArrowDownLeft className="w-3 h-3 mr-1" />
                            DEBIT
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                            CREDIT
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-300">{entry.id}</td>
                      <td className="py-2 px-3 font-mono text-cyan-400">{entry.transaction_id}</td>
                      <td className="py-2 px-3 text-slate-300 font-medium">
                        {walletObj?.owner_name || entry.wallet_id}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold">
                        <span className={isDebit ? 'text-rose-400' : 'text-emerald-400'}>
                          {isDebit ? '-' : '+'}${entry.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">
                        ${entry.balance_before.toFixed(2)} &rarr;{' '}
                        <span className="text-white font-semibold">${entry.balance_after.toFixed(2)}</span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                        {new Date(entry.created_at).toLocaleTimeString()}
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
