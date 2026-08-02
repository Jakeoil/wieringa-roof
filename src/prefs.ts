// Remembering what you had set, per page.
//
// Every control on these pages is a preference rather than a document: which patch,
// which generation, how big a rhombus, what the print should carry. Losing them on
// every reload — and this project reloads constantly, chasing stale scripts — turns
// a two-second check into a minute of re-setting dials.
//
// localStorage rather than cookies: these never need to reach a server, and cookies
// would be sent with every request for no reason.
//
// Restoring is deliberately forgiving. A saved value from an older build may name a
// method or a mode that no longer exists, so every field is validated on the way in
// and anything unrecognized falls back to the default rather than wedging the page.

export function loadPrefs<T extends object>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return { ...fallback };
        const got = JSON.parse(raw) as Partial<T>;
        if (!got || typeof got !== "object") return { ...fallback };
        // Only keys the default knows about, and only if the type still matches.
        const out = { ...fallback };
        for (const k of Object.keys(fallback) as Array<keyof T>) {
            const v = got[k];
            if (v === undefined) continue;
            if (typeof v !== typeof fallback[k]) continue;
            out[k] = v as T[keyof T];
        }
        return out;
    } catch {
        return { ...fallback };
    }
}

export function savePrefs<T extends object>(key: string, value: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Private browsing, a full quota — not worth breaking the page over.
    }
}

/** Forget this page's settings and start again from the defaults. */
export function resetPrefs(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        /* as above */
    }
    window.location.reload();
}
