import { FailureScenario, SimulationConfig, MockBankEvent } from '../types/payment.ts';
import { db } from './db.ts';

class FailureSimulator {
  private config: SimulationConfig = {
    active_scenario: 'NONE',
    network_delay_ms: 300,
    random_failure_rate: 0.0,
    auto_reconciliation: false,
  };

  public getConfig(): SimulationConfig {
    return { ...this.config };
  }

  public setConfig(updates: Partial<SimulationConfig>): SimulationConfig {
    this.config = { ...this.config, ...updates };
    return this.getConfig();
  }

  /**
   * Determine effective scenario for a specific transaction.
   * Allows overriding per-request or using the simulator's active scenario.
   */
  public resolveScenario(requestedScenario?: FailureScenario): FailureScenario {
    if (requestedScenario && requestedScenario !== 'NONE') {
      return requestedScenario;
    }
    if (this.config.random_failure_rate > 0 && Math.random() < this.config.random_failure_rate) {
      const candidates: FailureScenario[] = [
        'NETWORK_TIMEOUT',
        'INSUFFICIENT_FUNDS',
        'BANK_500_ERROR',
        'AMOUNT_TAMPERING',
      ];
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return this.config.active_scenario;
  }

  /**
   * Generates a phantom bank event (bank statement event that has no matching internal transaction).
   * Useful for testing reconciliation detecting unlinked bank debits.
   */
  public async injectPhantomBankDebit(amount: number = 249.99): Promise<MockBankEvent> {
    const timestamp = new Date().toISOString();
    const event: MockBankEvent = {
      id: `evt_phantom_${Date.now()}`,
      bank_reference_id: `EXT_BANK_REF_PHANTOM_${Math.floor(100000 + Math.random() * 900000)}`,
      payment_ref: `UNMATCHED_INT_${Math.floor(1000 + Math.random() * 9000)}`,
      amount,
      status: 'SETTLED',
      raw_payload: JSON.stringify({
        origin: 'DIRECT_DEBIT_UNAUTHORIZED',
        channel: 'ACH_INWARD',
        narrative: 'Mysterious External Merchant Clearing Charge',
        clearing_code: 'ACH_9918',
      }),
      settled_at: timestamp,
      created_at: timestamp,
    };

    await db.createBankEvent(event);
    return event;
  }
}

export const failureSimulator = new FailureSimulator();
