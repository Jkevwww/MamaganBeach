function renderAdminNav(activePage) {
  const nav = document.getElementById('admin-nav');
  if (!nav) return;
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie', href: '/admin/dashboard.html' },
    { id: 'facilities', label: 'Manage Facilities', icon: 'fa-hotel', href: '/admin/facilities.html' },
    { id: 'rates', label: 'Rates & Promos', icon: 'fa-tags', href: '/admin/rates.html' },
    { id: 'calendar', label: 'Block Dates', icon: 'fa-calendar-lock', href: '/admin/calendar.html' },
    { id: 'bookings', label: 'All Bookings', icon: 'fa-book', href: '/admin/bookings.html' },
    { id: 'checkin', label: 'Confirm Arrival', icon: 'fa-qrcode', href: '/admin/checkin.html' },
    { id: 'reports', label: 'Revenue Report', icon: 'fa-file-invoice-dollar', href: '/admin/reports.html' },
    { id: 'clients', label: 'Client Records', icon: 'fa-users-gear', href: '/admin/clients.html' },
    { id: 'logs', label: 'System Logs', icon: 'fa-list-ul', href: '/admin/logs.html' },
  ];
  nav.innerHTML = items.map(item => `
    <a href="${item.href}" class="flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${activePage === item.id ? 'bg-lux-navy text-lux-gold shadow-lg shadow-lux-navy/20' : 'text-lux-navy/50 hover:bg-lux-navy/5 hover:text-lux-navy'}">
      <i class="fas ${item.icon} w-5 text-center text-sm ${activePage === item.id ? 'text-lux-gold' : 'text-lux-navy/20 group-hover:text-lux-gold'}"></i>
      <span class="text-[10px] font-black uppercase tracking-[0.2em]">${item.label}</span>
    </a>
  `).join('');
}

async function loadAdminUser() {
  const user = await loadUser();
  if (!user) {
    // loadUser already redirected to login if no token
    return null;
  }
  if (user.role !== 'admin') {
    if (typeof showToast === 'function') {
      showToast('Admin access required.', 'error');
    }
    window.location.href = '/';
    return null;
  }
  return user;
}
