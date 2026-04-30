/**
 * Global Sign Out Handler
 * Attached to window to ensure it's accessible from any onclick attribute.
 */
window.handleSignOut = function() {
  // Add a confirmation step to ensure the action is intentional
  if (!confirm('Are you sure you want to terminate your session and sign out?')) {
    return;
  }

  console.log('Initiating sign-out...');
  
  // 1. Capture token before clearing for the API call
  const token = localStorage.getItem('token');

  // 2. Clear all local authentication data IMMEDIATELY (Synchronous)
  localStorage.removeItem('token');
  localStorage.removeItem('rememberEmail');
  sessionStorage.clear();

  // 3. Notify server (Non-blocking background call)
  // Use keepalive to ensure the request completes even if the page navigates
  if (token) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      },
      keepalive: true
    }).catch(err => console.error('Logout sync failed:', err));
  }

  // 4. Reset local state
  currentUser = null;
  authInitialized = false;
  authPromise = null;

  // 5. Show toast if possible
  if (typeof showToast === 'function') {
    showToast('Successfully logged out', 'success');
  }

  // 6. Redirect IMMEDIATELY to prevent UI hang
  // Use replace to prevent back-navigation
  setTimeout(() => {
    window.location.replace('/login.html');
  }, 300); // Slightly longer delay to ensure toast is visible and state is cleared
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

      const isAdminPage = window.location.pathname.startsWith('/admin/');
      
      // Auto-redirect admin on auth pages to dashboard
      if (currentUser.role === 'admin' && /\/(login|register)\.html/.test(window.location.pathname)) {
        window.location.href = '/admin/dashboard.html';
      }
      
      // Auto-redirect non-admin from admin pages
      if (isAdminPage && currentUser.role !== 'admin') {
        if (typeof showToast === 'function') {
          showToast('Admin access required.', 'error');
        }
        window.location.href = '/';
        return null;
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
          <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullName) + '&background=0c1b33&color=c5a059'}" class="w-10 h-10 rounded-2xl object-cover border border-lux-navy/5 shadow-sm">
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
        <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullName) + '&background=0c1b33&color=c5a059'}" class="w-10 h-10 rounded-2xl object-cover border border-lux-navy/5 shadow-sm">
        <button onclick="handleSignOut()" class="w-8 h-8 flex items-center justify-center text-lux-navy/30 hover:text-red-500 transition-colors"><i class="fas fa-sign-out-alt"></i></button>
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
    window.location.href = '/login.html?redirect=' + encodeURIComponent(currentPath);
    return false;
  }
  return true;
}

function requireAdmin() {
  if (!requireAuth()) return false;
  // If we have a token but currentUser is not yet loaded, we check the role once loaded
  if (currentUser) {
    if (currentUser.role !== 'admin') {
      if (typeof showToast === 'function') {
        showToast('Admin access required.', 'error');
      }
      setTimeout(() => { window.location.href = '/'; }, 500);
      return false;
    }
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
