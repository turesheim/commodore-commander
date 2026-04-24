export const SID_SCORE_LANGUAGE_ID = 'sidscore';
export const SID_SCORE_LANGUAGE_NAME = 'SIDScore';
export const SID_SCORE_SCOPE_NAME = 'source.sidscore';
export const SID_SCORE_EXTENSIONS = Object.freeze([
  '.sidscore'
]);

export const SID_SCORE_LANGUAGE_SPEC = Object.freeze({
  id: SID_SCORE_LANGUAGE_ID,
  name: SID_SCORE_LANGUAGE_NAME,
  scopeName: SID_SCORE_SCOPE_NAME,
  extensions: SID_SCORE_EXTENSIONS,
  grammarUrl: new URL(
    '../../syntaxes/sidscore.tmLanguage.json',
    import.meta.url
  ),
  languageConfigurationUrl: new URL(
    '../../syntaxes/sidscore.language-configuration.json',
    import.meta.url
  )
});
