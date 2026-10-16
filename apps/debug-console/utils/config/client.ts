if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL not found")
}
if (!process.env.NEXT_PUBLIC_CORE_WS_URL) {
    throw new Error("NEXT_PUBLIC_CORE_WS_URL not found")
}
if (!process.env.NEXT_PUBLIC_DEBUG_URL) {
    throw new Error("NEXT_PUBLIC_DEBUG_URL not found")
}
if (!process.env.NEXT_PUBLIC_DOCS_URL) {
    throw new Error("NEXT_PUBLIC_DOCS_URL not found")
}
if (!process.env.NEXT_PUBLIC_CORE_URL) {
    throw new Error("NEXT_PUBLIC_CORE_URL not found")
}

export const ClientConfig = {
    BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    CORE_BACKEND_URL: `${process.env.NEXT_PUBLIC_BACKEND_URL}/core/api/v1`,
    CORE_WS_URL: process.env.NEXT_PUBLIC_CORE_WS_URL,

    DEBUG_URL: process.env.NEXT_PUBLIC_DEBUG_URL,
    DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,
    CORE_URL: process.env.NEXT_PUBLIC_CORE_URL,
    NODE_ENV: process.env.NODE_ENV,
}