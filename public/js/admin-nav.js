const AdminNav = {
  async checkAuth() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
      window.location.replace('/login.html');
      return false;
    }
    
    let user;
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      window.location.replace('/login.html');
      return false;
    }
    
    if (user.role !== 'admin') {
      window.location.replace('/login.html');
      return false;
    }
    
    try {
      const res = await fetch('/api/auth/verify', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (!data.success) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('/login.html');
        return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  },
  
  setActive() {
    const path = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && path.includes(href)) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  },
  
  loadAdminInfo() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    
    let user;
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      return;
    }
    
    const adminNameEl = document.getElementById('admin-name');
    const adminAvatarEl = document.getElementById('admin-avatar');
    const adminRoleEl = document.getElementById('admin-role');
    
    if (adminNameEl) {
      adminNameEl.textContent = user.full_name || 'Admin';
    }
    if (adminRoleEl) {
      adminRoleEl.textContent = user.role === 'admin' ? 'Executive' : 'Gold Member';
    }
    if (adminAvatarEl && user.avatar_url) {
      adminAvatarEl.src = user.avatar_url;
    }
  },
  
  async logout() {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace('/login.html');
    }
  },
  
  async loadNotifications() {
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token'),
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success && data.data) {
        const todayBookingsEl = document.getElementById('notif-today-bookings');
        const pendingPaymentsEl = document.getElementById('notif-pending-payments');
        
        if (todayBookingsEl && data.data.stats.today_bookings > 0) {
          todayBookingsEl.textContent = data.data.stats.today_bookings;
          todayBookingsEl.classList.remove('hidden');
        }
        
        if (pendingPaymentsEl && data.data.stats.pending_payments > 0) {
          pendingPaymentsEl.textContent = data.data.stats.pending_payments;
          pendingPaymentsEl.classList.remove('hidden');
        }
      }
    } catch (e) {
      console.error('Notifications load error:', e);
    }
  },
  
  async init() {
    const isAuth = await this.checkAuth();
    if (!isAuth) return;
    this.loadAdminInfo();
    this.setActive();
    this.loadNotifications();
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to terminate your session?')) {
          this.logout();
        }
      });
    }
    
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
      menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminNav.init();
});
