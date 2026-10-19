import 'i18next';
import type { he } from './he';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof he };
  }
}
