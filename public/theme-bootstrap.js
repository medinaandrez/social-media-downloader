(() => {
  let preference = 'system';

  try {
    preference = window.localStorage.getItem('smd:theme-preference') || 'system';
  } catch {
    // Fall back to the device appearance when local storage is unavailable.
  }

  const followsSystem = preference === 'system';
  const dark = preference === 'dark'
    || (followsSystem && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const color = dark ? '#0D1110' : '#F7F9F8';

  document.documentElement.dataset.appTheme = dark ? 'dark' : 'light';
  document.documentElement.style.backgroundColor = color;

  const statusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (statusBar) {
    statusBar.setAttribute('content', dark ? 'black-translucent' : 'default');
  }

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute('content', color);
  }
})();
