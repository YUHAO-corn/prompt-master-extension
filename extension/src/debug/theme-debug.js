/**
 * Theme Debug Script
 * This script is used to debug theme switching issues in the AetherFlow extension.
 * It can be imported in the browser console to check theme state.
 */

/**
 * Logs the current theme state
 */
function logThemeState() {
  console.group('AetherFlow Theme Debug');
  
  // Log localStorage theme preference
  const storedTheme = localStorage.getItem('aetherflow_theme_preference');
  console.log(`Stored theme preference: ${storedTheme || 'none (default light)'}`);
  
  // Log CSS classes on body and html
  console.log(`Body classes: ${document.body.className}`);
  console.log(`HTML classes: ${document.documentElement.className}`);
  
  // Check if dark mode media query matches
  const systemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  console.log(`System prefers dark mode: ${systemDarkMode}`);
  
  // Log CSS variables to check which theme is actually applied
  const computedStyles = getComputedStyle(document.documentElement);
  console.log('Applied CSS variables:');
  console.log(`--aetherflow-bg-main: ${computedStyles.getPropertyValue('--aetherflow-bg-main')}`);
  console.log(`--aetherflow-text-primary: ${computedStyles.getPropertyValue('--aetherflow-text-primary')}`);
  
  console.groupEnd();
}

/**
 * Force switches the theme
 * @param {string} theme - The theme to switch to: 'light', 'dark', or 'system'
 */
function forceThemeSwitch(theme) {
  if (!['light', 'dark', 'system'].includes(theme)) {
    console.error('Invalid theme. Use "light", "dark", or "system"');
    return;
  }
  
  // First store the theme in localStorage
  localStorage.setItem('aetherflow_theme_preference', theme);
  console.log(`Theme preference set to: ${theme}`);
  
  // Manually apply the appropriate classes
  document.body.classList.remove('system-theme', 'dark');
  document.documentElement.classList.remove('dark');
  
  if (theme === 'system') {
    document.body.classList.add('system-theme');
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark');
      document.documentElement.classList.add('dark');
    }
  } else if (theme === 'dark') {
    document.body.classList.add('dark');
    document.documentElement.classList.add('dark');
  }
  
  console.log(`Theme forced to: ${theme}`);
  console.log(`Body classes now: ${document.body.className}`);
  console.log(`HTML classes now: ${document.documentElement.className}`);
  
  // Attempt to trigger a re-render by forcing a style recalculation
  void document.body.offsetHeight;
}

// Export debug functions
window.aetherflow = window.aetherflow || {};
window.aetherflow.themeDebug = {
  logThemeState,
  forceThemeSwitch,
};

console.log('AetherFlow Theme Debug loaded. Use window.aetherflow.themeDebug.logThemeState() to check theme state'); 