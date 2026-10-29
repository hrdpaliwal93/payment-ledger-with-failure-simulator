import React, { useState } from 'react';
import {
  Sliders,
  AlertTriangle,
  Clock,
  Ban,
  ServerCrash,
  RefreshCw,
  Zap,
  Ghost,
  ShieldAlert,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { FailureScenario, SimulationConfig, MockBankEvent } from '../types/payment.ts';

interface FailureSimulatorViewProps {
  config: SimulationConfig;
  onUpdateConfig: (updates: Partial<SimulationConfig>) => Promise<void>;
  onInjectPhantom: (amount: number) => Promise<MockBankEvent>;
  onRunBatchStress: (count: number) => Promise<void>;
  isStressRunning: boolean;
}

export const FailureSimulatorView: React.FC<FailureSimulatorViewProps> = ({
  config,
  onUpdateConfig,
  onInjectPhantom,
  onRunBatchStress,
  isStressRunning,
}) => {
  const [phantomAmount, setPhantomAmount] = useState('249.99');
  const [phantomSuccess, setPhantomSuccess] = useState<string | null>(null);
  const [delayValue, setDelayValue] = useState(config.network_delay_ms);
  const [chaosRate, setChaosRate] = useState(Math.round(config.random_failure_rate * 100));

  const scenarios: {
    id: FailureScenario;
    name: string;
    description: string;
    icon: React.ReactNode;
    impact: string;
    color: string;
  }[] = [
    {
      id: 'NONE',
      name: 'Clean Execution (Happy Path)',
      description: 'Zero failure injection. All validations pass, bank settles full amount, ledger updates atomically.',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      impact: 'Status: SUCCESS, Ledger: Double-entry posted, Bank: Settled',
      color: 'border-slate-800 hover:border-emerald-500/50',
    },
    {
      id: 'NETWORK_TIMEOUT',
      name: '504 Gateway Timeout (Uncertain Outcome)',
      description: 'Switch dispatches to downstream bank, but network drops response packet. State remains UNCERTAIN.',
      icon: <Clock className="w-5 h-5 text-amber-400" />,
      impact: 'Status: UNCERTAIN, Ledger: Zero movement, Requires Bank Inquiry',
      color: 'border-slate-800 hover:border-amber-500/50',
    },
    {
      id: 'INSUFFICIENT_FUNDS',
      name: 'Insufficient Funds (Validation Gate)',
      description: 'Source wallet balance is lower than payment amount. Switch rejects immediately before routing.',
      icon: <Ban className="w-5 h-5 text-rose-400" />,
      impact: 'Status: FAILED, Ledger: Untouched, Zero bank traffic',
      color: 'border-slate-800 hover:border-rose-500/50',
    },
    {
      id: 'BANK_500_ERROR',
      name: 'Bank 500 Internal Crash',
      description: 'Partner bank API crashes during processing and returns fatal HTTP 500 error.',
      icon: <ServerCrash className="w-5 h-5 text-red-400" />,
      impact: 'Status: FAILED, Ledger: Rolled back, Bank event: None',
      color: 'border-slate-800 hover:border-red-500/50',
    },
    {
      id: 'IDEMPOTENCY_REPLAY',
      name: 'Idempotency Replay (Deduplication)',
      description: 'Client repeats request with identical idempotency key. Switch returns original outcome without re-debiting.',
      icon: <RefreshCw className="w-5 h-5 text-indigo-400" />,
      impact: 'Status: Cached Result, Ledger: No duplicate charge',
      color: 'border-slate-800 hover:border-indigo-500/50',
    },
    {
      id: 'AMOUNT_TAMPERING',
      name: 'Settlement Amount Variance ($100 vs $90)',
      description: 'Switch requests $100, but bank settles $90 (e.g. unexpected interchange fee deduction or gateway bug).',
      icon: <AlertTriangle className="w-5 h-5 text-purple-400" />,
      impact: 'Status: SUCCESS, Bank Settled: $90, Triggers Recon Discrepancy',
      color: 'border-slate-800 hover:border-purple-500/50',
    },
    {
      id: 'MISSING_BANK_EVENT',
      name: 'Missing Bank Statement Event',
      description: 'Internal switch marks transaction SUCCESS, but external bank system loses the event record entirely.',
      icon: <Ghost className="w-5 h-5 text-pink-400" />,
      impact: 'Internal SUCCESS, Bank: Lost/Missing, Detected in Recon',
      color: 'border-slate-800 hover:border-pink-500/50',
    },
    {
      id: 'STATUS_MISMATCH',
      name: 'Status Inconsistency (Switch Fails vs Bank Settles)',
      description: 'Switch times out client side and marks FAILED, but bank actually charged customer account!',
      icon: <ShieldAlert className="w-5 h-5 text-orange-400" />,
      impact: 'Switch: FAILED, Bank: SETTLED. High risk discrepancy.',
      color: 'border-slate-800 hover:border-orange-500/50',
    },
  ];

  const handleSelectScenario = async (s: FailureScenario) => {
    await onUpdateConfig({ active_scenario: s });
  };

  const handleDelayChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setDelayValue(val);
  };

  const handleDelayCommit = async () => {
    await onUpdateConfig({ network_delay_ms: delayValue });
  };

  const handleChaosChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setChaosRate(val);
  };

  const handleChaosCommit = async () => {
    await onUpdateConfig({ random_failure_rate: chaosRate / 100 });
  };

  const handleInjectPhantom = async () => {
    const amt = parseFloat(phantomAmount);
    if (isNaN(amt) || amt <= 0) return;
    try {
      const evt = await onInjectPhantom(amt);
      setPhantomSuccess(`Phantom charge of $${amt.toFixed(2)} injected (Ref: ${evt.bank_reference_id})!`);
      setTimeout(() => setPhantomSuccess(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Simulation Controls Dashboard */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-white text-base">Failure Simulator & Chaos Matrix</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select active failure mode to test payment routing, transaction state transitions, and ledger safety.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Current Default Mode:</span>
            <span className="px-3 py-1 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono text-xs font-semibold">
              {config.active_scenario}
            </span>
          </div>
        </div>

        {/* Sliders: Network Latency & Chaos Rate */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
          {/* Latency Slider */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-cyan-400" /> Simulated Network Delay
              </span>
              <span className="font-mono text-cyan-300 font-bold">{delayValue} ms</span>
            </div>
            <input
              type="range"
              min="0"
              max="2000"
              step="50"
              value={delayValue}
              onChange={handleDelayChange}
              onMouseUp={handleDelayCommit}
              onTouchEnd={handleDelayCommit}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0ms (Instant)</span>
              <span>1000ms</span>
              <span>2000ms (High Latency)</span>
            </div>
          </div>

          {/* Random Chaos Rate Slider */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300 flex items-center">
                <Zap className="w-3.5 h-3.5 mr-1 text-amber-400" /> Random Chaos Failure Rate
              </span>
              <span className="font-mono text-amber-300 font-bold">{chaosRate}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={chaosRate}
              onChange={handleChaosChange}
              onMouseUp={handleChaosCommit}
              onTouchEnd={handleChaosCommit}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0% (Deterministic)</span>
              <span>50%</span>
              <span>100% (Pure Chaos)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scenarios Grid */}
      <div>
        <h4 className="text-xs font-semibold text-slate-300 mb-3 font-mono uppercase tracking-wider">
          Configurable Failure Scenarios
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {scenarios.map((sc) => {
            const isActive = config.active_scenario === sc.id;
            return (
              <div
                key={sc.id}
                onClick={() => handleSelectScenario(sc.id)}
                className={`p-4 rounded-2xl border bg-slate-900/90 cursor-pointer transition-all flex flex-col justify-between ${
                  isActive
                    ? 'border-cyan-500 bg-cyan-950/20 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500'
                    : sc.color
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      {sc.icon}
                    </div>
                    {isActive && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <h5 className="font-semibold text-white text-xs mb-1">{sc.name}</h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{sc.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                  <span className="text-slate-500 block uppercase">Expected Outcome:</span>
                  <span className="text-slate-300">{sc.impact}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Injections & Batch Stress Testing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Phantom Bank Debit Injector */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Ghost className="w-5 h-5 text-pink-400" />
              <h4 className="font-semibold text-white text-sm">Inject Phantom Bank Debit</h4>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Simulates an unauthorized direct debit or lost internal webhook: creates an external bank statement charge
              with NO matching internal switch transaction.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Phantom Amount ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={phantomAmount}
                  onChange={(e) => setPhantomAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              {phantomSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2 font-mono">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{phantomSuccess}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleInjectPhantom}
                className="w-full py-2 px-3 bg-pink-950/80 hover:bg-pink-900 border border-pink-800/80 text-pink-200 rounded-xl text-xs font-semibold shadow-md transition-all flex items-center justify-center space-x-2"
              >
                <Ghost className="w-3.5 h-3.5" />
                <span>Inject External Bank Event</span>
              </button>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-800 text-[10px] text-slate-500">
            Reconciliation will flag this as <span className="font-mono text-pink-400">UNMATCHED_EXTERNAL</span>.
          </div>
        </div>

        {/* Batch Stress Test Runner */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Play className="w-5 h-5 text-indigo-400" />
              <h4 className="font-semibold text-white text-sm">Batch Switch Stress Simulator</h4>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Dispatches a rapid burst of 10 payment requests with a randomized blend of clean transfers, timeouts,
              insufficient funds, and amount variances to generate real-world ledger and bank event distributions.
            </p>

            <button
              type="button"
              onClick={() => onRunBatchStress(10)}
              disabled={isStressRunning}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-950/50 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isStressRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executing 10 Simulated Transactions...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Execute 10-Transaction Stress Run</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-800 text-[10px] text-slate-500">
            Automatically updates ledger entries, wallet balances, and mock bank statements.
          </div>
        </div>
      </div>
    </div>
  );
};
