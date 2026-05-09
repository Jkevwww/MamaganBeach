/**
 * Asset Management System (Vanilla JS + localStorage)
 * Mamagan Beach Resort - Admin Panel
 */

let assets = [];
let editingId = null;
let currentImageSource = 'url'; // 'url' or 'file'

// --- State Management ---

function loadFromStorage() {
    const data = localStorage.getItem('mamagan_assets');
    assets = data ? JSON.parse(data) : [];
    renderAssets();
}

function saveToStorage() {
    localStorage.setItem('mamagan_assets', JSON.stringify(assets));
    renderAssets();
}

// --- CRUD Operations ---

function createAsset(assetData) {
    const newAsset = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        ...assetData
    };
    assets.push(newAsset);
    saveToStorage();
    showToast('Asset registered successfully', 'success');
}

function updateAsset(id, updatedData) {
    const index = assets.findIndex(a => a.id === id);
    if (index !== -1) {
        assets[index] = { ...assets[index], ...updatedData, updatedAt: new Date().toISOString() };
        saveToStorage();
        showToast('Asset updated successfully', 'success');
    }
}

function deleteAsset(id) {
    const asset = assets.find(a => a.id === id);
    if (confirm(`Are you sure you want to delete "${asset.name}"?`)) {
        assets = assets.filter(a => a.id !== id);
        saveToStorage();
        showToast('Asset removed', 'success');
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
                    <p class="text-[10px] font-bold text-lux-navy/20 uppercase tracking-widest">Start by adding your first resort facility</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = assets.map(asset => `
        <div class="bg-white rounded-[2.5rem] overflow-hidden premium-shadow border border-lux-navy/5 card-hover group fade-in">
            <div class="h-48 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 relative" 
                 style="background-image: url('${asset.image || '/images/placeholders/asset-placeholder.jpg'}')">
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
                ${asset.status !== 'Active' ? `
                    <div class="absolute inset-0 bg-lux-navy/60 flex items-center justify-center">
                        <span class="text-white text-[10px] font-black uppercase tracking-widest border border-white/20 px-4 py-2 rounded-full">${asset.status}</span>
                    </div>
                ` : ''}
            </div>
            <div class="p-8">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="luxury-heading font-bold text-xl text-lux-navy">${asset.name}</h3>
                        <span class="text-[8px] font-black uppercase tracking-widest text-lux-navy/30">${asset.status}</span>
                    </div>
                    <span class="text-xl font-black text-lux-gold">₱${Number(asset.base_price).toLocaleString()}</span>
                </div>
                <p class="text-xs text-lux-navy/60 leading-relaxed line-clamp-2 mb-6 font-medium">${asset.description || 'No description provided.'}</p>
                <div class="pt-6 border-t border-lux-navy/5 flex justify-between items-center">
                    <span class="text-[8px] font-black uppercase tracking-widest text-lux-navy/20 italic">ID: ${asset.id.substring(0, 8)}</span>
                    <button onclick="openEditModal('${asset.id}')" class="text-[8px] font-black uppercase tracking-widest text-lux-gold hover:text-lux-navy transition-colors">Details <i class="fas fa-chevron-right ml-1"></i></button>
                </div>
            </div>
        </div>
    `).join('');
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

function openEditModal(id) {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    editingId = id;
    const form = document.getElementById('facility-form');
    
    form.elements['name'].value = asset.name;
    form.elements['type'].value = asset.type;
    form.elements['status'].value = asset.status;
    form.elements['base_price'].value = asset.base_price;
    form.elements['description'].value = asset.description;
    
    if (asset.image && asset.image.startsWith('http')) {
        toggleImageSource('url');
        form.elements['images_link'].value = asset.image;
    } else if (asset.image) {
        toggleImageSource('file');
    }

    updatePreview(asset.image);

    document.querySelector('#facility-modal h3').textContent = 'Modify Asset';
    document.querySelector('#submit-btn span').textContent = 'Update Asset';
    openModal('facility-modal');
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

document.addEventListener('DOMContentLoaded', () => {
    // Shared Admin Nav Check (from your context)
    if (typeof requireAdmin === 'function' && !requireAdmin()) {
        window.location.href = '/login.html';
        return;
    }
    if (typeof renderAdminNav === 'function') {
        renderAdminNav('facilities');
    }

    loadFromStorage();

    const form = document.getElementById('facility-form');
    const imageLink = document.getElementById('facility-image-link');
    const imageFile = document.getElementById('facility-image-file');

    imageLink.addEventListener('input', (e) => {
        if (currentImageSource === 'url') {
            updatePreview(e.target.value.trim());
        }
    });

    imageFile.addEventListener('change', handleFileSelect);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const assetData = {
            name: formData.get('name'),
            type: formData.get('type'),
            status: formData.get('status'),
            base_price: formData.get('base_price'),
            description: formData.get('description'),
        };

        // Handle Image
        if (currentImageSource === 'url') {
            assetData.image = formData.get('images_link');
        } else {
            const file = imageFile.files[0];
            if (file) {
                assetData.image = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve(ev.target.result);
                    reader.readAsDataURL(file);
                });
            } else if (editingId) {
                // Keep old image if editing and no new file selected
                const oldAsset = assets.find(a => a.id === editingId);
                assetData.image = oldAsset ? oldAsset.image : '';
            }
        }

        if (editingId) {
            updateAsset(editingId, assetData);
        } else {
            createAsset(assetData);
        }

        closeModal('facility-modal');
    });
});

// Expose functions to global scope for HTML onclick handlers
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleImageSource = toggleImageSource;
window.openEditModal = openEditModal;
window.deleteAsset = deleteAsset;
