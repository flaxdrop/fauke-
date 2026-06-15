const THEME_KEY = "fauke_theme";

export type Theme = "dark" | "light" | "system";

export function getStoredTheme(): string | null {
    try {
        return localStorage.getItem(THEME_KEY);
    } catch {
        return null;
    }
}

export function setStoredTheme(value: string | null) {
    try {
        if (value === null) localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, value);
    } catch {
        // ignore
    }
}

export function isSystemDark(): boolean {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: Theme | string | null) {
    const root = document.documentElement;
    let useDark = false;
    if (theme === "dark") useDark = true;
    else if (theme === "light") useDark = false;
    else useDark = isSystemDark();

    if (useDark) root.classList.add("dark");
    else root.classList.remove("dark");
}

export function initTheme() {
    const stored = getStoredTheme();
    applyTheme(stored);
}

export function toggleTheme(): "dark" | "light" {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    const next = isDark ? "light" : "dark";
    setStoredTheme(next);
    applyTheme(next);
    return next;
}

export function getCurrentAppliedTheme(): "dark" | "light" {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
