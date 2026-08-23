import { DefaultTheme } from '@theia/application-package/lib/application-props';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { ColorRegistry } from '@theia/core/lib/browser/color-registry';
import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
import {
  ColorTheme,
  CssStyleCollector,
  StylingParticipant
} from '@theia/core/lib/browser/styling-service';
import { ThemeService } from '@theia/core/lib/browser/theming';
import { injectable } from '@theia/core/shared/inversify';
import { MonacoThemingService } from '@theia/monaco/lib/browser/monaco-theming-service';

import {
  SOLARIZED_LIGHT_EDITOR_COLORS,
  SOLARIZED_LIGHT_TOKEN_COLORS
} from './solarized-light-editor-colors';

export const VIC20_THEME_ID = 'vic20';
export const VIC20_THEME_LABEL = 'VIC-20';

export const VIC20_BACKGROUND = '#F0EDE2';
export const VIC20_EDITOR_BACKGROUND = '#ffffff';
export const VIC20_ACTIVITY_BACKGROUND = '#e9e1cc';
export const VIC20_FUNCTION_KEY = '#b88d57';
export const VIC20_KEYCAP = '#33291f';
export const VIC20_STATUS_BACKGROUND = '#3c301e';
export const VIC20_TEXT = '#2a241c';
export const VIC20_PANEL_BACKGROUND = '#f8f6ef';
export const VIC20_PANEL_HEADER_BACKGROUND = '#e4d8c3';

const VIC20_TAB_INACTIVE_BACKGROUND = '#e9e1d1';
const VIC20_TAB_SELECTED_BACKGROUND = '#dac4a5';
const VIC20_ACTIVITY_ACTIVE_BACKGROUND = '#ded2ba';
const VIC20_BORDER = '#9f947e';
const VIC20_MUTED_TEXT = '#6b6356';
const VIC20_STATUS_HOVER_BACKGROUND = '#504638';
const VIC20_STATUS_ACTIVE_BACKGROUND = '#5c5348';
const VIC20_BUTTON_HOVER_BACKGROUND = '#57452c';

const VIC20_COLOR_IDS = {
  background: 'cc.vic20.background',
  activityBackground: 'cc.vic20.activityBackground',
  highlight: 'cc.vic20.highlight',
  label: 'cc.vic20.label',
  labelForeground: 'cc.vic20.labelForeground',
  statusBackground: 'cc.vic20.statusBackground',
  text: 'cc.vic20.text',
  panelBackground: 'cc.vic20.panelBackground',
  panelHeaderBackground: 'cc.vic20.panelHeaderBackground'
};

const VIC20_THEME_COLORS = {
  [VIC20_COLOR_IDS.background]: VIC20_BACKGROUND,
  [VIC20_COLOR_IDS.activityBackground]: VIC20_ACTIVITY_BACKGROUND,
  [VIC20_COLOR_IDS.highlight]: VIC20_FUNCTION_KEY,
  [VIC20_COLOR_IDS.label]: VIC20_KEYCAP,
  [VIC20_COLOR_IDS.labelForeground]: VIC20_KEYCAP,
  [VIC20_COLOR_IDS.statusBackground]: VIC20_STATUS_BACKGROUND,
  [VIC20_COLOR_IDS.text]: VIC20_TEXT,
  [VIC20_COLOR_IDS.panelBackground]: VIC20_PANEL_BACKGROUND,
  [VIC20_COLOR_IDS.panelHeaderBackground]: VIC20_PANEL_HEADER_BACKGROUND,

  foreground: VIC20_TEXT,
  focusBorder: VIC20_FUNCTION_KEY,
  'selection.background': '#dac4a580',
  'textLink.foreground': VIC20_KEYCAP,
  'textLink.activeForeground': VIC20_FUNCTION_KEY,
  'descriptionForeground': VIC20_MUTED_TEXT,
  'disabledForeground': '#8f876f',
  'errorForeground': '#b5200d',

  'window.activeBorder': VIC20_FUNCTION_KEY,
  'window.inactiveBorder': VIC20_BORDER,

  'activityBar.background': VIC20_ACTIVITY_BACKGROUND,
  'activityBar.foreground': VIC20_TEXT,
  'activityBar.inactiveForeground': VIC20_MUTED_TEXT,
  'activityBar.activeBackground': VIC20_ACTIVITY_ACTIVE_BACKGROUND,
  'activityBar.activeBorder': VIC20_FUNCTION_KEY,
  'activityBar.border': VIC20_BORDER,
  'activityBarBadge.background': VIC20_STATUS_BACKGROUND,
  'activityBarBadge.foreground': VIC20_BACKGROUND,

  'sideBar.background': VIC20_BACKGROUND,
  'sideBar.foreground': VIC20_TEXT,
  'sideBar.border': VIC20_BORDER,
  'sideBarTitle.foreground': VIC20_KEYCAP,
  'sideBarSectionHeader.background': VIC20_PANEL_HEADER_BACKGROUND,
  'sideBarSectionHeader.foreground': VIC20_KEYCAP,
  'sideBarSectionHeader.border': VIC20_BORDER,

  'editorGroupHeader.tabsBorder': VIC20_FUNCTION_KEY,

  'tab.activeBackground': VIC20_BACKGROUND,
  'tab.activeForeground': VIC20_TEXT,
  'tab.activeBorder': VIC20_FUNCTION_KEY,
  'tab.activeBorderTop': VIC20_FUNCTION_KEY,
  'tab.border': VIC20_BORDER,
  'tab.hoverBackground': VIC20_PANEL_HEADER_BACKGROUND,
  'tab.hoverBorder': VIC20_FUNCTION_KEY,
  'tab.inactiveBackground': VIC20_TAB_INACTIVE_BACKGROUND,
  'tab.inactiveForeground': VIC20_KEYCAP,
  'tab.unfocusedActiveBackground': VIC20_BACKGROUND,
  'tab.unfocusedActiveForeground': VIC20_TEXT,
  'tab.unfocusedInactiveBackground': '#ece6d9',
  'tab.unfocusedInactiveForeground': VIC20_MUTED_TEXT,

  'panel.background': VIC20_BACKGROUND,
  'panel.border': VIC20_BORDER,
  'panelTitle.activeForeground': VIC20_TEXT,
  'panelTitle.inactiveForeground': VIC20_MUTED_TEXT,
  'panelTitle.activeBorder': VIC20_FUNCTION_KEY,

  'statusBar.background': VIC20_STATUS_BACKGROUND,
  'statusBar.foreground': VIC20_BACKGROUND,
  'statusBar.border': VIC20_STATUS_BACKGROUND,
  'statusBar.noFolderBackground': VIC20_STATUS_BACKGROUND,
  'statusBar.noFolderForeground': VIC20_BACKGROUND,
  'statusBar.noFolderBorder': VIC20_STATUS_BACKGROUND,
  'statusBarItem.activeBackground': VIC20_STATUS_ACTIVE_BACKGROUND,
  'statusBarItem.hoverBackground': VIC20_STATUS_HOVER_BACKGROUND,

  'list.hoverBackground': VIC20_PANEL_HEADER_BACKGROUND,
  'list.hoverForeground': VIC20_TEXT,
  'list.activeSelectionBackground': VIC20_TAB_SELECTED_BACKGROUND,
  'list.activeSelectionForeground': VIC20_TEXT,
  'list.inactiveSelectionBackground': VIC20_TAB_INACTIVE_BACKGROUND,
  'list.inactiveSelectionForeground': VIC20_TEXT,
  'list.focusBackground': VIC20_TAB_SELECTED_BACKGROUND,
  'list.focusForeground': VIC20_TEXT,
  'list.highlightForeground': VIC20_KEYCAP,
  'list.focusOutline': VIC20_FUNCTION_KEY,

  'breadcrumb.background': VIC20_BACKGROUND,
  'breadcrumb.foreground': VIC20_MUTED_TEXT,
  'breadcrumb.focusForeground': VIC20_TEXT,
  'breadcrumb.activeSelectionForeground': VIC20_KEYCAP,

  'input.background': VIC20_PANEL_BACKGROUND,
  'input.foreground': VIC20_TEXT,
  'input.border': VIC20_BORDER,
  'input.placeholderForeground': VIC20_MUTED_TEXT,
  'dropdown.background': VIC20_PANEL_BACKGROUND,
  'dropdown.foreground': VIC20_TEXT,
  'dropdown.border': VIC20_BORDER,
  'button.background': VIC20_STATUS_BACKGROUND,
  'button.foreground': VIC20_BACKGROUND,
  'button.hoverBackground': VIC20_BUTTON_HOVER_BACKGROUND,
  'button.secondaryBackground': VIC20_PANEL_HEADER_BACKGROUND,
  'button.secondaryForeground': VIC20_TEXT,
  'button.secondaryHoverBackground': VIC20_TAB_SELECTED_BACKGROUND,

  'menu.background': VIC20_PANEL_BACKGROUND,
  'menu.foreground': VIC20_TEXT,
  'menu.selectionBackground': VIC20_PANEL_HEADER_BACKGROUND,
  'menu.selectionForeground': VIC20_TEXT,
  'menu.border': VIC20_BORDER,
  'menubar.selectionBackground': VIC20_PANEL_HEADER_BACKGROUND,
  'menubar.selectionForeground': VIC20_TEXT,

  'quickInput.background': VIC20_PANEL_BACKGROUND,
  'quickInput.foreground': VIC20_TEXT,
  'quickInputTitle.background': VIC20_PANEL_HEADER_BACKGROUND,
  'pickerGroup.foreground': VIC20_KEYCAP,
  'pickerGroup.border': VIC20_BORDER,

  'scrollbarSlider.background': '#8f806a66',
  'scrollbarSlider.hoverBackground': '#8f806a99',
  'scrollbarSlider.activeBackground': '#8f806acc',
  'sash.hoverBorder': VIC20_FUNCTION_KEY,
  'sash.activeBorder': VIC20_FUNCTION_KEY,
  'badge.background': VIC20_STATUS_BACKGROUND,
  'badge.foreground': VIC20_BACKGROUND
};

const VIC20_EDITOR_COLOR_OVERRIDES = {
  'editor.background': VIC20_EDITOR_BACKGROUND,
  'notebook.cellEditorBackground': VIC20_EDITOR_BACKGROUND,
  'peekViewEditor.background': VIC20_EDITOR_BACKGROUND
};

const VIC20_THEME_JSON = {
  name: VIC20_THEME_LABEL,
  tokenColors: SOLARIZED_LIGHT_TOKEN_COLORS,
  colors: {
    ...VIC20_THEME_COLORS,
    ...SOLARIZED_LIGHT_EDITOR_COLORS,
    ...VIC20_EDITOR_COLOR_OVERRIDES
  },
  semanticHighlighting: true
};

@injectable()
export class CommodoreCommanderThemingService extends MonacoThemingService {
  private registeredVic20Theme = false;

  override initialize(): void {
    super.initialize();
    this.registerVic20Theme();
    this.activateVic20DefaultTheme();
  }

  private registerVic20Theme(): void {
    if (this.registeredVic20Theme) {
      return;
    }

    this.monacoThemeRegistry.register(
      VIC20_THEME_JSON,
      undefined,
      VIC20_THEME_ID,
      'vs'
    );
    this.themeService.register({
      id: VIC20_THEME_ID,
      type: 'light',
      label: VIC20_THEME_LABEL,
      editorTheme: VIC20_THEME_ID
    });
    this.registeredVic20Theme = true;
  }

  private activateVic20DefaultTheme(): void {
    const configuredDefaultTheme = DefaultTheme.defaultForOSTheme(
      FrontendApplicationConfigProvider.get().defaultTheme
    );
    if (configuredDefaultTheme !== VIC20_THEME_ID) {
      return;
    }

    const storedTheme = window.localStorage.getItem(ThemeService.STORAGE_KEY);
    if (!storedTheme || storedTheme === VIC20_THEME_ID) {
      this.themeService.setCurrentTheme(VIC20_THEME_ID, false);
    }
  }
}

@injectable()
export class CommodoreCommanderThemeStyleParticipant implements ColorContribution, StylingParticipant {
  registerColors(colors: ColorRegistry): void {
    colors.register(
      {
        id: VIC20_COLOR_IDS.background,
        defaults: VIC20_BACKGROUND,
        description: 'Commodore Commander VIC-20 case background.'
      },
      {
        id: VIC20_COLOR_IDS.activityBackground,
        defaults: VIC20_ACTIVITY_BACKGROUND,
        description: 'Commodore Commander VIC-20 activity bar background.'
      },
      {
        id: VIC20_COLOR_IDS.highlight,
        defaults: VIC20_FUNCTION_KEY,
        description: 'Commodore Commander VIC-20 highlight color.'
      },
      {
        id: VIC20_COLOR_IDS.label,
        defaults: VIC20_KEYCAP,
        description: 'Commodore Commander VIC-20 label color.'
      },
      {
        id: VIC20_COLOR_IDS.labelForeground,
        defaults: VIC20_KEYCAP,
        description: 'Commodore Commander VIC-20 label foreground color.'
      },
      {
        id: VIC20_COLOR_IDS.statusBackground,
        defaults: VIC20_STATUS_BACKGROUND,
        description: 'Commodore Commander VIC-20 status bar background.'
      },
      {
        id: VIC20_COLOR_IDS.text,
        defaults: VIC20_TEXT,
        description: 'Commodore Commander VIC-20 text color.'
      },
      {
        id: VIC20_COLOR_IDS.panelBackground,
        defaults: VIC20_PANEL_BACKGROUND,
        description: 'Commodore Commander VIC-20 panel background.'
      },
      {
        id: VIC20_COLOR_IDS.panelHeaderBackground,
        defaults: VIC20_PANEL_HEADER_BACKGROUND,
        description: 'Commodore Commander VIC-20 panel header background.'
      }
    );
  }

  registerThemeStyle(theme: ColorTheme, collector: CssStyleCollector): void {
    const themed = (id: string, fallback: string): string =>
      theme.getColor(id) ?? fallback;

    collector.addRule(`
:root {
  --cc-vic20-background: ${themed(VIC20_COLOR_IDS.background, VIC20_BACKGROUND)};
  --cc-vic20-activity-background: ${themed(VIC20_COLOR_IDS.activityBackground, VIC20_ACTIVITY_BACKGROUND)};
  --cc-vic20-highlight: ${themed(VIC20_COLOR_IDS.highlight, VIC20_FUNCTION_KEY)};
  --cc-vic20-label: ${themed(VIC20_COLOR_IDS.label, VIC20_KEYCAP)};
  --cc-vic20-label-foreground: ${themed(VIC20_COLOR_IDS.labelForeground, VIC20_KEYCAP)};
  --cc-vic20-status-background: ${themed(VIC20_COLOR_IDS.statusBackground, VIC20_STATUS_BACKGROUND)};
  --cc-vic20-text: ${themed(VIC20_COLOR_IDS.text, VIC20_TEXT)};
  --cc-vic20-panel-background: ${themed(VIC20_COLOR_IDS.panelBackground, VIC20_PANEL_BACKGROUND)};
  --cc-vic20-panel-header-background: ${themed(VIC20_COLOR_IDS.panelHeaderBackground, VIC20_PANEL_HEADER_BACKGROUND)};
}

.cc-sidscore-highlight {
  border-bottom: 2px solid var(--cc-vic20-highlight, ${VIC20_FUNCTION_KEY});
  border-radius: 2px;
}

.cc-sidscore-highlight-voice-1 {
  background: rgba(43, 138, 62, 0.22);
}

.cc-sidscore-highlight-voice-2 {
  background: rgba(28, 109, 208, 0.20);
}

.cc-sidscore-highlight-voice-3 {
  background: rgba(177, 93, 0, 0.22);
}

.cc-sidscore-scope-controls {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.cc-sidscore-scope-controls__label {
  color: var(--theia-descriptionForeground);
  font-size: 11px;
  font-weight: 600;
}

.cc-sidscore-scope-segment {
  display: inline-flex;
}

.cc-sidscore-scope-segment .theia-button {
  border-radius: 0;
  margin: 0;
  min-height: 24px;
  min-width: 30px;
  padding: 2px 8px;
}

.cc-sidscore-scope-segment .theia-button:first-child {
  border-radius: 3px 0 0 3px;
}

.cc-sidscore-scope-segment .theia-button:last-child {
  border-radius: 0 3px 3px 0;
}

.cc-sidscore-scope-freeze {
  align-items: center;
  display: inline-flex;
  justify-content: center;
  margin-left: auto;
  min-height: 24px;
  min-width: 28px;
  padding: 2px;
  width: 28px;
}

.cc-sidscore-protocol-log-widget {
  min-width: 360px;
}

.cc-sidscore-protocol-log {
  --cc-sidscore-protocol-background: var(--theia-panel-background, var(--theia-editor-background));
  --cc-sidscore-protocol-foreground: var(--theia-foreground);
  --cc-sidscore-protocol-muted: var(--theia-descriptionForeground);
  --cc-sidscore-protocol-border: var(--theia-panel-border, var(--theia-editorGroup-border, var(--theia-contrastBorder, var(--cc-sidscore-protocol-muted))));
  --cc-sidscore-protocol-surface: var(--theia-editorWidget-background, var(--cc-sidscore-protocol-background));
  --cc-sidscore-protocol-header-background: color-mix(
    in srgb,
    var(--cc-sidscore-protocol-surface) 86%,
    var(--cc-sidscore-protocol-background)
  );
  --cc-sidscore-protocol-row-border: color-mix(
    in srgb,
    var(--cc-sidscore-protocol-border) 62%,
    transparent
  );
  --cc-sidscore-protocol-sent: var(--theia-terminal-ansiGreen, var(--theia-charts-green, var(--theia-textLink-foreground, var(--cc-sidscore-protocol-foreground))));
  --cc-sidscore-protocol-received: var(--theia-terminal-ansiBlue, var(--theia-charts-blue, var(--theia-textLink-foreground, var(--cc-sidscore-protocol-foreground))));
  background: var(--cc-sidscore-protocol-background);
  color: var(--cc-sidscore-protocol-foreground);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.cc-sidscore-protocol-log__toolbar {
  align-items: center;
  background: var(--cc-sidscore-protocol-header-background);
  border-bottom: 1px solid var(--cc-sidscore-protocol-border);
  color: var(--cc-sidscore-protocol-muted);
  display: flex;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  gap: 10px;
  min-width: 0;
  padding: 6px 10px;
}

.cc-sidscore-protocol-log__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-sidscore-protocol-log__count {
  color: var(--cc-sidscore-protocol-muted);
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}

.cc-sidscore-protocol-log__filter {
  align-items: center;
  color: var(--cc-sidscore-protocol-muted);
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 600;
  gap: 5px;
  line-height: 1.1;
  min-width: 0;
  white-space: nowrap;
}

.cc-sidscore-protocol-log__filter input {
  margin: 0;
}

.cc-sidscore-protocol-log__clear {
  flex: 0 0 auto;
  min-height: 24px;
}

.cc-sidscore-protocol-log__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.cc-sidscore-protocol-log__empty {
  color: var(--cc-sidscore-protocol-muted);
  font-size: 12px;
  padding: 10px;
}

.cc-sidscore-protocol-log__table {
  border-collapse: collapse;
  font-size: 12px;
  min-width: 880px;
  table-layout: fixed;
  width: 100%;
}

.cc-sidscore-protocol-log__table th,
.cc-sidscore-protocol-log__table td {
  border-bottom: 1px solid var(--cc-sidscore-protocol-row-border);
  overflow: hidden;
  padding: 4px 8px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-sidscore-protocol-log__table th {
  background: var(--cc-sidscore-protocol-header-background);
  color: var(--cc-sidscore-protocol-muted);
  font-size: 11px;
  font-weight: 700;
  position: sticky;
  text-transform: uppercase;
  top: 0;
  z-index: 1;
}

.cc-sidscore-protocol-log__table th:nth-child(1) {
  width: 72px;
}

.cc-sidscore-protocol-log__table th:nth-child(2) {
  width: 52px;
}

.cc-sidscore-protocol-log__table th:nth-child(4),
.cc-sidscore-protocol-log__table th:nth-child(5),
.cc-sidscore-protocol-log__table th:nth-child(6),
.cc-sidscore-protocol-log__table th:nth-child(7) {
  width: 72px;
}

.cc-sidscore-protocol-log__table th:nth-child(3) {
  width: 172px;
}

.cc-sidscore-protocol-log__payload {
  color: var(--cc-sidscore-protocol-muted);
  font-family: monospace;
}

.cc-sidscore-protocol-log__direction {
  border-radius: 3px;
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  min-width: 28px;
  text-align: center;
}

.cc-sidscore-protocol-log__direction--sent {
  background: color-mix(in srgb, var(--cc-sidscore-protocol-sent) 18%, transparent);
  color: var(--cc-sidscore-protocol-sent);
}

.cc-sidscore-protocol-log__direction--received {
  background: color-mix(in srgb, var(--cc-sidscore-protocol-received) 18%, transparent);
  color: var(--cc-sidscore-protocol-received);
}

.cc-vice-monitor-log-widget {
  min-width: 420px;
}

.cc-vice-monitor-log {
  --cc-vice-monitor-background: var(--theia-panel-background, var(--theia-editor-background));
  --cc-vice-monitor-foreground: var(--theia-foreground);
  --cc-vice-monitor-muted: var(--theia-descriptionForeground);
  --cc-vice-monitor-border: var(--theia-panel-border, var(--theia-editorGroup-border, var(--theia-contrastBorder, var(--cc-vice-monitor-muted))));
  --cc-vice-monitor-surface: var(--theia-editorWidget-background, var(--cc-vice-monitor-background));
  --cc-vice-monitor-header-background: color-mix(
    in srgb,
    var(--cc-vice-monitor-surface) 86%,
    var(--cc-vice-monitor-background)
  );
  --cc-vice-monitor-row-border: color-mix(
    in srgb,
    var(--cc-vice-monitor-border) 62%,
    transparent
  );
  --cc-vice-monitor-user: var(--theia-descriptionForeground, var(--cc-vice-monitor-foreground));
  --cc-vice-monitor-input: var(--theia-terminal-ansiGreen, var(--theia-charts-green, var(--theia-textLink-foreground, var(--cc-vice-monitor-foreground))));
  --cc-vice-monitor-output: var(--theia-terminal-ansiBlue, var(--theia-charts-blue, var(--theia-textLink-foreground, var(--cc-vice-monitor-foreground))));
  --cc-vice-monitor-error: var(--theia-errorForeground, var(--theia-terminal-ansiRed, #f14c4c));
  background: var(--cc-vice-monitor-background);
  color: var(--cc-vice-monitor-foreground);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.cc-vice-monitor-log__toolbar {
  align-items: center;
  background: var(--cc-vice-monitor-header-background);
  border-bottom: 1px solid var(--cc-vice-monitor-border);
  color: var(--cc-vice-monitor-muted);
  display: flex;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  gap: 10px;
  min-width: 0;
  padding: 6px 10px;
}

.cc-vice-monitor-log__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-vice-monitor-log__count {
  color: var(--cc-vice-monitor-muted);
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}

.cc-vice-monitor-log__copy,
.cc-vice-monitor-log__clear {
  flex: 0 0 auto;
  min-height: 24px;
}

.cc-vice-monitor-log__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.cc-vice-monitor-log__empty {
  color: var(--cc-vice-monitor-muted);
  font-size: 12px;
  padding: 10px;
}

.cc-vice-monitor-log__table {
  border-collapse: collapse;
  font-size: 12px;
  min-width: 980px;
  table-layout: fixed;
  width: 100%;
}

.cc-vice-monitor-log__table th,
.cc-vice-monitor-log__table td {
  border-bottom: 1px solid var(--cc-vice-monitor-row-border);
  overflow: hidden;
  padding: 4px 8px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-vice-monitor-log__table th {
  background: var(--cc-vice-monitor-header-background);
  color: var(--cc-vice-monitor-muted);
  font-size: 11px;
  font-weight: 700;
  position: sticky;
  text-transform: uppercase;
  top: 0;
  z-index: 1;
}

.cc-vice-monitor-log__table th:nth-child(1) {
  width: 72px;
}

.cc-vice-monitor-log__table th:nth-child(2) {
  width: 52px;
}

.cc-vice-monitor-log__table th:nth-child(3),
.cc-vice-monitor-log__table th:nth-child(5) {
  width: 72px;
}

.cc-vice-monitor-log__table th:nth-child(4) {
  width: 188px;
}

.cc-vice-monitor-log__table th:nth-child(7) {
  width: 260px;
}

.cc-vice-monitor-log__message,
.cc-vice-monitor-log__payload {
  font-family: monospace;
}

.cc-vice-monitor-log__payload {
  color: var(--cc-vice-monitor-muted);
}

.cc-vice-monitor-log__direction {
  border-radius: 3px;
  display: inline-block;
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  min-width: 32px;
  text-align: center;
}

.cc-vice-monitor-log__direction--user {
  background: color-mix(in srgb, var(--cc-vice-monitor-user) 18%, transparent);
  color: var(--cc-vice-monitor-user);
}

.cc-vice-monitor-log__direction--input {
  background: color-mix(in srgb, var(--cc-vice-monitor-input) 18%, transparent);
  color: var(--cc-vice-monitor-input);
}

.cc-vice-monitor-log__direction--output {
  background: color-mix(in srgb, var(--cc-vice-monitor-output) 18%, transparent);
  color: var(--cc-vice-monitor-output);
}

.cc-vice-monitor-log__row--error .cc-vice-monitor-log__message,
.cc-vice-monitor-log__row--error .cc-vice-monitor-log__payload {
  color: var(--cc-vice-monitor-error);
}

.cc-sid-instrument-widget,
.cc-sid-sfx-widget {
  min-width: 280px;
}

.cc-sid-instrument,
.cc-sid-sfx {
  --cc-sid-control-active: var(--cc-vic20-highlight, var(--theia-focusBorder));
  --cc-sid-control-panel: var(--cc-vic20-status-background, var(--theia-sideBar-background));
  --cc-sid-control-border: color-mix(in srgb, var(--cc-sid-control-active) 58%, transparent);
  --cc-sid-control-surface: color-mix(in srgb, var(--cc-sid-control-panel) 72%, var(--cc-vic20-background, var(--theia-foreground)) 28%);
  --cc-sid-control-recess: color-mix(in srgb, var(--cc-sid-control-panel) 90%, black);
  --cc-sid-control-text: var(--cc-vic20-background, var(--theia-foreground));
  --cc-sid-control-muted: color-mix(in srgb, var(--cc-sid-control-text) 66%, transparent);
  background: var(--cc-sid-control-panel);
  color: var(--cc-sid-control-text);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.cc-sid-instrument input,
.cc-sid-instrument select,
.cc-sid-instrument button,
.cc-sid-sfx input,
.cc-sid-sfx select,
.cc-sid-sfx button,
.cc-sid-sfx textarea {
  box-sizing: border-box;
  font: inherit;
  letter-spacing: 0;
}

.cc-sid-instrument__header {
  align-items: end;
  background: color-mix(in srgb, var(--cc-sid-control-panel) 82%, var(--cc-vic20-background, var(--theia-foreground)) 18%);
  border-bottom: 1px solid var(--cc-sid-control-border);
  display: grid;
  flex: 0 0 auto;
  gap: 7px;
  grid-template-columns: minmax(0, 1fr) minmax(52px, 65px) minmax(63px, 74px);
  padding: 9px;
}

.cc-sid-instrument__sections {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.cc-sid-sfx__header {
  align-items: end;
  background: color-mix(in srgb, var(--cc-sid-control-panel) 82%, var(--cc-vic20-background, var(--theia-foreground)) 18%);
  border-bottom: 1px solid var(--cc-sid-control-border);
  display: grid;
  flex: 0 0 auto;
  gap: 7px;
  grid-template-columns: minmax(76px, 0.72fr) minmax(0, 1fr) minmax(63px, 0.55fr);
  padding: 9px;
}

.cc-sid-sfx__sections {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.cc-sid-sfx__sections > .cc-sid-section {
  flex: 0 0 auto;
}

.cc-sid-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.cc-sid-field__label {
  color: var(--cc-sid-control-muted);
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.cc-sid-field__control {
  background: color-mix(in srgb, var(--cc-sid-control-panel) 78%, black);
  border: 1px solid var(--cc-sid-control-border);
  border-radius: 4px;
  color: var(--cc-sid-control-text);
  min-height: 23px;
  min-width: 0;
  padding: 3px 5px;
  width: 100%;
}

.cc-sid-field__control:focus,
.cc-sid-button:focus-visible,
.cc-sid-knob__dial:focus-within {
  outline: 1px solid var(--cc-sid-control-active);
  outline-offset: 2px;
}

.cc-sid-section {
  border-bottom: 1px solid color-mix(in srgb, var(--cc-sid-control-border) 70%, transparent);
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr);
  margin: 0;
  min-width: 0;
}

.cc-sid-section__label {
  align-items: center;
  align-self: stretch;
  background: color-mix(in srgb, var(--cc-sid-control-panel) 86%, black);
  color: var(--cc-sid-control-muted);
  display: flex;
  font-size: 9px;
  font-weight: 600;
  justify-content: center;
  line-height: 1.15;
  margin: 0;
  overflow: hidden;
  padding: 7px 4px;
  text-align: center;
  text-transform: uppercase;
  transform: rotate(180deg);
  writing-mode: vertical-rl;
}

.cc-sid-section__body {
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-width: 0;
  padding: 11px 9px 13px;
}

.cc-sid-visualization {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.cc-sid-visualization__graph {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--cc-sid-control-active) 10%, transparent), transparent 54%),
    var(--cc-sid-control-recess);
  border: 1px solid color-mix(in srgb, var(--cc-sid-control-border) 72%, black);
  border-radius: 5px;
  box-sizing: border-box;
  display: block;
  height: 104px;
  min-width: 0;
  width: 100%;
}

.cc-sid-visualization__grid {
  stroke: color-mix(in srgb, var(--cc-sid-control-text) 18%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.cc-sid-visualization__envelope-fill {
  fill: color-mix(in srgb, var(--cc-sid-control-active) 18%, transparent);
}

.cc-sid-visualization__envelope-line {
  fill: none;
  stroke: color-mix(in srgb, var(--cc-sid-control-active) 82%, white);
  stroke-linecap: square;
  stroke-linejoin: round;
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
}

.cc-sid-visualization__label {
  fill: var(--cc-sid-control-muted);
  font-size: 9px;
  font-weight: 700;
  text-anchor: middle;
}

.cc-sid-instrument__footer {
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr);
  min-width: 0;
}

.cc-sid-instrument__footer::before {
  background: color-mix(in srgb, var(--cc-sid-control-panel) 86%, black);
  content: "";
}

.cc-sid-reset-button {
  min-width: 86px;
}

.cc-sid-footer-controls {
  align-items: center;
  display: flex;
  gap: 11px;
  justify-content: space-between;
  margin: 11px 9px 14px;
  min-width: 0;
}

.cc-sid-source-readout {
  color: var(--cc-sid-control-muted);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-sid-midi-controls {
  border-top: 1px solid color-mix(in srgb, var(--cc-sid-control-border) 62%, transparent);
  display: flex;
  flex-direction: column;
  gap: 9px;
  grid-column: 2;
  margin: 0 9px 14px;
  min-width: 0;
}

.cc-sid-midi-controls__top {
  align-items: end;
  display: grid;
  gap: 7px;
  grid-template-columns: minmax(91px, 0.85fr) minmax(54px, 0.55fr) minmax(104px, 1fr);
  min-width: 0;
  padding-top: 11px;
}

.cc-sid-midi-mode-field {
  min-width: 0;
}

.cc-sid-midi-device-field {
  min-width: 0;
}

.cc-sid-midi-voice-grid {
  display: grid;
  gap: 7px;
  grid-template-columns: repeat(3, minmax(58px, 1fr));
  min-width: 0;
}

.cc-sid-midi-voice {
  align-items: end;
  display: grid;
  gap: 5px;
  grid-template-columns: minmax(29px, 0.55fr) minmax(40px, 0.45fr);
  min-width: 0;
}

.cc-sid-midi-voice__toggle {
  align-items: center;
  background: var(--cc-sid-control-surface);
  border: 1px solid color-mix(in srgb, var(--cc-sid-control-border) 74%, var(--theia-button-border, transparent));
  border-radius: 5px;
  color: var(--cc-sid-control-text);
  cursor: pointer;
  display: inline-flex;
  font-size: 10px;
  font-weight: 700;
  gap: 4px;
  justify-content: center;
  line-height: 1.1;
  min-height: 23px;
  min-width: 0;
  overflow: hidden;
  padding: 3px 4px;
  text-transform: uppercase;
  white-space: nowrap;
}

.cc-sid-midi-voice__toggle input {
  margin: 0;
}

.cc-sid-wave-grid {
  display: grid;
  gap: 7px;
  grid-template-columns: repeat(4, minmax(38px, 1fr));
  min-width: 0;
}

.cc-sid-toggle-grid,
.cc-sid-filter-modes {
  display: grid;
  gap: 7px;
  grid-template-columns: repeat(auto-fit, minmax(59px, 1fr));
  min-width: 0;
}

.cc-sid-row-controls {
  align-items: end;
  display: grid;
  gap: 7px;
  grid-template-columns: minmax(101px, 1fr) minmax(49px, 0.5fr) minmax(76px, 0.8fr);
  min-width: 0;
}

.cc-sid-button {
  align-items: center;
  background: var(--cc-sid-control-surface);
  border: 1px solid color-mix(in srgb, var(--cc-sid-control-border) 74%, var(--theia-button-border, transparent));
  border-radius: 5px;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 26%, transparent),
    inset 0 -2px 0 color-mix(in srgb, black 12%, transparent);
  color: var(--cc-sid-control-text);
  cursor: pointer;
  display: inline-flex;
  font-size: 10px;
  font-weight: 700;
  justify-content: center;
  line-height: 1.1;
  min-height: 31px;
  min-width: 0;
  overflow: hidden;
  padding: 5px 7px;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.cc-sid-tooltip-host {
  display: inline-flex;
  min-width: 0;
}

.cc-sid-tooltip-host > .cc-sid-button {
  flex: 1;
  width: 100%;
}

.cc-sid-button:hover {
  background: color-mix(in srgb, var(--cc-sid-control-surface) 84%, var(--cc-sid-control-active));
}

.cc-sid-button:disabled,
.cc-sid-button--disabled {
  cursor: default;
  opacity: 0.48;
}

.cc-sid-button:disabled:hover,
.cc-sid-button--disabled:hover {
  background: var(--cc-sid-control-surface);
}

.cc-sid-button--active {
  background: color-mix(in srgb, var(--cc-sid-control-active) 48%, var(--cc-sid-control-panel));
  border-color: color-mix(in srgb, var(--cc-sid-control-active) 84%, var(--cc-sid-control-border));
  color: var(--cc-sid-control-text);
}

.cc-sid-wave-button {
  flex-direction: column;
  gap: 3px;
  min-height: 49px;
  padding: 5px;
}

.cc-sid-wave-button__icon {
  color: currentColor;
  height: 23px;
  max-width: 100%;
  width: 40px;
}

.cc-sid-wave-button__label {
  display: block;
  font-size: 9px;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.cc-sid-knob-grid {
  display: grid;
  gap: 9px 7px;
  grid-template-columns: repeat(4, minmax(45px, 1fr));
  min-width: 0;
}

.cc-sid-knob-grid--five {
  grid-template-columns: repeat(auto-fit, minmax(45px, 1fr));
}

.cc-sid-knob-grid--two {
  grid-template-columns: repeat(2, minmax(45px, 1fr));
}

.cc-sid-knob {
  align-items: center;
  display: grid;
  gap: 3px;
  justify-items: center;
  min-width: 0;
}

.cc-sid-knob--disabled {
  opacity: 0.48;
}

.cc-sid-knob__value {
  color: var(--cc-sid-control-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 13px;
  min-height: 13px;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  width: 100%;
}

.cc-sid-knob__dial {
  background:
    radial-gradient(circle at 50% 42%, color-mix(in srgb, white 20%, transparent), transparent 34%),
    radial-gradient(circle at 50% 52%, var(--cc-sid-control-surface) 0 50%, transparent 51%),
    conic-gradient(from -130deg, var(--cc-sid-control-active) 0 var(--cc-sid-knob-fill), transparent var(--cc-sid-knob-fill) 260deg, transparent 0),
    repeating-conic-gradient(from -130deg, color-mix(in srgb, var(--cc-sid-control-text) 22%, transparent) 0 2deg, transparent 2deg 13deg),
    var(--cc-sid-control-recess);
  border: 1px solid color-mix(in srgb, var(--cc-sid-control-border) 70%, black);
  border-radius: 999px;
  box-shadow:
    inset 0 2px 5px color-mix(in srgb, white 12%, transparent),
    inset 0 -4px 7px color-mix(in srgb, black 24%, transparent),
    0 1px 2px color-mix(in srgb, black 18%, transparent);
  display: block;
  height: 47px;
  position: relative;
  width: 47px;
}

.cc-sid-knob__dial::before {
  background: var(--cc-sid-control-text);
  border-radius: 999px;
  content: "";
  height: 17px;
  left: 50%;
  position: absolute;
  top: 7px;
  transform: translateX(-50%) rotate(var(--cc-sid-knob-angle));
  transform-origin: 50% 16px;
  width: 2px;
  z-index: 1;
}

.cc-sid-knob__dial::after {
  background: color-mix(in srgb, var(--cc-sid-control-surface) 72%, var(--cc-vic20-background, white));
  border-radius: 999px;
  box-shadow: inset 0 -2px 4px color-mix(in srgb, black 18%, transparent);
  content: "";
  height: 31px;
  left: 8px;
  position: absolute;
  top: 8px;
  width: 31px;
}

.cc-sid-knob__input {
  cursor: pointer;
  height: 100%;
  inset: 0;
  opacity: 0;
  position: absolute;
  width: 100%;
  z-index: 2;
}

.cc-sid-knob__input:disabled {
  cursor: default;
  pointer-events: none;
}

.cc-sid-knob__label {
  color: var(--cc-sid-control-text);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.1;
  min-height: 12px;
  overflow-wrap: anywhere;
  text-align: center;
  text-transform: uppercase;
}

.cc-sid-register-readout {
  align-items: center;
  color: var(--cc-sid-control-muted);
  display: flex;
  font-size: 10px;
  font-weight: 700;
  gap: 7px;
  justify-content: space-between;
  line-height: 1.2;
  min-width: 0;
  text-transform: uppercase;
}

.cc-sid-register-readout span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-sid-sfx-grid {
  align-items: end;
  display: grid;
  gap: 7px;
  min-width: 0;
}

.cc-sid-sfx-grid--three {
  grid-template-columns: repeat(3, minmax(55px, 1fr));
}

.cc-sid-sfx-readout {
  color: var(--cc-sid-control-muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1;
  min-height: 10px;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-sid-sfx-toggle {
  align-items: center;
  align-self: stretch;
  background: var(--cc-sid-control-surface);
  border: 1px solid color-mix(in srgb, var(--cc-sid-control-border) 74%, var(--theia-button-border, transparent));
  border-radius: 5px;
  color: var(--cc-sid-control-text);
  cursor: pointer;
  display: flex;
  font-size: 10px;
  font-weight: 700;
  gap: 6px;
  justify-content: center;
  line-height: 1.1;
  min-height: 31px;
  min-width: 0;
  overflow: hidden;
  padding: 5px 7px;
  text-transform: uppercase;
}

.cc-sid-sfx-toggle input {
  flex: 0 0 auto;
  margin: 0;
}

.cc-sid-sfx-toggle span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-sid-sfx-toggle--disabled {
  cursor: default;
  opacity: 0.48;
}

.cc-sid-sfx-pulse-grid {
  display: grid;
  gap: 7px;
  grid-template-columns: minmax(0, 2fr) minmax(95px, 1fr);
  min-width: 0;
}

.cc-sid-sfx-pulse-grid > .cc-sid-sfx-toggle {
  min-height: 100%;
}

.cc-sid-sfx-visualization {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--cc-sid-control-active) 10%, transparent), transparent 54%),
    var(--cc-sid-control-recess);
  border: 1px solid color-mix(in srgb, var(--cc-sid-control-border) 72%, black);
  border-radius: 5px;
  box-sizing: border-box;
  display: block;
  height: 104px;
  min-width: 0;
  width: 100%;
}

.cc-sid-sfx-visualization__envelope {
  fill: none;
  stroke: color-mix(in srgb, var(--cc-sid-control-active) 82%, white);
  stroke-linecap: square;
  stroke-linejoin: round;
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
}

.cc-sid-sfx-visualization__pitch {
  fill: none;
  stroke: color-mix(in srgb, var(--cc-vic20-cyan, var(--theia-charts-blue)) 84%, white);
  stroke-dasharray: 5 4;
  stroke-linecap: square;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.cc-sid-sfx-visualization__gate {
  stroke: color-mix(in srgb, var(--cc-sid-control-muted) 72%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.cc-sid-sfx__sections > .cc-sid-section--source {
  flex: 1 1 300px;
  min-height: 280px;
}

.cc-sid-section--source .cc-sid-section__body {
  min-height: 0;
  overflow: hidden;
}

.cc-sid-sfx-source-editor {
  background: color-mix(in srgb, var(--cc-sid-control-panel) 78%, black);
  border: 1px solid var(--cc-sid-control-border);
  border-radius: 5px;
  color: var(--cc-sid-control-text);
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  width: 100%;
}

.cc-sid-sfx-source-editor:focus-within {
  outline: 1px solid var(--cc-sid-control-active);
  outline-offset: 2px;
}

.cc-sid-sfx-actions {
  display: grid;
  gap: 7px;
  grid-template-columns: repeat(3, minmax(58px, 1fr));
  min-width: 0;
}

.cc-sid-sfx-actions .cc-sid-button {
  gap: 5px;
}

@media (max-width: 320px) {
  .cc-sid-instrument__header {
    grid-template-columns: 1fr 1fr;
  }

  .cc-sid-field--wide {
    grid-column: 1 / -1;
  }

  .cc-sid-wave-grid,
  .cc-sid-knob-grid,
  .cc-sid-knob-grid--five,
  .cc-sid-knob-grid--two {
    grid-template-columns: repeat(2, minmax(49px, 1fr));
  }

  .cc-sid-sfx-pulse-grid {
    grid-template-columns: 1fr;
  }

  .cc-sid-row-controls {
    grid-template-columns: 1fr;
  }

  .cc-sid-midi-controls {
    grid-column: 1 / -1;
  }

  .cc-sid-midi-controls__top,
  .cc-sid-midi-voice-grid {
    grid-template-columns: 1fr;
  }
}

`);
  }
}
