import React, { useState } from 'react';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Ghost,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ReconciliationRun,
  ReconciliationItem,
  DiscrepancyCategory,
  ResolutionStatus,
  Wallet,
} from '../types/payment.ts';

interface ReconciliationViewProps {
  latestRun: ReconciliationRun | null;
  onRunReconciliation: () => Promise<void>;
  onResolveItem: (
    itemId: string,
    action: 'POST_ADJUSTMENT' | 'SYNC_STATUS' | 'DISMISS',
    notes: string,
    targetWalletId?: string
  ) => Promise<void>;
  wallets: Wallet[];
  isLoading: boolean;
}

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({
  latestRun,
  onRunReconciliation,
  onResolveItem,
  wallets,
  isLoading,
}) => {
  const [selectedItem, setSelectedItem] = useState<ReconciliationItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [resolutionAction, setResolutionAction] = useState<'POST_ADJUSTMENT' | 'SYNC_STATUS' | 'DISMISS'>('POST_ADJUSTMENT');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [targetWalletId, setTargetWalletId] = useState('wal_megacorp_merchant');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveSuccess, setResolveSuccess] = useState<string | null>(null);

  const items = latestRun?.items || [];
  const filteredItems = items.filter((item) => {
    if (filterCategory === 'ALL') return true;
    if (filterCategory === 'DISCREPANCIES') return item.category !== 'MATCHED';
    return item.category === filterCategory;
  });

  const handleOpenResolve = (item: ReconciliationItem) => {
    setSelectedItem(item);
    setResolveSuccess(null);
    if (item.category === 'AMOUNT_MISMATCH') {
      setResolutionAction('POST_ADJUSTMENT');
      setResolutionNotes('Post balancing ledger variance adjustment entry');
    } else if (item.category === 'STATUS_MISMATCH') {
      setResolutionAction('SYNC_STATUS');
      setResolutionNotes('Synchronize internal switch status with bank clearing proof');
    } else {
      setResolutionAction('DISMISS');
      setResolutionNotes('Reviewed and categorized by reconciliation auditor');
    }
  };

  const handleExecuteResolution = async () => {
    if (!selectedItem) return;
    setIsResolving(true);
    try {
      await onResolveItem(
        selectedItem.id,
        resolutionAction,
        resolutionNotes,
        targetWalletId
      );
      setResolveSuccess('Discrepancy successfully resolved!');
      setTimeout(() => {
        setSelectedItem(null);
        setResolveSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsResolving(false);
    }
  };

  const renderCategoryBadge = (cat: DiscrepancyCategory) => {
    switch (cat) {
      case 'MATCHED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            MATCHED
          </span>
        );
      case 'AMOUNT_MISMATCH':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-950/70 text-amber-300 border border-amber-800/60">
            <AlertTriangle className="w-3 h-3 mr-1" />
            AMOUNT MISMATCH
          </span>
        );
      case 'STATUS_MISMATCH':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-orange-950/70 text-orange-300 border border-orange-800/60">
            <ShieldAlert className="w-3 h-3 mr-1" />
            STATUS MISMATCH
          </span>
        );
      case 'UNMATCHED_INTERNAL':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-rose-950/70 text-rose-300 border border-rose-800/60">
            <HelpCircle className="w-3 h-3 mr-1" />
            UNMATCHED INTERNAL
          </span>
        );
      case 'UNMATCHED_EXTERNAL':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-pink-950/70 text-pink-300 border border-pink-800/60">
            <Ghost className="w-3 h-3 mr-1" />
            UNMATCHED BANK
          </span>
        );
      default:
        return <span>{cat}</span>;
    }
  };

  const renderResolutionBadge = (status: ResolutionStatus) => {
    switch (status) {
      case 'SYNCED':
      case 'ADJUSTED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
            {status}
          </span>
        );
      case 'DISMISSED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 border border-slate-800 bg-slate-900">
            DISMISSED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
            UNRESOLVED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Reconciliation Header & Trigger Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Scale className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-white text-base">Bank Statement Reconciliation Engine</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Cross-references internal payment switch transactions with external mock bank clearing events to identify
              discrepancies.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {latestRun && (
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                Last Run: {new Date(latestRun.run_timestamp).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={onRunReconciliation}
              disabled={isLoading}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-950/40 flex items-center space-x-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Matching Records...</span>
                </>
              ) : (
                <>
                  <Scale className="w-3.5 h-3.5" />
                  <span>Execute Reconciliation Run</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Matched</span>
            <span className="text-lg font-mono font-bold text-emerald-400 mt-0.5 block">
              {latestRun?.matched_count || 0}
            </span>
            <span className="text-[10px] text-slate-500">Perfect reconciliation</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Amount Mismatch</span>
            <span className="text-lg font-mono font-bold text-amber-400 mt-0.5 block">
              {latestRun?.amount_mismatch_count || 0}
            </span>
            <span className="text-[10px] text-slate-500">Value variances</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Status Mismatch</span>
            <span className="text-lg font-mono font-bold text-orange-400 mt-0.5 block">
              {latestRun?.status_mismatch_count || 0}
            </span>
            <span className="text-[10px] text-slate-500">Divergent outcomes</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Missing Bank Evt</span>
            <span className="text-lg font-mono font-bold text-rose-400 mt-0.5 block">
              {latestRun?.unmatched_internal_count || 0}
            </span>
            <span className="text-[10px] text-slate-500">Unmatched internal</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Phantom Debits</span>
            <span className="text-lg font-mono font-bold text-pink-400 mt-0.5 block">
              {latestRun?.unmatched_external_count || 0}
            </span>
            <span className="text-[10px] text-slate-500">Unmatched bank charges</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Exposure at Risk</span>
            <span className="text-lg font-mono font-bold text-cyan-400 mt-0.5 block">
              ${latestRun?.total_discrepancy_amount?.toFixed(2) || '0.00'}
            </span>
            <span className="text-[10px] text-slate-500">Total discrepancy delta</span>
          </div>
        </div>
      </div>

      {/* Comparison & Discrepancies Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-white text-sm">Reconciliation Item Ledger & Proof of Matching</h3>
            <span className="text-xs font-mono text-slate-500">({filteredItems.length} items)</span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto text-xs scrollbar-none">
            <button
              onClick={() => setFilterCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                filterCategory === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Items ({items.length})
            </button>
            <button
              onClick={() => setFilterCategory('DISCREPANCIES')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                filterCategory === 'DISCREPANCIES'
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Discrepancies Only
            </button>
            <button
              onClick={() => setFilterCategory('MATCHED')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                filterCategory === 'MATCHED'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Matched Only
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <Scale className="w-8 h-8 opacity-40 mx-auto text-cyan-400" />
            <p>No reconciliation run recorded yet.</p>
            <p className="text-[11px] text-slate-600">
              Click &quot;Execute Reconciliation Run&quot; above to inspect internal switch records against bank statements.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Classification</th>
                  <th className="py-2.5 px-3">Internal Record</th>
                  <th className="py-2.5 px-3">Bank Clearing Record</th>
                  <th className="py-2.5 px-3">Amount Delta</th>
                  <th className="py-2.5 px-3">Audit Discrepancy Notes</th>
                  <th className="py-2.5 px-3">Resolution</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredItems.map((item) => {
                  const hasVariance = item.category !== 'MATCHED';
                  const internalAmt = item.internal_amount !== null && item.internal_amount !== undefined ? `$${item.internal_amount.toFixed(2)}` : '—';
                  const bankAmt = item.bank_amount !== null && item.bank_amount !== undefined ? `$${item.bank_amount.toFixed(2)}` : '—';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        hasVariance && item.resolution_status === 'UNRESOLVED' ? 'bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">{renderCategoryBadge(item.category)}</td>
                      <td className="py-2.5 px-3 font-mono">
                        {item.internal_txn_id ? (
                          <div>
                            <span className="text-white block font-semibold">{item.internal_txn_id}</span>
                            <span className="text-[10px] text-slate-400">
                              {internalAmt} • {item.internal_status || 'UNKNOWN'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 italic">No internal record</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {item.bank_event_id ? (
                          <div>
                            <span className="text-cyan-400 block font-semibold">{item.bank_event_id}</span>
                            <span className="text-[10px] text-slate-400">
                              {bankAmt} • {item.bank_status || 'UNKNOWN'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 italic">No bank event logged</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {item.internal_amount !== null &&
                        item.internal_amount !== undefined &&
                        item.bank_amount !== null &&
                        item.bank_amount !== undefined ? (
                          <span
                            className={
                              item.internal_amount === item.bank_amount ? 'text-emerald-400' : 'text-amber-400 font-bold'
                            }
                          >
                            ${Math.abs(item.internal_amount - item.bank_amount).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-xs text-[11px] leading-relaxed">
                        {item.discrepancy_notes}
                        {item.resolution_notes && (
                          <span className="block text-[10px] font-mono text-cyan-400 mt-0.5">
                            Audit note: {item.resolution_notes}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">{renderResolutionBadge(item.resolution_status)}</td>
                      <td className="py-2.5 px-3 text-right">
                        {hasVariance ? (
                          <button
                            onClick={() => handleOpenResolve(item)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 hover:text-white text-xs font-medium transition-all"
                          >
                            Resolve
                          </button>
                        ) : (
                          <span className="text-slate-600 text-xs">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actionable Discrepancy Resolution Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center space-x-2">
                <Scale className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold text-white text-base">Reconciliation Discrepancy Resolution</h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Category:</span>
                  <span className="text-amber-400 font-semibold">{selectedItem.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Internal Record:</span>
                  <span className="text-white">
                    {selectedItem.internal_txn_id || 'None'} ({selectedItem.internal_status || 'N/A'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bank Event:</span>
                  <span className="text-cyan-400">
                    {selectedItem.bank_event_id || 'None'} ({selectedItem.bank_status || 'N/A'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Variance Notes:</span>
                  <span className="text-slate-300 font-sans text-[11px] text-right max-w-xs">
                    {selectedItem.discrepancy_notes}
                  </span>
                </div>
              </div>

              {/* Action selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select Resolution Workflow
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolutionAction('POST_ADJUSTMENT')}
                    className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      resolutionAction === 'POST_ADJUSTMENT'
                        ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Post Ledger Adjustment
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolutionAction('SYNC_STATUS')}
                    className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      resolutionAction === 'SYNC_STATUS'
                        ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Force Sync Status
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolutionAction('DISMISS')}
                    className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      resolutionAction === 'DISMISS'
                        ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Dismiss / Investigate
                  </button>
                </div>
              </div>

              {resolutionAction === 'POST_ADJUSTMENT' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Target Wallet for Adjustment Entry
                  </label>
                  <select
                    value={targetWalletId}
                    onChange={(e) => setTargetWalletId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.owner_name} ({w.id})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    An equal and offsetting adjustment will be posted against the Central Clearing Reserve account.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Resolution Audit Notes
                </label>
                <input
                  type="text"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Corrected settlement fee discrepancy per bank file confirmation"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {resolveSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{resolveSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteResolution}
                  disabled={isResolving}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-950/40 flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isResolving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Resolving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Commit Resolution</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
