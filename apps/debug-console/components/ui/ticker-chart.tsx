"use client"

import { CandlestickSeries, ColorType, createChart, IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";

export type Candle = { openTime: number; open: string; high: string; low: string; close: string };

export function TickerChart({ candles }: { candles: Candle[] }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            autoSize: true,
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: "#8b949e",
            },
            grid: {
                vertLines: { color: "rgba(255,255,255,0.05)" },
                horzLines: { color: "rgba(255,255,255,0.05)" },
            },
            timeScale: { timeVisible: true, secondsVisible: false, borderColor: "rgba(255,255,255,0.1)" },
            rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
        });

        const series = chart.addSeries(CandlestickSeries, {
            upColor: "#3fb950",
            downColor: "#f85149",
            wickUpColor: "#3fb950",
            wickDownColor: "#f85149",
            borderVisible: false,
        });

        chartRef.current = chart;
        seriesRef.current = series;

        return () => {
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!seriesRef.current) return;

        const data = candles.map((candle) => ({
            time: Math.floor(candle.openTime / 1000) as UTCTimestamp,
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
        }));

        seriesRef.current.setData(data);
        chartRef.current?.timeScale().fitContent();
    }, [candles]);

    return <div ref={containerRef} className="h-full w-full" />;
}
