import { methodColor, ResponseEntry } from "@/lib/response-client.ts/response-viewer";
import { Panel } from "./Shell";

export function ResponsePanel(
    { data, title = "response.history", classname }:
        { data: ResponseEntry[], title: string, classname?: string }
) {
    return (
        <Panel title={title} className={`flex-1 ${classname}`}>
            <ResponseViewer data={data} />
        </Panel>
    )
}

function ResponseViewer({ data }: { data: ResponseEntry[] }) {

    if (data.length === 0) {
        return <div className="p-3 text-[12px] text-term-dim">{"// no requests captured yet — trigger an action to populate"}</div>;
    }

    return (
        <div className="h-full min-h-0 overflow-auto text-[12px]">
            {data.map((entry, index) => {
                const ok = entry.status >= 200 && entry.status < 300;
                return (
                    <section key={`${entry.ts}-${entry.method}-${entry.path}-${index}`} className="border-b border-border">
                        <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-0.5 bg-secondary px-2 py-1 text-[11px]">
                            <span className="text-term-dim">#{data.length - index}</span>
                            <span className="min-w-0 truncate">
                                <span className={methodColor(entry.method)}>{entry.method}</span>{" "}
                                <span className="text-foreground">{entry.path}</span>
                            </span>
                            <span className={ok ? "text-term-green" : "text-term-red"}>{entry.status || "NETWORK"} {ok ? "OK" : "ERR"}</span>
                            <span className="col-start-2 text-term-dim">IST {entry.ts}</span>
                            <span className="text-right text-term-yellow">{entry.latency_ms}ms</span>
                        </div>
                        <div className="grid gap-2 px-2 py-1 lg:grid-cols-2">
                            <div className="min-w-0">
                                <div className="text-term-dim">{"// request"}</div>
                                <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-term-cyan">{JSON.stringify(entry.request, null, 2)}</pre>
                            </div>
                            <div className="min-w-0">
                                <div className="text-term-dim">{"// response"}</div>
                                <pre className={`max-h-56 overflow-auto whitespace-pre-wrap break-all ${ok ? "text-term-green" : "text-term-red"}`}>{JSON.stringify(entry.response, null, 2)}</pre>
                            </div>
                        </div>
                    </section>
                )
            })}

        </div>
    )
}