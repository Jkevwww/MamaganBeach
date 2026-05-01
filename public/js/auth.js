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
      
      // Auto-redirect non-admin from admin pages
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
    } else {
      console.error('Session validation failed:', res.message);
      _clearAuthAndRedirect();
      return null;
    }
  } catch (err) {
    console.error('Auth check error:', err);
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
    const fullName = user.full_name || 'Valued Guest';
    const firstName = fullName.split(' ')[0];
    
    if (isAdminPage) {
      const adminHeaderHtml = `
        <div class="flex items-center gap-4">
          <div class="text-right hidden sm:block">
            <p class="text-[10px] font-black uppercase tracking-widest text-lux-navy">${fullName}</p>
            <p class="text-[8px] font-bold uppercase tracking-widest text-lux-gold">Executive Access</p>
          </div>
          <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullName) + '&background=0c1b33&color=c5a059'}" class="w-10 h-10 rounded-2xl object-cover border border-lux-navy/5 shadow-sm" alt="User profile">
        </div>
      `;
      if (nav) nav.innerHTML = adminHeaderHtml;
      return;
    }

    const desktopHtml = `
      <a href="/my-bookings.html" class="text-lux-navy/70 hover:text-lux-gold font-bold transition-colors uppercase tracking-widest text-[10px]">My Bookings</a>
      ${isAdmin ? `<a href="/admin/dashboard.html" class="px-4 py-2 bg-lux-navy text-lux-gold text-[10px] font-black uppercase tracking-widest rounded-full hover:shadow-lg transition-all">Admin Panel</a>` : ''}
      <div class="flex items-center gap-4 pl-4 border-l border-lux-navy/5">
        <div class="text-right hidden sm:block">
          <p class="text-[10px] font-black uppercase tracking-widest text-lux-navy">${firstName}</p>
          <p class="text-[8px] font-bold uppercase tracking-widest text-lux-gold">Gold Member</p>
        </div>
        <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullName) + '&background=0c1b33&color=c5a059'}" class="w-10 h-10 rounded-2xl object-cover border border-lux-navy/5 shadow-sm" alt="User profile">
        <button id="logout-btn" title="Sign Out" aria-label="Sign Out" class="w-8 h-8 flex items-center justify-center text-lux-navy/30 hover:text-red-500 transition-colors">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    `;
    if (nav) nav.innerHTML = desktopHtml;
  } else {
    const desktopHtml = `
      <a href="/login.html" class="text-lux-navy/70 hover:text-lux-gold font-bold transition-colors uppercase tracking-widest text-[10px]">Sign In</a>
      <a href="/register.html" class="px-8 py-3 bg-lux-navy text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-lux-gold hover:shadow-xl transition-all">Join the Club</a>
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
