import React, { useState } from 'react';
import { Database, CheckCircle2, AlertTriangle, X, RefreshCw, Key, Shield } from 'lucide-react';
import { DatabaseStatus } from '../server/db.ts';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: DatabaseStatus | null;
  onConnect: (url: string) => Promise<boolean>;
  onRefresh: () => void;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({
  isOpen,
  onClose,
  status,
  onConnect,
  onRefresh,
}) => {
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!databaseUrl.trim()) {
      setErrorMsg('Please enter a PostgreSQL connection URL.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      const ok = await onConnect(databaseUrl.trim());
      if (ok) {
        setSuccessMsg('Successfully connected to Neon PostgreSQL! Tables verified and initialized.');
      } else {
        setErrorMsg('Connection failed. Please check credentials, host, and SSL parameters.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to Neon PostgreSQL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConnected = status?.provider === 'NEON_POSTGRES' && status?.connected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800/80 text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">PostgreSQL / Neon DB Connection</h3>
              <p className="text-xs text-slate-400">Configure your Neon database or inspect transactional persistence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Active Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start space-x-3 text-xs leading-relaxed ${
              isConnected
                ? 'bg-emerald-950/30 border-emerald-800/70 text-emerald-200'
                : 'bg-cyan-950/30 border-cyan-800/70 text-cyan-200'
            }`}
          >
            {isConnected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Shield className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-semibold text-sm">
                {isConnected ? 'Connected to Neon PostgreSQL DB' : 'Active: High-Fidelity Transactional ACID Engine'}
              </div>
              <p className="opacity-90">{status?.message}</p>
              <div className="pt-1 flex items-center space-x-3 text-[11px] font-mono text-slate-300">
                <span>Provider: {status?.provider}</span>
                <span>•</span>
                <span>Pool Clients: {status?.activePoolSize || 0}</span>
              </div>
            </div>
          </div>

          {/* Connection URL form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Connect your Neon PostgreSQL Connection String
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="postgresql://user:password@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require"
                  value={databaseUrl}
                  onChange={(e) => setDatabaseUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500 transition-all pr-10"
                />
                <Key className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Supports standard Neon connection strings with SSL enabled (`sslmode=require`).
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onRefresh}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-verify Connection</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-900/30 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    <span>Connect Neon DB</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Technical Info box */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 space-y-1.5">
            <div className="font-semibold text-slate-300">Transaction & Concurrency Guarantee</div>
            <p>
              When running on Neon PostgreSQL, all double-entry ledger postings execute inside strict ACID transactions
              (`BEGIN ... COMMIT; ROLLBACK;`) with row-level locks to eliminate race conditions and double-spending.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
