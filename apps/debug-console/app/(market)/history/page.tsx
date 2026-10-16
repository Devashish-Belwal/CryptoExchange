import { BalanceLedgerPanel, OrderHistoryPanel, PositionHistoryPanel, TradeHistoryPanel } from "@/components/ui/history-components";
import { ResponsePanel } from "@/components/ui/response-panel";
import { Terminal } from "@/components/ui/terminal";
import { ResponseEntry } from "@/lib/response-client.ts/response-viewer";

export default function History() {
    const history: ResponseEntry[] = [];
    return (
        <main className="flex-1 overflow-auto bg-border">
            <div className="flex flex-col gap-px">
                <div className="grid grid-cols-12 gap-px" style={{ minHeight: 560 }}>
                    <div className="shrink-0 col-span-12 lg:col-span-8">
                        <OrderHistoryPanel className="h-[280px] col-span-12 md:col-span-6 lg:col-span-4" />
                        <PositionHistoryPanel className="h-[280px] col-span-12 md:col-span-6 lg:col-span-4" />
                    </div>

                    <BalanceLedgerPanel className="col-span-12 md:col-span-6 lg:col-span-4" />

                </div>

                < div className="grid h-[960px] min-h-0 grid-cols-12 grid-rows-3 gap-px overflow-hidden md:h-[700px] md:grid-rows-2 lg:h-[440px] lg:grid-rows-1" >
                    <TradeHistoryPanel className="col-span-12 min-h-0 overflow-hidden lg:col-span-4" />

                    <ResponsePanel
                        title={`request.response_history · ${history.length} calls`}
                        data={history}
                        classname="col-span-12 min-h-0 overflow-hidden md:col-span-6 lg:col-span-4"
                    />

                    <div className="col-span-12 flex min-h-0 overflow-hidden md:col-span-6 lg:col-span-4">
                        <Terminal title="stdout · trade.engine" className="w-full" />
                    </div>
                </div >


            </div >
        </main >

    )
}
