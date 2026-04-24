# Commodore Commander Theme

The default Theia color theme is `VIC-20`. It is a real Theia/Monaco theme,
not a set of broad CSS overrides. The theme combines VIC-20-inspired workbench
chrome with editor and token colors copied from VS Code's bundled Solarized
Light theme.

## Theme Identity

| Property | Value |
| --- | --- |
| TypeScript id constant | `VIC20_THEME_ID = "vic20"` |
| TypeScript label constant | `VIC20_THEME_LABEL = "VIC-20"` |
| Theia `ThemeService` id | `vic20` |
| Theia theme type | `light` |
| Theia `editorTheme` / Monaco theme id | `vic20` |
| Monaco base theme | `vs` |
| Default app theme | `defaultTheme: "vic20"` in the Electron app config |
| Theme source | `packages/theia-extension/src/browser/commodore-commander-theme.ts` |
| Solarized source copy | `packages/theia-extension/src/browser/solarized-light-editor-colors.ts` |

The extension rebinds `MonacoThemingService` to
`CommodoreCommanderThemingService`. During initialization, it lets the base
service register Theia/Monaco defaults, then registers `VIC20_THEME_JSON` with
the Monaco theme registry under `VIC20_THEME_ID` and the light `vs` base theme.
It also registers the Theia workbench theme through `ThemeService` with the same
`VIC20_THEME_ID` as both the Theia theme id and `editorTheme`, so selecting the
Theia theme selects the matching Monaco editor theme.

The theme is activated as the default only when the app default is `vic20` and
there is no different stored user theme in `ThemeService.STORAGE_KEY`, so an
explicit user theme choice is preserved.

## Palette

The `cc.vic20.*` ids are registered with Theia's `ColorRegistry` and supplied by
`VIC20_THEME_JSON.colors` when `ThemeService` selects `vic20`. Theia also
exposes the standard CSS variables `--theia-cc-vic20-*` for those ids.
Commodore Commander widgets normally use the shorter `--cc-vic20-*` aliases
emitted by `CommodoreCommanderThemeStyleParticipant`; each alias is resolved
from `theme.getColor("cc.vic20.*")` with the matching TypeScript constant as the
fallback.

| Theme color id | Commodore CSS alias | TypeScript constant | Sample | Usage | sRGB |
| --- | --- | --- | --- | --- | --- |
| `cc.vic20.background` | `--cc-vic20-background` | `VIC20_BACKGROUND` | <span aria-label="Light beige color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#F0EDE2;"></span> | Main VIC-20 case color for workbench chrome, tabs, panels, and side bars | `#F0EDE2` |
| `editor.background`, `notebook.cellEditorBackground`, `peekViewEditor.background` | _none_ | `VIC20_EDITOR_BACKGROUND` | <span aria-label="White editor color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#ffffff;"></span> | Main editor, notebook cell editor, and peek editor background | `#ffffff` |
| `cc.vic20.activityBackground` | `--cc-vic20-activity-background` | `VIC20_ACTIVITY_BACKGROUND` | <span aria-label="Activity rail beige color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#e9e1cc;"></span> | Left and right activity rails | `#e9e1cc` |
| `cc.vic20.highlight` | `--cc-vic20-highlight` | `VIC20_FUNCTION_KEY` | <span aria-label="Tan function key color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #6e512e;background:#b88d57;"></span> | Focus borders, active tab borders, panel title borders, separators | `#b88d57` |
| `cc.vic20.label`, `cc.vic20.labelForeground` | `--cc-vic20-label`, `--cc-vic20-label-foreground` | `VIC20_KEYCAP` | <span aria-label="Dark brown keycap color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #111;background:#33291f;"></span> | Labels, headings, links, and highlighted list text | `#33291f` |
| `cc.vic20.statusBackground` | `--cc-vic20-status-background` | `VIC20_STATUS_BACKGROUND` | <span aria-label="Dark status bar color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #111;background:#3c301e;"></span> | Status bar and primary buttons | `#3c301e` |
| `cc.vic20.text` | `--cc-vic20-text` | `VIC20_TEXT` | <span aria-label="Dark text color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #111;background:#2a241c;"></span> | General workbench foreground text | `#2a241c` |
| `cc.vic20.panelBackground` | `--cc-vic20-panel-background` | `VIC20_PANEL_BACKGROUND` | <span aria-label="Panel background color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#f8f6ef;"></span> | Inputs, menus, quick input, and Commodore Commander-owned panels | `#f8f6ef` |
| `cc.vic20.panelHeaderBackground` | `--cc-vic20-panel-header-background` | `VIC20_PANEL_HEADER_BACKGROUND` | <span aria-label="Panel header background color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#e4d8c3;"></span> | Sidebar section headers, menu selections, tab hover state | `#e4d8c3` |

## Editor Colors

Token colors and most editor-adjacent colors are copied from VS Code's bundled
Solarized Light theme:

`https://github.com/microsoft/vscode/blob/main/extensions/theme-solarized-light/themes/solarized-light-color-theme.json`

The VIC-20 theme then overrides the Solarized editor page color with white for
main editor surfaces. All syntax/token colors remain Solarized Light.

Final editor color ids after VIC-20 overrides:

| Color id | Sample | Final value | Source |
| --- | --- | --- | --- |
| `editor.background` | <span aria-label="editor.background color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#ffffff;"></span> | `#ffffff` | VIC-20 override |
| `editor.foreground` | <span aria-label="editor.foreground color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#657B83;"></span> | `#657B83` | Solarized Light |
| `notebook.cellEditorBackground` | <span aria-label="notebook.cellEditorBackground color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#ffffff;"></span> | `#ffffff` | VIC-20 override |
| `editorWidget.background` | <span aria-label="editorWidget.background color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#EEE8D5;"></span> | `#EEE8D5` | Solarized Light |
| `editorCursor.foreground` | <span aria-label="editorCursor.foreground color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#657B83;"></span> | `#657B83` | Solarized Light |
| `editorWhitespace.foreground` | <span aria-label="editorWhitespace.foreground color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#586E7580;"></span> | `#586E7580` | Solarized Light |
| `editor.lineHighlightBackground` | <span aria-label="editor.lineHighlightBackground color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#EEE8D5;"></span> | `#EEE8D5` | Solarized Light |
| `editor.selectionBackground` | <span aria-label="editor.selectionBackground color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#EEE8D5;"></span> | `#EEE8D5` | Solarized Light |
| `minimap.selectionHighlight` | <span aria-label="minimap.selectionHighlight color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#EEE8D5;"></span> | `#EEE8D5` | Solarized Light |
| `editorIndentGuide.background` | <span aria-label="editorIndentGuide.background color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#586E7580;"></span> | `#586E7580` | Solarized Light |
| `editorIndentGuide.activeBackground` | <span aria-label="editorIndentGuide.activeBackground color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#081E2580;"></span> | `#081E2580` | Solarized Light |
| `editorHoverWidget.background` | <span aria-label="editorHoverWidget.background color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#CCC4B0;"></span> | `#CCC4B0` | Solarized Light |
| `editorLineNumber.activeForeground` | <span aria-label="editorLineNumber.activeForeground color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#567983;"></span> | `#567983` | Solarized Light |
| `peekViewResult.background` | <span aria-label="peekViewResult.background color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#EEE8D5;"></span> | `#EEE8D5` | Solarized Light |
| `peekViewEditor.background` | <span aria-label="peekViewEditor.background color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#ffffff;"></span> | `#ffffff` | VIC-20 override |
| `peekViewTitle.background` | <span aria-label="peekViewTitle.background color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#EEE8D5;"></span> | `#EEE8D5` | Solarized Light |
| `peekView.border` | <span aria-label="peekView.border color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#B58900;"></span> | `#B58900` | Solarized Light |
| `peekViewEditor.matchHighlightBackground` | <span aria-label="peekViewEditor.matchHighlightBackground color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#7744AA40;"></span> | `#7744AA40` | Solarized Light |
| `editorGroup.border` | <span aria-label="editorGroup.border color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#DDD6C1;"></span> | `#DDD6C1` | Solarized Light |
| `editorGroup.dropBackground` | <span aria-label="editorGroup.dropBackground color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#DDD6C1AA;"></span> | `#DDD6C1AA` | Solarized Light |
| `editorGroupHeader.tabsBackground` | <span aria-label="editorGroupHeader.tabsBackground color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#D9D2C2;"></span> | `#D9D2C2` | Solarized Light |
| `terminal.background` | <span aria-label="terminal.background color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#FDF6E3;"></span> | `#FDF6E3` | Solarized Light |
| `terminal.ansiBlack` | <span aria-label="terminal.ansiBlack color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#073642;"></span> | `#073642` | Solarized Light |
| `terminal.ansiRed` | <span aria-label="terminal.ansiRed color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#dc322f;"></span> | `#dc322f` | Solarized Light |
| `terminal.ansiGreen` | <span aria-label="terminal.ansiGreen color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#859900;"></span> | `#859900` | Solarized Light |
| `terminal.ansiYellow` | <span aria-label="terminal.ansiYellow color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#b58900;"></span> | `#b58900` | Solarized Light |
| `terminal.ansiBlue` | <span aria-label="terminal.ansiBlue color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#268bd2;"></span> | `#268bd2` | Solarized Light |
| `terminal.ansiMagenta` | <span aria-label="terminal.ansiMagenta color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#d33682;"></span> | `#d33682` | Solarized Light |
| `terminal.ansiCyan` | <span aria-label="terminal.ansiCyan color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#2aa198;"></span> | `#2aa198` | Solarized Light |
| `terminal.ansiWhite` | <span aria-label="terminal.ansiWhite color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#eee8d5;"></span> | `#eee8d5` | Solarized Light |
| `terminal.ansiBrightBlack` | <span aria-label="terminal.ansiBrightBlack color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#002b36;"></span> | `#002b36` | Solarized Light |
| `terminal.ansiBrightRed` | <span aria-label="terminal.ansiBrightRed color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#cb4b16;"></span> | `#cb4b16` | Solarized Light |
| `terminal.ansiBrightGreen` | <span aria-label="terminal.ansiBrightGreen color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#586e75;"></span> | `#586e75` | Solarized Light |
| `terminal.ansiBrightYellow` | <span aria-label="terminal.ansiBrightYellow color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#657b83;"></span> | `#657b83` | Solarized Light |
| `terminal.ansiBrightBlue` | <span aria-label="terminal.ansiBrightBlue color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#839496;"></span> | `#839496` | Solarized Light |
| `terminal.ansiBrightMagenta` | <span aria-label="terminal.ansiBrightMagenta color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#6c71c4;"></span> | `#6c71c4` | Solarized Light |
| `terminal.ansiBrightCyan` | <span aria-label="terminal.ansiBrightCyan color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#93a1a1;"></span> | `#93a1a1` | Solarized Light |
| `terminal.ansiBrightWhite` | <span aria-label="terminal.ansiBrightWhite color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#fdf6e3;"></span> | `#fdf6e3` | Solarized Light |
| `walkThrough.embeddedEditorBackground` | <span aria-label="walkThrough.embeddedEditorBackground color sample" style="display:inline-block;width:3rem;height:1rem;border:1px solid #8f876f;background:#00000014;"></span> | `#00000014` | Solarized Light |

## Workbench Colors

The VIC-20 palette is responsible for Theia workbench chrome:

| Workbench area | Main color ids |
| --- | --- |
| Activity bar | `activityBar.*` |
| Explorer, Outline, and side panels | `sideBar.*`, `sideBarSectionHeader.*`, `list.*` |
| Editor tabs | `tab.*`, `editorGroupHeader.tabsBorder` |
| Bottom panel | `panel.*`, `panelTitle.*` |
| Status bar | `statusBar.*`, `statusBarItem.*` |
| Inputs, menus, and pickers | `input.*`, `dropdown.*`, `menu.*`, `menubar.*`, `quickInput.*`, `pickerGroup.*` |
| Window borders | `window.*` |

Workbench colors live in `VIC20_THEME_COLORS`, which is merged into
`VIC20_THEME_JSON.colors` before the Solarized editor colors and the VIC-20
editor overrides. Use the Theia color id when styling Theia workbench surfaces
or defining theme colors, and use the `--cc-vic20-*` aliases only for Commodore
Commander-owned custom widgets and branded surfaces.

The generated `--cc-vic20-*` CSS variables are emitted through a Theia
`StylingParticipant`, not through global ad hoc overrides.

## File Icons

Explorer icons are intentionally not overridden by Commodore Commander. File
icons are controlled by Theia's standard file icon theme selection flow, including
the built-in Theia implementation and the available Visual Studio Code icon
themes such as Minimal, None, and Seti.

The Kick Assembler language contribution registers the language, file
associations, grammar, and language configuration only. It does not register a
custom language icon and it does not install a high-priority
`LabelProviderContribution`.
