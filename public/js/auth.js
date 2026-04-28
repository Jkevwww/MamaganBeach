/**
 * Global Sign Out Handler
 * Attached to window to ensure it's accessible from any onclick attribute.
 */
window.handleSignOut = function() {
  console.log('Signing out...');
  
  // 1. Clear all authentication data from storage immediately
  localStorage.removeItem('token');
  localStorage.removeItem('rememberEmail');
  sessionStorage.clear();
  
  // 2. Reset local auth state
  if (typeof currentUser !== 'undefined') currentUser = null;
  if (typeof authInitialized !== 'undefined') authInitialized = false;
  if (typeof authPromise !== 'undefined') authPromise = null;

  // 3. Notify server to clear session (best-effort, non-blocking)
  if (typeof api !== 'undefined' && typeof api.post === 'function') {
    api.post('/auth/logout').catch(() => {});
  }

  // 4. Update UI if possible
  if (typeof updateAuthNav === 'function') {
    updateAuthNav(null);
  }

  // 5. Force redirect to home page
  // Use location.href and then replace to ensure the browser registers the intent
  window.location.href = '/';
};

// For backward compatibility if any script still expects 'logout'
window.logout = window.handleSignOut;

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
    const res = await api.get('/auth/me');
    if (res.success && res.user) {
      currentUser = res.user;
      updateAuthNav(currentUser);
      // Auto-redirect admin on auth pages to dashboard
      if (currentUser.role === 'admin' && /\/(login|register)\.html/.test(window.location.pathname)) {
        window.location.href = '/admin/dashboard.html';
      }
      authInitialized = true;
      return currentUser;
    } else {
      localStorage.removeItem('token');
      currentUser = null;
      updateAuthNav(null);
      authInitialized = true;
      return null;
    }
  } catch {
    localStorage.removeItem('token');
    currentUser = null;
    updateAuthNav(null);
    authInitialized = true;
    return null;
  }
}

function updateAuthNav(user) {
  const nav = document.getElementById('auth-nav');
  const mobileNav = document.getElementById('mobile-auth-nav');
  const isAdminPage = window.location.pathname.startsWith('/admin/');

  if (user) {
    const isAdmin = user.role === 'admin';
    
    if (isAdminPage) {
      const adminHeaderHtml = `
        <div class="flex items-center gap-3">
          <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.full_name) + '&background=0ea5e9&color=fff'}" class="w-8 h-8 rounded-full object-cover border border-gray-200">
          <span class="hidden sm:inline text-gray-700 font-medium">${user.full_name.split(' ')[0]} (Admin)</span>
        </div>
      `;
      if (nav) nav.innerHTML = adminHeaderHtml;
      return;
    }

    const desktopHtml = `
      <a href="/my-bookings.html" class="text-gray-600 hover:text-ocean-600 font-medium transition">My Bookings</a>
      ${isAdmin ? `<a href="/admin/dashboard.html" class="text-ocean-600 hover:text-ocean-700 font-medium transition"><i class="fas fa-cog mr-1"></i>Admin</a>` : ''}
      <div class="flex items-center gap-3">
        <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.full_name) + '&background=0ea5e9&color=fff'}" class="w-8 h-8 rounded-full object-cover border border-gray-200">
        <span class="hidden sm:inline text-gray-700 font-medium">${user.full_name.split(' ')[0]}</span>
        <button onclick="handleSignOut()" class="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition">Sign Out</button>
      </div>
    `;
    const mobileHtml = `
      <a href="/my-bookings.html" class="block text-gray-700 font-medium py-2">My Bookings</a>
      ${isAdmin ? `<a href="/admin/dashboard.html" class="block text-ocean-600 font-medium py-2"><i class="fas fa-cog mr-1"></i>Admin</a>` : ''}
      <button onclick="handleSignOut()" class="block w-full text-center px-4 py-2 text-red-600 font-medium border border-red-200 rounded-lg">Sign Out</button>
    `;
    if (nav) nav.innerHTML = desktopHtml;
    if (mobileNav) mobileNav.innerHTML = mobileHtml;
  } else {
    const desktopHtml = `
      <a href="/login.html" class="px-4 py-2 text-ocean-600 font-medium hover:bg-ocean-50 rounded-lg transition">Sign In</a>
      <a href="/register.html" class="px-4 py-2 bg-ocean-500 text-white font-medium rounded-lg hover:bg-ocean-600 transition">Get Started</a>
    `;
    const mobileHtml = `
      <a href="/login.html" class="block text-center px-4 py-2 text-ocean-600 font-medium border border-ocean-200 rounded-lg">Sign In</a>
      <a href="/register.html" class="block text-center px-4 py-2 bg-ocean-500 text-white font-medium rounded-lg">Get Started</a>
    `;
    if (nav) nav.innerHTML = desktopHtml;
    if (mobileNav) mobileNav.innerHTML = mobileHtml;
  }
}

function requireAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    return false;
  }
  return true;
}

function requireAdmin() {
  if (!requireAuth()) return false;
  if (currentUser) {
    if (currentUser.role !== 'admin') {
      if (typeof showToast === 'function') {
        showToast('Admin access required.', 'error');
      }
      window.location.href = '/';
      return false;
    }
    return true;
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
    handleSignOut();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadUser();
});
