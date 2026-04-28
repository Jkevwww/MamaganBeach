/**
 * Mamagan Beach Resort — Reusable Toast Notification System
 * Usage: showToast(message, type, duration)
 *   type: 'success' | 'error' | 'warning' | 'info' (default: 'info')
 *   duration: milliseconds (default: 3000)
 */

(function () {
  const STYLES = `
    .toast-container {
      position: fixed;
      top: 1.5rem;
      right: 1.5rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
    }
    .toast-item {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-radius: 1rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      font-size: 0.875rem;
      font-weight: 500;
      color: #fff;
      min-width: 280px;
      max-width: 380px;
      animation: toastSlideIn 0.35s ease-out forwards;
      backdrop-filter: blur(8px);
    }
    .toast-item.toast-success { background: rgba(16, 185, 129, 0.95); border: 1px solid rgba(16,185,129,0.3); }
    .toast-item.toast-error   { background: rgba(239, 68, 68, 0.95); border: 1px solid rgba(239,68,68,0.3); }
    .toast-item.toast-warning { background: rgba(245, 158, 11, 0.95); border: 1px solid rgba(245,158,11,0.3); }
    .toast-item.toast-info    { background: rgba(14, 165, 233, 0.95); border: 1px solid rgba(14,165,233,0.3); }
    .toast-item.toast-exit {
      animation: toastSlideOut 0.3s ease-in forwards;
    }
    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateX(100%); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes toastSlideOut {
      from { opacity: 1; transform: translateX(0); }
      to   { opacity: 0; transform: translateX(100%); }
    }
    .toast-icon { font-size: 1.1rem; margin-top: 1px; flex-shrink: 0; }
    .toast-close {
      margin-left: auto;
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      opacity: 0.7;
      font-size: 1rem;
      line-height: 1;
      padding: 0;
    }
    .toast-close:hover { opacity: 1; }
  `;

  let container = null;

  function ensureContainer() {
    if (container) return;
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  function ensureStyles() {
    if (document.getElementById('toast-styles')) return;
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  const ICONS = {
    success: '<i class="fas fa-check-circle toast-icon"></i>',
    error:   '<i class="fas fa-times-circle toast-icon"></i>',
    warning: '<i class="fas fa-exclamation-triangle toast-icon"></i>',
    info:    '<i class="fas fa-info-circle toast-icon"></i>',
  };

  window.showToast = function (message, type = 'info', duration = 3000) {
    ensureStyles();
    ensureContainer();

    const el = document.createElement('div');
    el.className = `toast-item toast-${type}`;
    el.innerHTML = `
      ${ICONS[type] || ICONS.info}
      <span style="flex:1;line-height:1.4;">${escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    const closeBtn = el.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(el));

    container.appendChild(el);

    if (duration > 0) {
      setTimeout(() => removeToast(el), duration);
    }
  };

  function removeToast(el) {
    if (!el.parentNode) return;
    el.classList.add('toast-exit');
    el.addEventListener('animationend', () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();

