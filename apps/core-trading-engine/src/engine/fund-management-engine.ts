import { EngineState } from "./engine-state";
import { UpdateManagerEngine } from "./update-manager-engine";


export class FundManagementEngine {
    constructor(
        private readonly state: EngineState,
        private readonly updateManagerEngine: UpdateManagerEngine,
    ) { }

    initializeMarket(symbol: string) {
        if (!this.state.commissionFunds.has(symbol)) {
            this.state.commissionFunds.set(symbol, undefined);
        }

        if (!this.state.insuranceFunds.has(symbol)) {
            this.state.insuranceFunds.set(symbol, undefined);
        }
    }

    addCommissionFee(symbol: string, amount: number) {
        if (amount <= 0) {
            return;
        }

        const insuranceShare = amount * 0.7;
        const commissionShare = amount - insuranceShare;

        const commissionFund = (this.state.commissionFunds.get(symbol) ?? 0) + commissionShare;
        const insuranceFund = (this.state.insuranceFunds.get(symbol) ?? 0) + insuranceShare;

        this.state.commissionFunds.set(symbol, commissionFund);
        this.state.insuranceFunds.set(symbol, insuranceFund);

        this.updateManagerEngine.captureCommission(symbol, commissionFund, insuranceFund);
    }

    useInsuranceFund(symbol: string, amount: number) {
        if (amount <= 0) {
            return;
        }

        const insuranceFund = (this.state.insuranceFunds.get(symbol) ?? 0) - amount;
        this.state.insuranceFunds.set(symbol, insuranceFund);

        const commissionFund = this.state.commissionFunds.get(symbol) ?? 0;
        this.updateManagerEngine.captureCommission(symbol, commissionFund, insuranceFund);
    }
}
