
export const Settings = new class Settings {
  /**
   * Enable caching for internal data structures, like date indexes.
   * 
   * Unless you have a very low memory, you **should keep this setting to `true`**, 
   * because it enable many performance tweaks.
   * 
   * Defaults to `true`.
   */
  public ENABLE_CACHE: boolean = true;

  /**
   * On large files (> {LAZY_JSON_THRESHOLD} Mo), 
   * enable a lazy streaming-based JSON parsing method.
   * 
   * This cause a slower read process, but uses way less RAM than basic `JSON.parse()`.
   * 
   * By default, it's enabled.
   */
  public LAZY_JSON_PARSE: boolean = true; 

  /**
   * If {LAZY_JSON_PARSE} is enabled, the lazy JSON read will be triggered when
   * read file size exceed the specified number, in **megabytes**.
   * 
   * By default, threshold is set to `15` (MB).
   */
  public LAZY_JSON_THRESHOLD: number = 15;
  /**
   * When tweet is a retweet in GDPR archives, retweet data {retweeted_status} is
   * artificially created. If this parameter is set to `true` (default), content of {entities}
   * and {extended_entities} is refreshed to remove first mention (RT @...), fix indexes mis-placement,
   * and remove {full_text} property.
   */
  public TRIM_GDPR_RETWEET_ENTITIES = true;
}();

export default Settings;
