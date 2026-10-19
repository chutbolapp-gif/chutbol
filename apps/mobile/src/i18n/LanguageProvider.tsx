import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createI18n, isRtlLang, otherLang, type Lang } from './i18n';
import { switchLanguage } from './language';

interface LanguageCtx {
  lang: Lang;
  rtl: boolean;
  /** Switch to the other language. Reloads the app (direction is fixed at start). */
  toggle: () => Promise<void>;
  /** Set when the reload failed: the language changed but native parts keep the old direction. */
  reloadFailed: boolean;
}

const Ctx = createContext<LanguageCtx | null>(null);

export function LanguageProvider({ initial, children }: PropsWithChildren<{ initial: Lang }>) {
  const [lang, setLang] = useState(initial);
  const [reloadFailed, setReloadFailed] = useState(false);
  const i18n = useMemo(() => createI18n(lang, [initReactI18next]), [lang]);

  const toggle = useCallback(async () => {
    const next = otherLang(lang);
    const reloading = await switchLanguage(next);
    if (!reloading) {
      // no reload possible here: re-render in place; the root view still flips direction
      setLang(next);
      setReloadFailed(true);
    }
  }, [lang]);

  const value = useMemo(() => ({ lang, rtl: isRtlLang(lang), toggle, reloadFailed }), [lang, toggle, reloadFailed]);
  return (
    <Ctx.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </Ctx.Provider>
  );
}

export function useLanguage(): LanguageCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLanguage outside LanguageProvider');
  return v;
}
