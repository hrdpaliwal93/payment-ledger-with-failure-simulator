import React from 'react';
import { RotateCcw, AlertTriangle, X, CheckCircle2 } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isResetting: boolean;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isResetting,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Reset Platform State</h3>
              <p className="text-xs text-slate-400">Restore baseline wallets & ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isResetting}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-white">Warning: Complete State Reset</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                This action will wipe all processed switch transactions, clear all double-entry ledger journal entries,
                purge mock bank clearing events, reset the failure simulator back to clean mode, and restore initial seed
                wallet balances.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs font-mono space-y-1 text-slate-400">
            <div className="text-slate-500 font-semibold mb-1">Baseline Seed Restorations:</div>
            <div className="flex justify-between">
              <span>Alice (Customer):</span>
              <span className="text-emerald-400">$5,000.00</span>
            </div>
            <div className="flex justify-between">
              <span>Bob (Customer):</span>
              <span className="text-emerald-400">$120.00</span>
            </div>
            <div className="flex justify-between">
              <span>MegaCorp (Merchant):</span>
              <span className="text-emerald-400">$18,500.00</span>
            </div>
            <div className="flex justify-between">
              <span>Central Bank Clearing:</span>
              <span className="text-cyan-400">$1,000,000.00</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isResetting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isResetting}
              className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-950/50 flex items-center space-x-1.5 transition-all disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>{isResetting ? 'Resetting All Data...' : 'Yes, Reset Everything'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
