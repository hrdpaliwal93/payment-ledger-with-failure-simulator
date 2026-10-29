import React, { useState } from 'react';
import {
  FileCode2,
  Copy,
  Check,
  Database,
  Layers,
  ArrowRight,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { MockBankEvent } from '../types/payment.ts';

interface SchemaViewProps {
  prismaSchema: string;
  postgresDdl: string;
  bankEvents: MockBankEvent[];
}

export const SchemaView: React.FC<SchemaViewProps> = ({
  prismaSchema,
  postgresDdl,
  bankEvents,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'prisma' | 'postgres' | 'bank_events'>('prisma');
  const [copiedPrisma, setCopiedPrisma] = useState(false);
  const [copiedDdl, setCopiedDdl] = useState(false);

  const handleCopyPrisma = () => {
    navigator.clipboard.writeText(prismaSchema);
    setCopiedPrisma(true);
    setTimeout(() => setCopiedPrisma(false), 2000);
  };

  const handleCopyDdl = () => {
    navigator.clipboard.writeText(postgresDdl);
    setCopiedDdl(true);
    setTimeout(() => setCopiedDdl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Schema Navigation & Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <FileCode2 className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-white text-base">Database Architecture & Schema Specs</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Production-ready PostgreSQL DDL and Prisma models with strict numeric precision (NUMERIC(14,2)), foreign keys, and indexes.
            </p>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveSubTab('prisma')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeSubTab === 'prisma'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              schema.prisma
            </button>
            <button
              onClick={() => setActiveSubTab('postgres')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeSubTab === 'postgres'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              PostgreSQL DDL
            </button>
            <button
              onClick={() => setActiveSubTab('bank_events')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeSubTab === 'bank_events'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bank Event Feed ({bankEvents.length})
            </button>
          </div>
        </div>

        {/* Entity Relationships Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 text-xs font-mono">
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-500 uppercase block">Entity 1</span>
            <span className="text-white font-semibold block">Wallet</span>
            <span className="text-[10px] text-slate-400">Balances & Reserves</span>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-500 uppercase block">Entity 2</span>
            <span className="text-white font-semibold block">PaymentTransaction</span>
            <span className="text-[10px] text-slate-400">Idempotent Switch Txn</span>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-500 uppercase block">Entity 3</span>
            <span className="text-white font-semibold block">LedgerEntry</span>
            <span className="text-[10px] text-slate-400">Double-Entry Journal</span>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-500 uppercase block">Entity 4</span>
            <span className="text-white font-semibold block">MockBankEvent</span>
            <span className="text-[10px] text-slate-400">Clearing Statements</span>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-500 uppercase block">Entity 5</span>
            <span className="text-white font-semibold block">ReconciliationRun</span>
            <span className="text-[10px] text-slate-400">Audit Discrepancies</span>
          </div>
        </div>
      </div>

      {/* Code Viewer: Prisma */}
      {activeSubTab === 'prisma' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/60 text-xs">
            <div className="flex items-center space-x-2 font-mono text-slate-300">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>prisma/schema.prisma (PostgreSQL & Neon DB compatible)</span>
            </div>
            <button
              onClick={handleCopyPrisma}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
            >
              {copiedPrisma ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPrisma ? 'Copied!' : 'Copy Prisma Schema'}</span>
            </button>
          </div>
          <pre className="p-5 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed max-h-[550px] scrollbar-thin">
            {prismaSchema}
          </pre>
        </div>
      )}

      {/* Code Viewer: PostgreSQL DDL */}
      {activeSubTab === 'postgres' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/60 text-xs">
            <div className="flex items-center space-x-2 font-mono text-slate-300">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>init_schema.sql (Neon DB PostgreSQL DDL)</span>
            </div>
            <button
              onClick={handleCopyDdl}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
            >
              {copiedDdl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDdl ? 'Copied!' : 'Copy PostgreSQL DDL'}</span>
            </button>
          </div>
          <pre className="p-5 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed max-h-[550px] scrollbar-thin">
            {postgresDdl}
          </pre>
        </div>
      )}

      {/* Bank Statement Feed Viewer */}
      {activeSubTab === 'bank_events' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div>
              <h4 className="font-semibold text-white text-sm">External Mock Bank Statement Stream</h4>
              <p className="text-xs text-slate-400">Simulated downstream clearing house bank ledger events</p>
            </div>
            <span className="text-xs font-mono text-slate-400">{bankEvents.length} events logged</span>
          </div>

          {bankEvents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No bank events recorded yet. Dispatch a payment or inject a phantom debit to populate bank statements.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Bank Ref ID</th>
                    <th className="py-2 px-3">Internal Txn Ref</th>
                    <th className="py-2 px-3">Amount</th>
                    <th className="py-2 px-3">Payload Details</th>
                    <th className="py-2 px-3">Settled Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {bankEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            evt.status === 'SETTLED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {evt.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-cyan-400">{evt.bank_reference_id}</td>
                      <td className="py-2 px-3 text-white">{evt.payment_ref}</td>
                      <td className="py-2 px-3 font-bold text-white">${evt.amount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-slate-400 font-sans text-[11px] truncate max-w-xs">
                        {evt.raw_payload}
                      </td>
                      <td className="py-2 px-3 text-slate-500 text-[11px]">
                        {new Date(evt.settled_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
