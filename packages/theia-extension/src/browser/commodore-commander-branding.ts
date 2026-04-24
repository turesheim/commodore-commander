import appIcon128Url from '../../assets/branding/cc_128.png';

const BRANDING_STYLE_ELEMENT_ID = 'commodore-commander-branding';
const FAVICON_ELEMENT_ID = 'commodore-commander-favicon';

export const COMMODORE_COMMANDER_APPLICATION_ID = 'commodore-commander';
export const COMMODORE_COMMANDER_APP_ICON_URL = appIcon128Url;

function brandingStyleSheetContent(): string {
  return `
body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] #theia\\:icon.theia-icon {
  width: 32px;
  height: 32px;
  margin: 4px 8px 4px 12px;
  background: center / contain no-repeat url("${COMMODORE_COMMANDER_APP_ICON_URL}");
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-header {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-brand-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-app-icon {
  width: 64px;
  height: 64px;
  flex: 0 0 auto;
  image-rendering: auto;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-title-block {
  min-width: 0;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-title-block h1 {
  margin-bottom: 6px;
  font-family: "Microgramma Std Bold Extended (D)", "Microgramma Std Bold Extended", "Microgramma D Bold Extended", "Microgramma D", "Microgramma D Extended", Microgramma, Eurostile, sans-serif;
  font-weight: 700;
  letter-spacing: 0;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-tagline {
  margin: 0;
  max-width: 42rem;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-summary {
  max-width: 62rem;
  line-height: 1.5;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-summary p {
  margin: 0 0 10px;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-summary p:last-child {
  margin-bottom: 0;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-embedded-runtime {
  max-width: 62rem;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-runtime-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-runtime-kicker {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: uppercase;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-embedded-runtime h2 {
  margin: 0;
  font-size: 1.15rem;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-embedded-runtime p {
  margin: 0 0 10px;
  line-height: 1.45;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-runtime-details {
  margin-top: 4px;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-runtime-details summary {
  cursor: pointer;
}

body[data-application-id="${COMMODORE_COMMANDER_APPLICATION_ID}"] .cc-welcome-runtime-details p {
  margin-top: 10px;
  font-size: 0.9rem;
}
`;
}

export function ensureCommodoreCommanderBranding(document: Document): void {
  ensureBrandingStyles(document);
  ensureFavicon(document);
}

function ensureBrandingStyles(document: Document): void {
  let styleElement = document.getElementById(BRANDING_STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = BRANDING_STYLE_ELEMENT_ID;
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = brandingStyleSheetContent();
}

function ensureFavicon(document: Document): void {
  let faviconElement = document.getElementById(FAVICON_ELEMENT_ID) as HTMLLinkElement | null;
  if (!faviconElement) {
    faviconElement = document.createElement('link');
    faviconElement.id = FAVICON_ELEMENT_ID;
    faviconElement.rel = 'icon';
    document.head.appendChild(faviconElement);
  }

  faviconElement.href = COMMODORE_COMMANDER_APP_ICON_URL;
}
