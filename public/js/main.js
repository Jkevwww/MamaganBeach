// Global UI helpers for MamaganBeach
(function(){
  // Format ISO date string to readable format
  window.formatDate = function(dateStr, opts){
    if(!dateStr) return '-';
    try{
      const d = new Date(dateStr);
      if(isNaN(d)) return dateStr;
      const options = Object.assign({month:'short', day:'numeric', year:'numeric'}, opts||{});
      return d.toLocaleDateString('en-US', options);
    }catch(e){return dateStr}
  }

  // Mobile nav toggle: clone desktop links into mobile menu
  function ensureMobileMenu(){
    if(document.getElementById('mobile-menu')) return;
    const nav = document.querySelector('nav');
    if(!nav) return;
    const desktopNav = nav.querySelectorAll('a');
    const menu = document.createElement('div');
    menu.id = 'mobile-menu';
    menu.className = 'fixed inset-x-4 top-20 bg-white rounded-xl shadow-lg p-4 z-50 md:hidden';
    menu.style.display = 'none';

    const list = document.createElement('div');
    list.className = 'flex flex-col gap-3';

    desktopNav.forEach(a => {
      const item = document.createElement('a');
      item.href = a.href;
      item.className = 'px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50';
      item.textContent = a.textContent.trim() || a.getAttribute('aria-label') || a.getAttribute('title') || 'Link';
      list.appendChild(item);
    });

    // Add auth nav placeholder if empty
    if(list.children.length === 0){
      const placeholder = document.createElement('div');
      placeholder.className = 'text-sm text-gray-500';
      placeholder.textContent = 'No links available';
      list.appendChild(placeholder);
    }

    // Close button (accessible)
    const close = document.createElement('button');
    close.className = 'absolute top-3 right-4 text-gray-500 hover:text-gray-700';
    close.setAttribute('aria-label', 'Close menu');
    close.type = 'button';
    close.innerHTML = '✕';
    close.addEventListener('click', ()=>{ 
      menu.style.display = 'none'; 
      const toggleBtn = document.querySelector('button[aria-label="Toggle menu"]');
      if(toggleBtn) toggleBtn.setAttribute('aria-expanded','false');
      toggleBtn && toggleBtn.focus();
    });
    menu.appendChild(close);

    menu.appendChild(list);
    document.body.appendChild(menu);
  }

  function initHamburger(){
    ensureMobileMenu();
    const btn = document.querySelector('button[aria-label="Toggle menu"]');
    if(!btn) return;
    // Ensure accessibility attributes
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'mobile-menu');

    btn.addEventListener('click', (e)=>{
      const menu = document.getElementById('mobile-menu');
      if(!menu) return;
      const opened = menu.style.display === 'block';
      menu.style.display = opened ? 'none' : 'block';
      btn.setAttribute('aria-expanded', String(!opened));
      if(!opened){
        // focus first link in menu for keyboard users
        const first = menu.querySelector('a');
        if(first) first.focus();
      } else {
        btn.focus();
      }
    });

    // Close when clicking outside
    document.addEventListener('click', (e)=>{
      const menu = document.getElementById('mobile-menu');
      if(!menu) return;
      if(menu.style.display !== 'block') return;
      if(e.target === btn || menu.contains(e.target)) return;
      menu.style.display = 'none';
      btn.setAttribute('aria-expanded','false');
    });
  }

  // Clear search button visibility
  function initClearSearch(){
    document.querySelectorAll('#facility-search').forEach(input => {
      const clearBtn = document.getElementById('clear-search');
      if(!clearBtn) return;
      function toggle(){ clearBtn.classList.toggle('hidden', !input.value); }
      input.addEventListener('input', toggle);
      clearBtn.addEventListener('click', ()=>{ input.value = ''; input.dispatchEvent(new Event('input')); input.focus(); });
      toggle();
    });
  }

  // Filter buttons behaviour
  function initFilters(){
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        // add aria-pressed for accessibility
        document.querySelectorAll('.filter-btn').forEach(b=>b.setAttribute('aria-pressed','false'));
        btn.setAttribute('aria-pressed','true');
      });
    });
  }

  // Enhance method buttons to toggle selection and enable pay button
  function initPaymentMethods(){
    document.querySelectorAll('.method-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.method-btn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        // enable pay button if present
        const pay = document.getElementById('pay-btn');
        if(pay) pay.disabled = false;
        // Show card form if card selected
        const cardForm = document.getElementById('card-form');
        if(cardForm){
          cardForm.classList.toggle('hidden', !btn.id.includes('card'));
        }
      });
    });
  }

  // Utility: format all date placeholders with data-date attribute
  function formatDatePlaceholders(){
    document.querySelectorAll('[data-date]').forEach(el=>{
      const v = el.getAttribute('data-date');
      el.textContent = window.formatDate(v);
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    initHamburger();
    initClearSearch();
    initFilters();
    initPaymentMethods();
    formatDatePlaceholders();
  });
})();
