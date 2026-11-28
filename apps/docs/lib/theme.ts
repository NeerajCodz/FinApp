import { darkTokens, lightTokens, type ThemeTokens } from '@finapp/ui/tokens';

function vars(tokens: ThemeTokens) {
  return Object.entries(tokens)
    .filter(([, value]) => typeof value === 'string')
    .map(
      ([key, value]) =>
        `--finapp-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value as string};`,
    )
    .join('');
}

/**
 * FinApp theme tokens as CSS variables: light by default, dark when the system prefers it, and
 * either one when the reader picks it (`data-theme` on <html>).
 */
export function themeCss() {
  const light = vars(lightTokens);
  const dark = vars(darkTokens);
  return [
    `html:root{color-scheme:light;${light}}`,
    `@media (prefers-color-scheme: dark){html:root:not([data-theme="light"]){color-scheme:dark;${dark}}}`,
    `html:root[data-theme="dark"]{color-scheme:dark;${dark}}`,
    `html:root[data-theme="light"]{color-scheme:light;${light}}`,
  ].join('\n');
}

/** Runs before paint so a stored theme choice never flashes. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('finapp-docs-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
