/**
 * Asset Management System (Vanilla JS + Backend API)
 * Mamagan Beach Resort - Admin Panel
 */

let assets = [];
let editingId = null;
let currentImageSource = 'url'; // 'url' or 'file'
let currentResortId = null;

// --- State Management ---

async function loadResort() {
    try {
        const res = await api.get('/resorts');
        if (res.success && res.data.length > 0) {
            currentResortId = res.data[0].id;
        }
    } catch (err) {
        console.error('Failed to load resort info:', err);
    }
}

async function loadAssets() {
    try {
        const res = await api.get('/facilities');
        if (res.success) {
            assets = res.data;
            renderAssets();
        } else {
            showToast(res.message || 'Failed to load assets', 'error');
        }
    } catch (err) {
        console.error('Failed to load assets:', err);
        showToast('Connection error. Could not reach backend.', 'error');
    }
}

// --- CRUD Operations ---

async function handleAssetSubmit(e) {
    e.preventDefault();
    
    if (!currentResortId) await loadResort();
    if (!currentResortId) {
        showToast('System Error: No resort linked to this session.', 'error');
        return;
    }

    const form = e.target;
    const submitBtn = document.getElementById('submit-btn');
    const imageFile = document.getElementById('facility-image-file');
    const hasFile = currentImageSource === 'file' && imageFile && imageFile.files && imageFile.files.length > 0;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Processing...</span><i class="fas fa-spinner fa-spin"></i>';

    let res;
    try {
        if (hasFile) {
            // Use FormData for file upload
            const fd = new FormData(form);
            fd.append('resort_id', currentResortId);
            
            // For file uploads, we need to bypass api.js and use fetch directly 
            // to let the browser set the boundary for multipart/form-data
            const endpoint = editingId ? `/api/facilities/${editingId}` : '/api/facilities';
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            res = await fetch(endpoint, {
                method: editingId ? 'PUT' : 'POST',
                headers,
                body: fd,
            }).then(r => r.json());
        } else {
            // Standard JSON submit
            const formData = new FormData(form);
            const data = {
                name: formData.get('name'),
                type: formData.get('type'),
                status: formData.get('status'),
                base_price: formData.get('base_price'),
                capacity: formData.get('capacity'),
                total_units: formData.get('total_units'),
                description: formData.get('description'),
                images_link: formData.get('images_link'),
                resort_id: currentResortId
            };
            
            // Remove images_link if empty
            if (!data.images_link) delete data.images_link;
            
            if (editingId) {
                res = await api.put(`/facilities/${editingId}`, data);
            } else {
                res = await api.post('/facilities', data);
            }
        }

        if (res.success) {
            showToast(editingId ? 'Asset updated successfully' : 'Asset registered successfully', 'success');
            closeModal('facility-modal');
            loadAssets();
        } else {
            showToast(res.message || 'Action failed', 'error');
        }
    } catch (err) {
        console.error('Submit error:', err);
        showToast('Connection error. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>${editingId ? 'Update Asset' : 'Save Asset'}</span><i class="fas fa-${editingId ? 'save' : 'save'} group-hover:scale-110 transition-transform"></i>`;
    }
}

async function deleteAsset(id) {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    if (confirm(`Are you sure you want to decommission "${asset.name}"? This action cannot be undone.`)) {
        try {
            const res = await api.delete(`/facilities/${id}`);
            if (res.success) {
                showToast('Asset removed successfully', 'success');
                loadAssets();
            } else {
                showToast(res.message || 'Failed to remove asset', 'error');
            }
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Connection error', 'error');
        }
    }
}

// --- UI Rendering ---

function renderAssets() {
    const container = document.getElementById('facilities-container');
    if (!container) return;

    if (assets.length === 0) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-20 text-center space-y-4 fade-in">
                <div class="w-24 h-24 bg-lux-navy/5 rounded-full flex items-center justify-center">
                    <i class="fas fa-box-open text-3xl text-lux-navy/10"></i>
                </div>
                <div class="space-y-1">
                    <h3 class="luxury-heading text-xl font-bold text-lux-navy/40">No assets registered yet</h3>
                    <p class="text-[10px] font-bold text-lux-navy/20 uppercase tracking-widest">Connect to backend to synchronize inventory</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = assets.map(asset => {
        // Handle images array from backend
        const imageUrl = (asset.images && asset.images.length > 0) 
            ? asset.images[0] 
            : '/images/placeholders/asset-placeholder.jpg';

        return `
        <div class="bg-white rounded-[2.5rem] overflow-hidden premium-shadow border border-lux-navy/5 card-hover group fade-in">
            <div class="h-48 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 relative" 
                 style="background-image: url('${imageUrl}')">
                <div class="absolute top-6 left-6">
                    <span class="px-4 py-1.5 bg-white/90 backdrop-blur text-lux-navy text-[8px] font-black uppercase tracking-[0.2em] rounded-full">${asset.type}</span>
                </div>
                <div class="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="openEditModal('${asset.id}')" class="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-lux-navy hover:text-lux-gold transition-all shadow-lg">
                        <i class="fas fa-pencil-alt text-[10px]"></i>
                    </button>
                    <button onclick="deleteAsset('${asset.id}')" class="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-red-500 hover:bg-red-50 transition-all shadow-lg">
                        <i class="fas fa-trash text-[10px]"></i>
                    </button>
                </div>
                ${!asset.is_active ? `
                    <div class="absolute inset-0 bg-lux-navy/60 flex items-center justify-center">
                        <span class="text-white text-[10px] font-black uppercase tracking-widest border border-white/20 px-4 py-2 rounded-full">Inactive</span>
                    </div>
                ` : ''}
            </div>
            <div class="p-8">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="luxury-heading font-bold text-xl text-lux-navy">${asset.name}</h3>
                        <div class="flex gap-2 mt-1">
                            <span class="text-[8px] font-black uppercase tracking-widest text-lux-navy/30">${asset.status || 'Verified'}</span>
                            <span class="text-[8px] font-black uppercase tracking-widest text-lux-gold">• ${asset.capacity} Guests</span>
                            <span class="text-[8px] font-black uppercase tracking-widest text-lux-navy/30">• ${asset.total_units} Units</span>
                        </div>
                    </div>
                    <span class="text-xl font-black text-lux-gold">₱${Number(asset.base_price).toLocaleString()}</span>
                </div>
                <p class="text-xs text-lux-navy/60 leading-relaxed line-clamp-2 mb-6 font-medium">${asset.description || 'No description provided.'}</p>
                <div class="pt-6 border-t border-lux-navy/5 flex justify-between items-center">
                    <span class="text-[8px] font-black uppercase tracking-widest text-lux-navy/20 italic">ID: ${asset.id.substring(0, 8)}</span>
                    <button onclick="openEditModal('${asset.id}')" class="text-[8px] font-black uppercase tracking-widest text-lux-gold hover:text-lux-navy transition-colors">Modify <i class="fas fa-chevron-right ml-1"></i></button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// --- Modal Logic ---

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.body.style.overflow = 'auto';
    resetForm();
}

function toggleImageSource(source) {
    currentImageSource = source;
    const urlSource = document.getElementById('url-source');
    const fileSource = document.getElementById('file-source');
    const btnUrl = document.getElementById('btn-url');
    const btnFile = document.getElementById('btn-file');

    if (source === 'url') {
        urlSource.classList.remove('hidden');
        fileSource.classList.add('hidden');
        btnUrl.classList.add('bg-lux-navy', 'text-white');
        btnUrl.classList.remove('text-lux-navy/40');
        btnFile.classList.remove('bg-lux-navy', 'text-white');
        btnFile.classList.add('text-lux-navy/40');
    } else {
        urlSource.classList.add('hidden');
        fileSource.classList.remove('hidden');
        btnFile.classList.add('bg-lux-navy', 'text-white');
        btnFile.classList.remove('text-lux-navy/40');
        btnUrl.classList.remove('bg-lux-navy', 'text-white');
        btnUrl.classList.add('text-lux-navy/40');
    }
}

function resetForm() {
    const form = document.getElementById('facility-form');
    form.reset();
    editingId = null;
    document.querySelector('#facility-modal h3').textContent = 'Asset Registration';
    document.querySelector('#submit-btn span').textContent = 'Save Asset';
    
    const preview = document.getElementById('facility-image-preview');
    preview.style.backgroundImage = 'none';
    preview.innerHTML = '<span class="text-[10px] font-bold text-lux-navy/20">No image</span>';
    
    toggleImageSource('url');
}

async function openEditModal(id) {
    try {
        const res = await api.get(`/facilities/${id}`);
        if (!res.success) {
            showToast('Unable to fetch asset details', 'error');
            return;
        }

        const asset = res.data;
        editingId = id;
        const form = document.getElementById('facility-form');
        
        form.elements['name'].value = asset.name;
        form.elements['type'].value = asset.type;
        form.elements['status'].value = asset.status || 'Active';
        form.elements['base_price'].value = asset.base_price;
        form.elements['capacity'].value = asset.capacity || 1;
        form.elements['total_units'].value = asset.total_units || 1;
        form.elements['description'].value = asset.description || '';
        
        const firstImg = (asset.images && asset.images.length > 0) ? asset.images[0] : null;
        
        if (firstImg && firstImg.startsWith('http')) {
            toggleImageSource('url');
            form.elements['images_link'].value = firstImg;
            updatePreview(firstImg);
        } else if (firstImg) {
            toggleImageSource('url'); // Show as URL even if it's a local path for editing purposes
            form.elements['images_link'].value = firstImg;
            updatePreview(firstImg);
        }

        document.querySelector('#facility-modal h3').textContent = 'Modify Asset';
        document.querySelector('#submit-btn span').textContent = 'Update Asset';
        openModal('facility-modal');
    } catch (err) {
        console.error('Edit load error:', err);
        showToast('Error loading details', 'error');
    }
}

// --- Image Handling ---

function updatePreview(src) {
    const preview = document.getElementById('facility-image-preview');
    if (src) {
        preview.style.backgroundImage = `url('${src}')`;
        preview.innerHTML = '';
    } else {
        preview.style.backgroundImage = 'none';
        preview.innerHTML = '<span class="text-[10px] font-bold text-lux-navy/20">No image</span>';
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            updatePreview(event.target.result);
        };
        reader.readAsDataURL(file);
    }
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    if (typeof requireAdmin === 'function' && !requireAdmin()) return;
    
    if (typeof renderAdminNav === 'function') {
        renderAdminNav('facilities');
    }

    await loadResort();
    await loadAssets();

    const form = document.getElementById('facility-form');
    const imageLink = document.getElementById('facility-image-link');
    const imageFile = document.getElementById('facility-image-file');

    if (imageLink) {
        imageLink.addEventListener('input', (e) => {
            if (currentImageSource === 'url') {
                updatePreview(e.target.value.trim());
            }
        });
    }

    if (imageFile) {
        imageFile.addEventListener('change', handleFileSelect);
    }

    if (form) {
        form.addEventListener('submit', handleAssetSubmit);
    }
});

// Expose functions to global scope
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleImageSource = toggleImageSource;
window.openEditModal = openEditModal;
window.deleteAsset = deleteAsset;
