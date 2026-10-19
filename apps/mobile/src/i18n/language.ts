// Language choice, layout direction and the reload that a direction change needs.
//
// React Native fixes the layout direction (I18nManager) when the app starts, so switching between
// Hebrew (RTL) and English (LTR) is: save the choice -> set I18nManager -> reload the app.
// Expo Go resets I18nManager every time it opens a project, so the root view also sets
// `direction` itself (see app/_layout.tsx); that makes RTL right in Expo Go too.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Updates from 'expo-updates';
import { DevSettings, I18nManager, Platform } from 'react-native';
import { DEFAULT_LANG, isLang, isRtlLang, type Lang } from './i18n';

const LANG_KEY = 'chutbol:lang';
/** Language for which a direction-fix reload was already tried (stops a reload loop). */
const DIR_FIX_KEY = 'chutbol:dirFix';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

async function readStored(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeStored(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    // storage unavailable: the choice only lasts until the app closes
  }
}

/** Set the native layout direction for the next start. Returns true if it changed. */
function setNativeDirection(lang: Lang): boolean {
  const rtl = isRtlLang(lang);
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    return false;
  }
  if (I18nManager.isRTL === rtl) return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return true;
}

/** Reload the JS app. Returns false when no reload is possible here. */
export async function reloadApp(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false;
    window.location.reload();
    return true;
  }
  try {
    // release builds
    await Updates.reloadAsync();
    return true;
  } catch {
    // Expo Go and development: reloadAsync is not allowed there
  }
  if (__DEV__) {
    DevSettings.reload();
    return true;
  }
  return false;
}

/**
 * Called once before the first render: reads the saved language (Hebrew if none) and lines up the
 * layout direction. In a development or store build whose native direction is still wrong
 * (first launch, or an old setting) it reloads once; Expo Go is skipped, it resets direction anyway.
 * Returns the language, or null when a reload is on its way.
 */
export async function bootLanguage(): Promise<Lang | null> {
  const stored = await readStored(LANG_KEY);
  const lang = isLang(stored) ? stored : DEFAULT_LANG;
  const changed = setNativeDirection(lang);
  if (changed && !isExpoGo && Platform.OS !== 'web') {
    const tried = await readStored(DIR_FIX_KEY);
    if (tried !== lang) {
      await writeStored(DIR_FIX_KEY, lang);
      if (await reloadApp()) return null;
    }
  }
  return lang;
}

/**
 * Switch language: save it, set the direction and reload the app.
 * Returns false if the app could not reload (the caller then re-renders in place and tells the user).
 */
export async function switchLanguage(lang: Lang): Promise<boolean> {
  await writeStored(LANG_KEY, lang);
  await writeStored(DIR_FIX_KEY, null);
  setNativeDirection(lang);
  return reloadApp();
}
