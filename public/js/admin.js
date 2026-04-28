function renderAdminNav(activePage) {
  const nav = document.getElementById('admin-nav');
  if (!nav) return;
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line', href: '/admin/dashboard.html' },
    { id: 'bookings', label: 'Bookings', icon: 'fa-calendar-check', href: '/admin/bookings.html' },
    { id: 'checkin', label: 'Check-in', icon: 'fa-qrcode', href: '/admin/checkin.html' },
    { id: 'reports', label: 'Reports', icon: 'fa-file-invoice-dollar', href: '/admin/reports.html' },
  ];
  nav.innerHTML = items.map(item => `
    <a href="${item.href}" class="flex items-center gap-3 px-4 py-3 rounded-xl transition ${activePage === item.id ? 'bg-ocean-500 text-white' : 'text-gray-600 hover:bg-gray-100'}">
      <i class="fas ${item.icon} w-5 text-center"></i>
      <span class="font-medium">${item.label}</span>
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
