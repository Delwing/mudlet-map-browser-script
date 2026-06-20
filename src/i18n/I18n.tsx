import {createContext, useCallback, useContext, useMemo, useState, type ReactNode} from "react";
import {bakedDictionaries, pl as plDefaults, type Dictionary} from "./defaults";
import {config, type LanguageOption} from "../config";

const PERSIST_KEY = "preferred_language";
const DEFAULT_LANGUAGES: LanguageOption[] = [{code: "pl"}, {code: "en", flag: "gb"}];

export interface ResolvedLanguage {
    code: string;
    flag: string;
}

interface I18nContextValue {
    lang: string;
    setLang: (lang: string) => void;
    t: (key: string, lang?: string) => string;
    languages: ResolvedLanguage[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

const resolvedLanguages: ResolvedLanguage[] = (config.languages ?? DEFAULT_LANGUAGES).map(l => ({
    code: l.code,
    flag: l.flag ?? l.code,
}));

const supportedCodes = resolvedLanguages.map(l => l.code);

// Bundled translations, with any host overrides/additions merged on top.
// Synchronous — strings are available on first render (no fetch, no flash).
const dictionaries: Record<string, Dictionary> = (() => {
    const result: Record<string, Dictionary> = {};
    for (const {code} of resolvedLanguages) {
        result[code] = {...(bakedDictionaries[code] ?? {}), ...(config.translations?.[code] ?? {})};
    }
    return result;
})();

function detectDefaultLanguage(): string {
    const persisted = localStorage.getItem(PERSIST_KEY);
    if (persisted && supportedCodes.includes(persisted)) return persisted;
    const htmlLang = document.documentElement.getAttribute("lang");
    if (htmlLang && supportedCodes.includes(htmlLang)) return htmlLang;
    return supportedCodes[0] ?? "pl";
}

export function I18nProvider({children}: {children: ReactNode}) {
    const [lang, setLangState] = useState<string>(detectDefaultLanguage);

    const setLang = useCallback((next: string) => {
        setLangState(next);
        localStorage.setItem(PERSIST_KEY, next);
        document.documentElement.setAttribute("lang", next);
    }, []);

    const t = useCallback(
        (key: string, overrideLang?: string): string => {
            const active = overrideLang ?? lang;
            // active language → Polish (the canonical complete set) → the key itself.
            return dictionaries[active]?.[key] ?? plDefaults[key] ?? key;
        },
        [lang],
    );

    const value = useMemo<I18nContextValue>(() => ({lang, setLang, t, languages: resolvedLanguages}), [lang, setLang, t]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error("useI18n must be used within I18nProvider");
    return ctx;
}

/** Convenience component for a translated text node. */
export function T({k}: {k: string}) {
    const {t} = useI18n();
    return <>{t(k)}</>;
}

/** Translated content that may contain inline HTML. */
export function THtml({k, className}: {k: string; className?: string}) {
    const {t} = useI18n();
    return <span className={className} dangerouslySetInnerHTML={{__html: t(k)}} />;
}
