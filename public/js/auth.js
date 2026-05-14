async function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
    return;
  }
  return response;
}

/**
 * Standardized Logout Function
 */
async function logout() {
  // Add a confirmation step to ensure the action is intentional
  if (!confirm('Are you sure you want to log out and terminate your session?')) {
    return;
  }

  console.log('Initiating sign-out...');
  
  // 1. Capture token before clearing for the API call
  const token = localStorage.getItem('token');

  // 2. Clear ALL local authentication data IMMEDIATELY (Synchronous)
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('rememberEmail');
  sessionStorage.clear();

  // 3. Notify server (Non-blocking background call)
  try {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        keepalive: true
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // 4. Reset local state
    currentUser = null;
    authInitialized = false;
    authPromise = null;

    // 5. Show toast if possible
    if (typeof showToast === 'function') {
      showToast('Successfully logged out', 'success');
    }

    // 6. Redirect IMMEDIATELY
    setTimeout(() => {
      window.location.replace('/login.html');
    }, 300);
  }
}

// Aliases for compatibility
window.logout = logout;
window.handleSignOut = logout;

/**
 * Global event listener for logout buttons
 */
document.addEventListener('click', (e) => {
  const logoutBtn = e.target.closest('#logout-btn') || e.target.closest('.logout-btn');
  if (logoutBtn) {
    e.preventDefault();
    logout();
  }
});

let currentUser = null;
let authInitialized = false;
let authPromise = null;

/**
 * Load current user from token.
 */
async function loadUser(force = false) {
  if (authInitialized && !force) return currentUser;
  if (authPromise && !force) return authPromise;

  authPromise = _loadUserInternal();
  return authPromise;
}

async function _loadUserInternal() {
  const token = localStorage.getItem('token');
  if (!token) {
    authInitialized = true;
    updateAuthNav(null);
    return null;
  }
  try {
    // Use the verify endpoint for real-time validation if needed, or just /me
    const res = await api.get('/auth/me');
    if (res.success && res.user) {
      currentUser = res.user;
      localStorage.setItem('user', JSON.stringify(currentUser)); // Sync storage
      updateAuthNav(currentUser);

      const isAdminPage = window.location.pathname.startsWith('/admin/');
      
      // Auto-redirect admin on auth pages to dashboard
      if (currentUser.role === 'admin' && /\/(login|register)\.html/.test(window.location.pathname)) {
        window.location.replace('/admin/dashboard.html');
      }
      
      // Auto-redirect non-admin from admin pages (only when we have a user object)
      if (isAdminPage && currentUser.role !== 'admin') {
        console.warn('Unauthorized access attempt to admin page by:', currentUser.email);
        if (typeof showToast === 'function') {
          showToast('Admin access required.', 'error');
        }
        window.location.replace('/');
        return null;
      }

      authInitialized = true;
      return currentUser;
    }

    // If /auth/me responded but didn't validate, avoid harsh redirects on admin pages
    // during initial bootstrap (prevents breaking /admin/create-facility.html).
    console.error('Session validation failed:', res && res.message);
    if (isAdminPage && (window.location.pathname === '/admin/create-facility.html' || window.location.pathname === '/admin/facilities.html')) {
      // Keep the page reachable; admin.js/form submit will enforce permissions with API calls.
      authInitialized = true;
      return null;
    }

    _clearAuthAndRedirect();
    return null;
  } catch (err) {
    console.error('Auth check error:', err);
    if (window.location.pathname.startsWith('/admin/') && (window.location.pathname === '/admin/create-facility.html' || window.location.pathname === '/admin/facilities.html')) {
      authInitialized = true;
      return null;
    }
    _clearAuthAndRedirect();
    return null;
  }
}


function _clearAuthAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.clear();
  currentUser = null;
  updateAuthNav(null);
  authInitialized = true;
  
  if (window.location.pathname.startsWith('/admin/') || window.location.pathname === '/my-bookings.html') {
    window.location.replace('/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
  }
}

function updateAuthNav(user) {
  const nav = document.getElementById('auth-nav');
  const isAdminPage = window.location.pathname.startsWith('/admin/');

  if (user) {
    const isAdmin = user.role === 'admin';
    const fullName = user.full_name || 'User';
    const firstName = fullName.split(' ')[0];
    const avatarSrc = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0891b2&color=ffffff`;

    if (isAdminPage) {
      const adminHeaderHtml = `
        <a href="/admin/settings.html" class="flex items-center gap-3 hover:bg-gray-50 rounded-xl px-3 py-2 transition-colors group">
          <div class="text-right hidden sm:block">
            <p class="text-xs font-semibold text-gray-800">${fullName}</p>
            <p class="text-[10px] text-primary-600 font-medium">Administrator</p>
          </div>
          <img src="${avatarSrc}" class="w-9 h-9 rounded-xl object-cover border-2 border-gray-100 shadow-sm group-hover:border-primary-200 transition-colors" alt="Profile">
        </a>
      `;
      if (nav) nav.innerHTML = adminHeaderHtml;
      return;
    }

    const desktopHtml = `
      <a href="/my-bookings.html" class="text-gray-600 hover:text-primary-600 font-medium transition-colors text-sm">My Bookings</a>
      ${isAdmin ? `<a href="/admin/dashboard.html" class="px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-all">Admin Panel</a>` : ''}
      <div class="flex items-center gap-3 pl-4 border-l border-gray-200">
        <a href="/settings.html" class="flex items-center gap-2 hover:bg-gray-50 rounded-xl px-2 py-1.5 transition-colors group" title="Account Settings">
          <img src="${avatarSrc}" class="w-8 h-8 rounded-lg object-cover border border-gray-200 group-hover:border-primary-300 transition-colors" alt="Profile">
          <span class="text-xs font-medium text-gray-700 hidden sm:block">${firstName}</span>
        </a>
        <button id="logout-btn" title="Sign Out" aria-label="Sign Out" class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
          <i class="fas fa-sign-out-alt text-sm"></i>
        </button>
      </div>
    `;
    if (nav) nav.innerHTML = desktopHtml;
  } else {
    const desktopHtml = `
      <a href="/login.html" class="text-gray-600 hover:text-primary-600 font-medium transition-colors text-sm">Sign In</a>
      <a href="/register.html" class="px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-all shadow-sm">Get Started</a>
    `;
    if (nav) nav.innerHTML = desktopHtml;
  }
}

function requireAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    const currentPath = window.location.pathname + window.location.search;
    window.location.replace('/login.html?redirect=' + encodeURIComponent(currentPath));
    return false;
  }
  return true;
}

function requireAdmin() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  let user = null;
  
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    console.error('Session data corrupted');
  }

  if (!token || !user || user.role !== 'admin') {
    if (typeof showToast === 'function' && user) {
      showToast('Administrative privileges required.', 'error');
    }
    const currentPath = window.location.pathname + window.location.search;
    window.location.replace('/login.html?redirect=' + encodeURIComponent(currentPath));
    return false;
  }
  
  // If we have a local admin user, we still check the live status if currentUser is loaded
  if (currentUser && currentUser.role !== 'admin') {
    window.location.replace('/');
    return false;
  }
  
  return true;
}

function handleAuthError(response) {
  if (response && response.message) {
    if (typeof showToast === 'function') {
      showToast(response.message, 'error');
    } else {
      alert(response.message);
    }
  }
  if (response && (response.message === 'Invalid or expired token.' || response.message === 'Access denied. No token provided.')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    window.location.replace('/login.html');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadUser();
  
  // Prevent back button after logout on sensitive pages
  if (window.location.pathname.startsWith('/admin/')) {
    history.pushState(null, null, location.href);
    window.onpopstate = function() {
      history.pushState(null, null, location.href);
    };
  }
});
