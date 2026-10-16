export const IST_LABEL = "IST (UTC+05:30)";
export const IST_TIME_ZONE = "Asia/Kolkata";

const clockFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
})

export function formatIstTime(value: Date | number = Date.now()) {
    return clockFormatter.format(value);
}