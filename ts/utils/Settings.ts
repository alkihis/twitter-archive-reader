
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
   * Set to `true`, this will slow down archive reading and disable some performance tweaks
   * that use a lot of memory. Set this parameter to `true` if webpage crashes
   * when you load a very big archive, or if your system is memory-limited.
   * 
   * Defaults to `false`.
   */
  public LOW_RAM: boolean = false;
}();

export default Settings;
