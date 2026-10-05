(function () {
  function injectPortalHeader() {
    if (document.getElementById('mqnet-portal-header-injected')) return;

    const currentScript = document.currentScript || document.querySelector('script[src*="portal-nav.js"]');
    const appName = (currentScript && currentScript.getAttribute('data-app-name')) || document.title || 'MQnet 앱';
    const appIcon = (currentScript && currentScript.getAttribute('data-app-icon')) || '⚡';
    const category = (currentScript && currentScript.getAttribute('data-category')) || 'SaaS Service';

    const header = document.createElement('div');
    header.id = 'mqnet-portal-header-injected';
    header.style.cssText = [
      'width: 100%',
      'background: rgba(9, 13, 22, 0.96)',
      'backdrop-filter: blur(12px)',
      '-webkit-backdrop-filter: blur(12px)',
      'border-bottom: 1px solid rgba(255, 255, 255, 0.08)',
      'padding: 0.5rem 1.25rem',
      'display: flex',
      'align-items: center',
      'justify-content: space-between',
      'box-sizing: border-box',
      'position: sticky',
      'top: 0',
      'left: 0',
      'z-index: 999999',
      'font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif',
      'box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3)'
    ].join(';');

    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.85rem;">
        <a href="/" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; border-radius: 8px; background: rgba(255, 255, 255, 0.08); color: #cbd5e1; text-decoration: none; font-size: 0.8rem; font-weight: 700; transition: all 0.2s ease;">
          <span>⬅</span>
          <span>MQnet 포털</span>
        </a>
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span style="font-size: 1.1rem;">${appIcon}</span>
          <span style="color: #ffffff; font-weight: 800; font-size: 0.95rem;">${appName}</span>
          <span style="font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 999px; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 700;">
            ${category}
          </span>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: #34d399; font-weight: 600;">
        <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
        <span>Online</span>
      </div>
    `;

    document.body.prepend(header);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPortalHeader);
  } else {
    injectPortalHeader();
  }
})();
