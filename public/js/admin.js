function renderAdminNav(activePage) {
  const nav = document.getElementById('admin-nav');
  if (!nav) return;
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie', href: '/admin/dashboard.html' },
    { id: 'facilities', label: 'Facilities', icon: 'fa-hotel', href: '/admin/facilities.html' },
    { id: 'rates', label: 'Rates & Promos', icon: 'fa-tags', href: '/admin/rates.html' },
    { id: 'calendar', label: 'Calendar', icon: 'fa-calendar-lock', href: '/admin/calendar.html' },
    { id: 'bookings', label: 'Bookings', icon: 'fa-book', href: '/admin/bookings.html' },
    { id: 'checkin', label: 'Check-in', icon: 'fa-qrcode', href: '/admin/checkin.html' },
    { id: 'reports', label: 'Reports', icon: 'fa-file-invoice-dollar', href: '/admin/reports.html' },
    { id: 'clients', label: 'Clients', icon: 'fa-users', href: '/admin/clients.html' },
    { id: 'logs', label: 'System Logs', icon: 'fa-list-ul', href: '/admin/logs.html' },
  ];
  nav.innerHTML = items.map(item => `
    <a href="${item.href}" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activePage === item.id ? 'active' : ''}">
      <i class="fas ${item.icon} w-5 text-center text-sm"></i>
      <span class="text-sm font-medium">${item.label}</span>
    </a>
  `).join('');
}