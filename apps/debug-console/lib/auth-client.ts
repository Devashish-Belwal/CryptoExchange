const AUTH_STORAGE_KEY = "cex.debug.auth";
export const AUTH_CHANGED_EVENT = "cex-debug-auth-changed";

export type AuthSession = {
    token: string;
    user: {
        id: string;
        username: string;
        email: string;
        isAdmin: boolean;
    };
};

export function saveAuthSession(session: AuthSession) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAuthSession() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getAuthession() {
    if (typeof window === "undefined") return null;

    try {
        const value = window.localStorage.getItem(AUTH_STORAGE_KEY);
        if (!value) return null;
        const parsed = JSON.parse(value) as Partial<AuthSession>;
        if (typeof parsed.token !== "string" || !parsed.user?.id) return null;
        return parsed as AuthSession;
    } catch {
        return null;
    }
}