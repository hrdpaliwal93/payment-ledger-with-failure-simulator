import React from 'react';
import {
  ArrowLeftRight,
  Database,
  RotateCcw,
  ShieldCheck,
  Activity,
  Layers,
  Sliders,
  Scale,
  FileCode2,
} from 'lucide-react';
import { DatabaseStatus } from '../server/db.ts';
import { LedgerAuditMetrics } from '../server/ledgerEngine.ts';

export type TabType = 'switch' | 'ledger' | 'simulator' | 'reconciliation' | 'schema';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  dbStatus: DatabaseStatus | null;
  ledgerMetrics: LedgerAuditMetrics | null;
  onOpenDbModal: () => void;
  onResetData: () => void;
  isResetting: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  dbStatus,
  ledgerMetrics,
  onOpenDbModal,
  onResetData,
  isResetting,
}) => {
  const isPostgres = dbStatus?.provider === 'NEON_POSTGRES' && dbStatus?.connected;

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      {/* Top bar with branding, metrics & actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-violet-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-white tracking-tight text-base sm:text-lg">
                  PaySwitch<span className="text-cyan-400 font-mono">Ledger</span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 font-semibold">
                  TDD MVP
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Switch Engine • Double-Entry Ledger • Failure Simulator • Bank Recon
              </p>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center space-x-3">
            {/* Double-Entry Invariant Badge */}
            {ledgerMetrics && (
              <div
                className={`hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                  ledgerMetrics.isBalanced
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    : 'bg-rose-950/50 border-rose-800/80 text-rose-300 animate-pulse'
                }`}
                title={`Total Debits: $${ledgerMetrics.totalDebits} | Total Credits: $${ledgerMetrics.totalCredits}`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {ledgerMetrics.isBalanced
                    ? `Ledger Balanced ($${ledgerMetrics.totalDebits.toLocaleString()})`
                    : `Variance Alert: $${ledgerMetrics.variance}`}
                </span>
              </div>
            )}

            {/* Neon DB / In-Memory Status Badge */}
            <button
              onClick={onOpenDbModal}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                isPostgres
                  ? 'bg-emerald-950/40 border-emerald-800/70 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isPostgres ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-cyan-400 animate-pulse'
                }`}
              />
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isPostgres ? 'Neon PostgreSQL' : 'Memory ACID Engine'}
              </span>
            </button>

            {/* Reset / Re-seed Button */}
            <button
              onClick={onResetData}
              disabled={isResetting}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-medium transition-all disabled:opacity-50"
              title="Reset all balances and transactions to baseline seed"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Reset Baseline</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto pb-2 pt-1 border-t border-slate-900 scrollbar-none">
          <button
            onClick={() => setActiveTab('switch')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'switch'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Payment Switch</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'ledger'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ledger & Wallets</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'simulator'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Failure Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'reconciliation'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Bank Reconciliation</span>
          </button>

          <button
            onClick={() => setActiveTab('schema')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'schema'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Prisma & SQL DDL</span>
          </button>
        </div>
      </div>
    </header>
  );
};
