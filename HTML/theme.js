// theme.js
const THEME_KEY = 'diary-theme';
const DEFAULT_THEME = 'parchment';

// Map themes to their --accent-1 colors from themes.css
const themeAccentColors = {
  'parchment': '#e74c3c',
  'espresso': '#ff7043',
  'ocean': '#0072ff',
  'forest': '#2e7d32',
  'sakura': '#e91e63'
};

export function setTheme(themeName) {
  // Set the theme attribute
  document.documentElement.setAttribute('data-theme', themeName);
  // Update --accent-1 to match the selected theme
  const accentColor = themeAccentColors[themeName] || themeAccentColors[DEFAULT_THEME];
  document.documentElement.style.setProperty('--accent-1', accentColor);
  // Persist theme selection
  try {
    localStorage.setItem(THEME_KEY, themeName);
  } catch (_) {}
}

export function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
  } catch (_) {
    return DEFAULT_THEME;
  }
}

// Apply on first paint
(function initTheme() {
  const saved = getTheme();
  setTheme(saved); // Apply theme and corresponding --accent-1
})();