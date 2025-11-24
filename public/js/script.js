class DriveApp {
    constructor() {
        // Verificar autenticación
        if (!auth.isAuthenticated()) {
            window.location.href = '/login.html';
            return;
        }

        this.files = [];
        this.folders = [];
        this.currentView = 'grid';
        this.currentFolderId = 1;
        this.currentSection = 'home';
        this.user = auth.getCurrentUser();
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadUserInfo();
        this.loadFolders();
        this.loadFiles();
        this.setupDragAndDrop();
        this.loadFolderStates();
        this.initTheme();
    }

    // Métodos para el tema
    initTheme() {
        const savedTheme = localStorage.getItem('driveTheme') || 'light';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('driveTheme', theme);

        // Actualizar icono del botón
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }

        // Actualizar título del botón
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.title = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        this.showNotification(`Modo ${newTheme === 'dark' ? 'oscuro' : 'claro'} activado`, 'success');
    }

    bindEvents() {
        // Toggle de tema
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Botón para mostrar/ocultar área de upload
        document.getElementById('showUploadBtn').addEventListener('click', () => {
            this.toggleUploadSection();
        });

        // Botones de subida
        document.getElementById('selectFilesBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        document.getElementById('emptyUploadBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        // Botones de vista
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });

        // Búsqueda
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterFiles(e.target.value);
        });

        // Modales
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                this.hideModal();
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal();
            }
        });

        // Navegación del sidebar
        document.querySelectorAll('.sidebar-menu li[data-section]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleNavigation(item.dataset.section);
            });
        });

        // Carpetas
        document.getElementById('createFolderBtn').addEventListener('click', () => {
            this.showFolderModal();
        });

        document.getElementById('newFolderSidebarBtn').addEventListener('click', () => {
            this.showFolderModal();
        });

        document.getElementById('confirmFolderBtn').addEventListener('click', () => {
            this.createNewFolder();
        });

        document.getElementById('cancelFolderBtn').addEventListener('click', () => {
            this.hideModal('folderModal');
        });

        document.getElementById('folderNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createNewFolder();
            }
        });

        // Modales de papelera
        document.getElementById('confirmEmptyTrashBtn')?.addEventListener('click', () => {
            this.emptyTrash();
            this.hideModal('emptyTrashModal');
        });

        document.getElementById('cancelEmptyTrashBtn')?.addEventListener('click', () => {
            this.hideModal('emptyTrashModal');
        });

        // Modales de eliminación de carpetas
        document.getElementById('confirmDeleteFolderBtn')?.addEventListener('click', () => {
            const folderId = document.getElementById('deleteFolderModal').dataset.folderId;
            this.executeFolderDelete(folderId);
        });

        document.getElementById('cancelDeleteFolderBtn')?.addEventListener('click', () => {
            this.hideModal('deleteFolderModal');
        });
    }

    toggleUploadSection() {
        const uploadSection = document.getElementById('uploadSection');
        const isVisible = uploadSection.style.display !== 'none';

        if (isVisible) {
            uploadSection.style.display = 'none';
            this.showNotification('Área de subida ocultada', 'info');
        } else {
            uploadSection.style.display = 'block';
            this.showNotification('Área de subida visible - arrastra archivos aquí', 'info');

            // Hacer scroll suave al área de upload
            uploadSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            this.handleFileSelection(e.dataTransfer.files);
        });
    }

    async handleFileSelection(files) {
        if (files.length === 0) return;

        const uploadProgress = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const uploadDetails = document.getElementById('uploadDetails');

        uploadProgress.style.display = 'block';
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (file.size > 50 * 1024 * 1024) {
                this.showNotification(`❌ ${file.name} es demasiado grande (máximo 50MB)`, 'error');
                errorCount++;
                continue;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('folderId', this.currentFolderId);

            try {
                // Para upload usamos fetch directo para manejar FormData correctamente
                // pero incluimos los headers de autenticación
                const headers = auth.getAuthHeaders();
                const response = await fetch('/upload', {
                    method: 'POST',
                    headers: headers,
                    body: formData
                });

                if (response.status === 401) {
                    auth.logout();
                    return;
                }

                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('El servidor respondió con un error inesperado');
                }

                const result = await response.json();

                if (response.ok) {
                    const progress = ((i + 1) / files.length) * 100;
                    progressFill.style.width = `${progress}%`;
                    uploadDetails.textContent = `Subiendo: ${file.name} (${i + 1}/${files.length})`;
                    successCount++;
                } else {
                    throw new Error(result.error || `Error HTTP ${response.status}`);
                }
            } catch (error) {
                console.error('Upload error for', file.name, error);
                errorCount++;
                this.showNotification(`❌ Error al subir ${file.name}: ${error.message}`, 'error');
            }
        }

        if (successCount > 0) {
            this.showNotification(`✅ ${successCount} archivo(s) subido(s) correctamente`, 'success');
        }
        if (errorCount > 0) {
            this.showNotification(`❌ ${errorCount} archivo(s) fallaron`, 'error');
        }

        setTimeout(() => {
            uploadProgress.style.display = 'none';
            progressFill.style.width = '0%';
            document.getElementById('fileInput').value = '';
            this.loadFiles();
            this.loadUserInfo();
        }, 2000);
    }

    async loadFiles() {
        try {
            let url = '/files';
            const params = new URLSearchParams();

            if (this.currentSection === 'files' && this.currentFolderId) {
                params.append('folderId', this.currentFolderId);
            } else if (this.currentSection !== 'home' && this.currentSection !== 'files') {
                params.append('section', this.currentSection);
            }

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const response = await auth.fetchWithAuth(url);
            if (!response.ok) {
                throw new Error('Error al cargar archivos');
            }
            const files = await response.json();
            this.files = files;
            this.renderFiles();
            this.updateFileCount();
            this.updateSectionTitle();
        } catch (error) {
            console.error('Error loading files:', error);
            this.showNotification('❌ Error al cargar los archivos', 'error');
        }
    }

    async loadFolders() {
        try {
            const response = await auth.fetchWithAuth('/folders');
            if (!response.ok) {
                throw new Error('Error al cargar carpetas');
            }
            const folders = await response.json();
            this.folders = folders;
            this.renderFolders();
        } catch (error) {
            console.error('Error loading folders:', error);
            this.showNotification('❌ Error al cargar las carpetas', 'error');
        }
    }

    async loadUserInfo() {
        try {
            // Usar el usuario de la autenticación
            this.user = auth.getCurrentUser();
            this.updateUserInfo(this.user);

            const systemResponse = await auth.fetchWithAuth('/system/info');
            if (!systemResponse.ok) {
                throw new Error('Error al cargar información del sistema');
            }
            const systemInfo = await systemResponse.json();
            this.updateStorageInfo(systemInfo);
        } catch (error) {
            console.error('Error loading user info:', error);
            this.showNotification('❌ Error al cargar información del usuario', 'error');
        }
    }

    updateUserInfo(user) {
        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            usernameElement.textContent = user.username || 'Usuario';
        }

        // Agregar botón de logout si no existe
        if (!document.getElementById('logoutBtn')) {
            const userInfo = document.querySelector('.user-info');
            if (userInfo) {
                const logoutBtn = document.createElement('button');
                logoutBtn.id = 'logoutBtn';
                logoutBtn.className = 'btn btn-outline btn-small';
                logoutBtn.innerHTML = '🚪 Cerrar Sesión';
                logoutBtn.addEventListener('click', () => {
                    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                        auth.logout();
                    }
                });
                userInfo.appendChild(logoutBtn);
            }
        }
    }

    updateStorageInfo(systemInfo) {
        const storageProgress = document.getElementById('storageProgress');
        const storageText = document.getElementById('storageText');

        if (storageProgress && storageText) {
            const usedGB = (systemInfo.storageUsed / 1024 / 1024 / 1024).toFixed(2);
            const totalGB = (systemInfo.storageLimit / 1024 / 1024 / 1024).toFixed(0);

            storageProgress.style.width = `${systemInfo.storagePercent}%`;
            storageText.textContent = `${usedGB} GB de ${totalGB} GB usados`;
        }
    }

    updateFileCount() {
        const fileCount = document.getElementById('fileCount');
        if (fileCount) {
            fileCount.textContent = `${this.files.length} archivo${this.files.length !== 1 ? 's' : ''}`;
        }
    }

    updateSectionTitle() {
        const sectionTitle = document.getElementById('sectionTitle');
        if (sectionTitle) {
            const titles = {
                'home': 'Inicio - Todos los archivos',
                'files': 'Mis archivos',
                'recent': 'Archivos recientes',
                'starred': 'Archivos destacados',
                'trash': 'Papelera'
            };
            sectionTitle.textContent = titles[this.currentSection] || 'Archivos';
        }
    }

    renderFiles() {
        const filesGrid = document.getElementById('filesGrid');
        const emptyState = document.getElementById('emptyState');

        if (!filesGrid || !emptyState) return;

        if (this.files.length === 0) {
            filesGrid.style.display = 'none';
            emptyState.style.display = 'block';
            this.updateEmptyState();
            return;
        }

        filesGrid.style.display = this.currentView === 'list' ? 'flex' : 'grid';
        emptyState.style.display = 'none';

        filesGrid.innerHTML = this.files.map(file => this.createFileCard(file)).join('');
        this.attachFileEventListeners();
    }

    updateEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (!emptyState) return;

        const emptyIcon = emptyState.querySelector('.empty-icon');
        const emptyTitle = emptyState.querySelector('h3');
        const emptyText = emptyState.querySelector('p');
        const emptyButton = document.getElementById('emptyUploadBtn');

        const states = {
            'home': { icon: '📁', title: 'No hay archivos', text: 'Comienza subiendo tu primer archivo', showButton: true },
            'files': { icon: '📁', title: 'No hay archivos', text: 'Esta carpeta está vacía', showButton: true },
            'recent': { icon: '🕐', title: 'No hay archivos recientes', text: 'Los archivos que subas aparecerán aquí', showButton: true },
            'starred': { icon: '⭐', title: 'No hay archivos destacados', text: 'Marca archivos como destacados para verlos aquí', showButton: false },
            'trash': { icon: '🗑️', title: 'Papelera vacía', text: 'Los archivos eliminados aparecerán aquí', showButton: false }
        };

        const state = states[this.currentSection] || states.home;

        if (emptyIcon) emptyIcon.textContent = state.icon;
        if (emptyTitle) emptyTitle.textContent = state.title;
        if (emptyText) emptyText.textContent = state.text;
        if (emptyButton) {
            emptyButton.style.display = state.showButton ? 'block' : 'none';
        }

        // Botón especial para vaciar papelera
        if (this.currentSection === 'trash') {
            let emptyTrashBtn = document.getElementById('emptyTrashBtn');
            if (!emptyTrashBtn) {
                emptyTrashBtn = this.createEmptyTrashButton();
                emptyState.appendChild(emptyTrashBtn);
            }
        } else {
            const emptyTrashBtn = document.getElementById('emptyTrashBtn');
            if (emptyTrashBtn) {
                emptyTrashBtn.remove();
            }
        }
    }

    createEmptyTrashButton() {
        const button = document.createElement('button');
        button.id = 'emptyTrashBtn';
        button.className = 'btn btn-danger';
        button.innerHTML = '🚮 Vaciar papelera';
        button.addEventListener('click', () => this.showEmptyTrashModal());
        return button;
    }

    showEmptyTrashModal() {
        const modal = document.getElementById('emptyTrashModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    renderFolders() {
        const foldersList = document.getElementById('foldersList');
        if (!foldersList) return;

        const rootFolders = this.folders.filter(folder =>
            folder.parentId === null || folder.parentId === 1
        );

        foldersList.innerHTML = rootFolders.map(folder =>
            this.createFolderItem(folder)
        ).join('');

        this.attachFolderEventListeners();
    }

    createFileCard(file) {
        const extension = file.extension?.toLowerCase() || file.filename.split('.').pop().toLowerCase();
        const icon = this.getFileIcon(extension);
        const size = this.formatFileSize(file.size);
        const uploadDate = new Date(file.uploadDate).toLocaleDateString();
        const isListView = this.currentView === 'list';
        const isTrash = this.currentSection === 'trash';
        const isViewable = this.isFileViewable(file);

        const starIcon = file.starred ? '⭐' : '☆';
        const starTitle = file.starred ? 'Quitar de destacados' : 'Marcar como destacado';
        const viewIcon = isViewable ? '👁️' : '⬇️';
        const viewTitle = isViewable ? 'Ver archivo' : 'Descargar';

        if (isListView) {
            return `
                <div class="file-card list-view-card" data-filename="${file.filename}">
                    <div class="file-info-list">
                        <div class="file-icon-small">${icon}</div>
                        <div class="file-details">
                            <div class="file-name" title="${file.originalName}">${file.originalName}</div>
                            <div class="file-meta">${size} • ${uploadDate}</div>
                        </div>
                    </div>
                    <div class="file-actions">
                        ${!isTrash ? `<button class="action-btn star-btn" data-filename="${file.filename}" title="${starTitle}">${starIcon}</button>` : ''}
                        <button class="action-btn file-view-btn" data-filename="${file.filename}" title="${viewTitle}">${viewIcon}</button>
                        ${isTrash ? `
                            <button class="action-btn restore-btn" data-filename="${file.filename}" title="Restaurar">↩️</button>
                            <button class="action-btn delete-permanent-btn" data-filename="${file.filename}" title="Eliminar permanentemente">🗑️</button>
                        ` : `
                            <button class="action-btn delete-btn" data-filename="${file.filename}" title="Mover a papelera">🗑️</button>
                        `}
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="file-card" data-filename="${file.filename}">
                    ${isViewable ? '<div class="file-viewable-badge">👁️</div>' : ''}
                    <div class="file-icon">${icon}</div>
                    <div class="file-name" title="${file.originalName}">${this.truncateFilename(file.originalName)}</div>
                    <div class="file-info">${size} • ${uploadDate}</div>
                    <div class="file-actions">
                        ${!isTrash ? `<button class="action-btn star-btn" data-filename="${file.filename}" title="${starTitle}">${starIcon}</button>` : ''}
                        <button class="action-btn file-view-btn" data-filename="${file.filename}" title="${viewTitle}">${viewIcon}</button>
                        ${isTrash ? `
                            <button class="action-btn restore-btn" data-filename="${file.filename}" title="Restaurar">↩️</button>
                            <button class="action-btn delete-permanent-btn" data-filename="${file.filename}" title="Eliminar permanentemente">🗑️</button>
                        ` : `
                            <button class="action-btn delete-btn" data-filename="${file.filename}" title="Mover a papelera">🗑️</button>
                        `}
                    </div>
                </div>
            `;
        }
    }

    getFileIcon(extension) {
        const iconMap = {
            'pdf': '📕',
            'doc': '📄',
            'docx': '📄',
            'txt': '📝',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️',
            'tif': '🖼️',
            'tiff': '🖼️',
            'mp4': '🎬',
            'avi': '🎬',
            'mov': '🎬',
            'mp3': '🎵',
            'wav': '🎵',
            'zip': '📦',
            'rar': '📦'
        };
        return iconMap[extension] || '📄';
    }

    truncateFilename(filename, maxLength = 20) {
        return filename.length <= maxLength ? filename : filename.substring(0, maxLength - 3) + '...';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    attachFileEventListeners() {
        document.querySelectorAll('.file-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('action-btn')) {
                    this.showFileInfo(card.dataset.filename);
                }
            });
        });

        // Ver/Descargar
        document.querySelectorAll('.file-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const filename = btn.dataset.filename;
                const file = this.files.find(f => f.filename === filename);

                if (file && this.isFileViewable(file)) {
                    this.viewFile(filename);
                } else {
                    this.downloadFile(filename);
                }
            });
        });

        // Destacar
        document.querySelectorAll('.star-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleStar(btn.dataset.filename);
            });
        });

        // Mover a papelera
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.moveToTrash(btn.dataset.filename);
            });
        });

        // Restaurar
        document.querySelectorAll('.restore-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.restoreFile(btn.dataset.filename);
            });
        });

        // Eliminar permanentemente
        document.querySelectorAll('.delete-permanent-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePermanent(btn.dataset.filename);
            });
        });
    }

    async downloadFile(filename) {
        try {
            const response = await auth.fetchWithAuth(`/download/${filename}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const file = this.files.find(f => f.filename === filename);
                a.download = file ? file.originalName : filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                this.showNotification('✅ Descarga iniciada', 'success');
            } else {
                throw new Error('Error en la descarga');
            }
        } catch (error) {
            this.showNotification('❌ Error al descargar', 'error');
        }
    }

    async toggleStar(filename) {
        try {
            const response = await auth.fetchWithAuth(`/files/${filename}/star`, { method: 'POST' });
            if (response.ok) {
                const result = await response.json();
                this.showNotification(`✅ ${result.message}`, 'success');
                this.loadFiles();
            } else {
                throw new Error('Error al marcar como destacado');
            }
        } catch (error) {
            this.showNotification('❌ Error al marcar como destacado', 'error');
        }
    }

    async moveToTrash(filename) {
        if (confirm('¿Mover este archivo a la papelera?')) {
            try {
                const response = await auth.fetchWithAuth(`/files/${filename}/trash`, { method: 'POST' });
                if (response.ok) {
                    this.showNotification('✅ Archivo movido a la papelera', 'success');
                    this.loadFiles();
                    this.loadUserInfo();
                } else {
                    throw new Error('Error al mover a la papelera');
                }
            } catch (error) {
                this.showNotification('❌ Error al mover a la papelera', 'error');
            }
        }
    }

    async restoreFile(filename) {
        try {
            const response = await auth.fetchWithAuth(`/files/${filename}/restore`, { method: 'POST' });
            if (response.ok) {
                this.showNotification('✅ Archivo restaurado', 'success');
                this.loadFiles();
                this.loadUserInfo();
            } else {
                throw new Error('Error al restaurar el archivo');
            }
        } catch (error) {
            this.showNotification('❌ Error al restaurar el archivo', 'error');
        }
    }

    async deletePermanent(filename) {
        const file = this.files.find(f => f.filename === filename);
        if (confirm(`¿Eliminar permanentemente "${file.originalName}"? Esta acción no se puede deshacer.`)) {
            try {
                const response = await auth.fetchWithAuth(`/files/${filename}/permanent`, { method: 'DELETE' });
                if (response.ok) {
                    this.showNotification('✅ Archivo eliminado permanentemente', 'success');
                    this.loadFiles();
                    this.loadUserInfo();
                } else {
                    throw new Error('Error al eliminar permanentemente');
                }
            } catch (error) {
                this.showNotification('❌ Error al eliminar permanentemente', 'error');
            }
        }
    }

    async emptyTrash() {
        const trashFiles = this.files.filter(f => f.inTrash);
        if (trashFiles.length === 0) {
            this.showNotification('ℹ️ La papelera ya está vacía', 'info');
            return;
        }

        try {
            const response = await auth.fetchWithAuth('/trash/empty', { method: 'DELETE' });
            if (response.ok) {
                const result = await response.json();
                this.showNotification(`✅ ${result.message}`, 'success');
                this.loadFiles();
                this.loadUserInfo();
            } else {
                throw new Error('Error al vaciar la papelera');
            }
        } catch (error) {
            this.showNotification('❌ Error al vaciar la papelera', 'error');
        }
    }

    // Método para visualizar archivos
    async viewFile(filename) {
        try {
            const file = this.files.find(f => f.filename === filename);
            if (!file) {
                this.showNotification('❌ Archivo no encontrado', 'error');
                return;
            }

            // Verificar si el archivo es visualizable directamente
            if (this.isFileViewable(file)) {
                await this.showFilePreview(file);
            } else {
                // Si no es visualizable, descargar
                this.downloadFile(filename);
            }
        } catch (error) {
            console.error('Error viewing file:', error);
            this.showNotification('❌ Error al visualizar el archivo', 'error');
        }
    }

    // Método para verificar si un archivo es visualizable
    isFileViewable(file) {
        const viewableTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'text/plain', 'text/html', 'text/css', 'text/javascript',
            'application/json'
        ];

        const viewableExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.html', '.css', '.js', '.json'];

        return viewableTypes.includes(file.mimetype) ||
            viewableExtensions.includes(file.extension?.toLowerCase());
    }

    // Método para mostrar preview del archivo
    async showFilePreview(file) {
        const modal = document.getElementById('fileModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');

        if (!modal || !modalTitle || !modalContent) return;

        modalTitle.textContent = `Vista previa: ${file.originalName}`;

        try {
            const response = await auth.fetchWithAuth(`/download/${file.filename}`);
            if (!response.ok) throw new Error('Error al cargar el archivo');

            if (file.mimetype.startsWith('image/')) {
                // Para imágenes
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                modalContent.innerHTML = `
                    <div style="text-align: center;">
                        <img src="${url}" alt="${file.originalName}" style="max-width: 100%; max-height: 70vh; border-radius: 8px;">
                        <div style="margin-top: 1rem;">
                            <p><strong>${file.originalName}</strong></p>
                            <p style="color: var(--text-secondary);">${this.formatFileSize(file.size)} • ${file.mimetype}</p>
                        </div>
                    </div>
                    <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-primary" onclick="app.downloadFile('${file.filename}')">
                            ⬇️ Descargar
                        </button>
                        <button class="btn btn-secondary" onclick="app.hideModal()">
                            Cerrar
                        </button>
                    </div>
                `;
            } else if (file.mimetype === 'application/pdf') {
                // Para PDFs
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                modalContent.innerHTML = `
                    <div style="height: 70vh;">
                        <embed src="${url}" type="application/pdf" width="100%" height="100%" style="border-radius: 8px;">
                    </div>
                    <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-primary" onclick="app.downloadFile('${file.filename}')">
                            ⬇️ Descargar
                        </button>
                        <button class="btn btn-secondary" onclick="app.hideModal()">
                            Cerrar
                        </button>
                    </div>
                `;
            } else if (file.mimetype.startsWith('text/') || file.extension === '.json') {
                // Para archivos de texto
                const text = await response.text();
                modalContent.innerHTML = `
                    <div style="margin-bottom: 1rem;">
                        <h4>Contenido del archivo:</h4>
                    </div>
                    <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; max-height: 50vh; overflow: auto; font-family: 'Courier New', monospace; font-size: 0.9rem;">${this.escapeHtml(text)}</pre>
                    <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-primary" onclick="app.downloadFile('${file.filename}')">
                            ⬇️ Descargar
                        </button>
                        <button class="btn btn-secondary" onclick="app.hideModal()">
                            Cerrar
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            modalContent.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                    <h4>No se pudo cargar la vista previa</h4>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem;">${error.message}</p>
                    <button class="btn btn-primary" onclick="app.downloadFile('${file.filename}')">
                        ⬇️ Descargar archivo
                    </button>
                </div>
            `;
        }

        modal.style.display = 'block';
    }

    // Método para escapar HTML (seguridad)
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showFileInfo(filename) {
        const file = this.files.find(f => f.filename === filename);
        if (!file) return;

        const modal = document.getElementById('fileModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');

        if (!modal || !modalTitle || !modalContent) return;

        modalTitle.textContent = 'Información del archivo';

        const isViewable = this.isFileViewable(file);
        const viewButton = isViewable ?
            `<button class="btn btn-primary" onclick="app.viewFile('${filename}')">👁️ Ver archivo</button>` :
            '';

        const actions = this.currentSection === 'trash' ? `
            <button class="btn btn-primary" onclick="app.restoreFile('${filename}')">↩️ Restaurar</button>
            <button class="btn btn-danger" onclick="app.deletePermanent('${filename}')">🗑️ Eliminar permanentemente</button>
        ` : `
            ${viewButton}
            <button class="btn btn-secondary" onclick="app.downloadFile('${filename}')">⬇️ Descargar</button>
            <button class="btn btn-secondary" onclick="app.toggleStar('${filename}')">${file.starred ? '⭐ Quitar destacado' : '☆ Destacar'}</button>
            <button class="btn btn-danger" onclick="app.moveToTrash('${filename}')">🗑️ Mover a papelera</button>
        `;

        modalContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 2rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">${this.getFileIcon(file.extension)}</div>
                <h4>${file.originalName}</h4>
                ${isViewable ? '<p style="color: var(--success-color);">✅ Visualizable en el navegador</p>' : ''}
            </div>
            <div style="display: grid; gap: 1rem;">
                <div><strong>Nombre:</strong> ${file.originalName}</div>
                <div><strong>Tipo:</strong> ${file.mimetype}</div>
                <div><strong>Tamaño:</strong> ${this.formatFileSize(file.size)}</div>
                <div><strong>Fecha de subida:</strong> ${new Date(file.uploadDate).toLocaleString()}</div>
                <div><strong>Destacado:</strong> ${file.starred ? 'Sí ⭐' : 'No'}</div>
                <div><strong>Estado:</strong> ${file.inTrash ? 'En papelera 🗑️' : 'Activo'}</div>
                ${file.inTrash ? `<div><strong>En papelera desde:</strong> ${new Date(file.trashedAt).toLocaleString()}</div>` : ''}
            </div>
            <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                ${actions}
                <button class="btn btn-secondary" onclick="app.hideModal()">Cerrar</button>
            </div>
        `;

        modal.style.display = 'block';
    }

    showFolderModal(parentId = null) {
        const modal = document.getElementById('folderModal');
        const input = document.getElementById('folderNameInput');
        const title = document.getElementById('folderModalTitle');

        if (!modal || !input || !title) return;

        // Establecer parentId para la nueva carpeta
        modal.dataset.parentId = parentId || this.currentFolderId;

        // Actualizar título según el contexto
        if (parentId && parentId !== 1) {
            const parentFolder = this.folders.find(f => f.id === parentId);
            title.textContent = parentFolder ?
                `Nueva carpeta en "${parentFolder.name}"` : 'Nueva subcarpeta';
        } else {
            title.textContent = 'Nueva carpeta';
        }

        input.value = '';
        modal.style.display = 'block';

        setTimeout(() => {
            input.focus();
        }, 100);
    }

    async createNewFolder() {
        const modal = document.getElementById('folderModal');
        const folderNameInput = document.getElementById('folderNameInput');

        if (!modal || !folderNameInput) return;

        const folderName = folderNameInput.value.trim();
        const parentId = parseInt(modal.dataset.parentId) || this.currentFolderId;

        if (!folderName) {
            this.showNotification('❌ El nombre de la carpeta no puede estar vacío', 'error');
            return;
        }

        // Validar nombre único en la misma carpeta
        const existingFolder = this.folders.find(f =>
            f.name === folderName && f.parentId === parentId
        );

        if (existingFolder) {
            this.showNotification('❌ Ya existe una carpeta con ese nombre', 'error');
            return;
        }

        try {
            const response = await auth.fetchWithAuth('/folders', {
                method: 'POST',
                body: JSON.stringify({
                    name: folderName,
                    parentId: parentId === 1 ? null : parentId // La carpeta raíz tiene parentId null
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification('✅ Carpeta creada correctamente', 'success');
                this.hideModal('folderModal');
                await this.loadFolders();

                // Si estamos en la vista de archivos, recargar también
                if (this.currentSection === 'files') {
                    await this.loadFiles();
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.showNotification(`❌ Error al crear carpeta: ${error.message}`, 'error');
        }
    }

    hideModal(modalId = null) {
        if (modalId) {
            const modal = document.getElementById(modalId);
            if (modal) modal.style.display = 'none';
        } else {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
    }

    handleNavigation(section) {
        document.querySelectorAll('.sidebar-menu li').forEach(li => {
            li.classList.remove('active');
        });

        event.currentTarget.classList.add('active');
        this.currentSection = section;
        this.currentFolderId = section === 'files' ? 1 : null;

        this.loadFiles();
    }

    openFolder(folderId) {
        this.currentFolderId = folderId;
        this.currentSection = 'files';

        // Actualizar navegación
        document.querySelectorAll('.sidebar-menu li').forEach(li => {
            li.classList.remove('active');
        });

        // Activar "Mis archivos" en el sidebar
        const filesSection = document.querySelector('.sidebar-menu li[data-section="files"]');
        if (filesSection) {
            filesSection.classList.add('active');
        }

        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            const currentFolderName = document.getElementById('currentFolderName');
            if (currentFolderName) {
                currentFolderName.textContent = folder.name;
            }
        }

        this.loadFiles();
    }

    switchView(view) {
        this.currentView = view;
        const filesGrid = document.getElementById('filesGrid');

        if (!filesGrid) return;

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        filesGrid.classList.toggle('list-view', view === 'list');

        if (view === 'list') {
            filesGrid.style.display = 'flex';
            filesGrid.style.flexDirection = 'column';
        } else {
            filesGrid.style.display = 'grid';
            filesGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
        }

        this.renderFiles();
    }

    filterFiles(searchTerm) {
        const filteredFiles = this.files.filter(file =>
            file.originalName.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const filesGrid = document.getElementById('filesGrid');
        const emptyState = document.getElementById('emptyState');

        if (!filesGrid || !emptyState) return;

        if (filteredFiles.length === 0 && searchTerm) {
            filesGrid.style.display = 'none';
            emptyState.style.display = 'block';
            emptyState.innerHTML = `
                <div class="empty-icon">🔍</div>
                <h3>No se encontraron archivos</h3>
                <p>No hay resultados para "${searchTerm}"</p>
            `;
        } else {
            this.renderFilteredFiles(filteredFiles);
        }
    }

    renderFilteredFiles(filteredFiles) {
        const filesGrid = document.getElementById('filesGrid');
        const emptyState = document.getElementById('emptyState');

        if (!filesGrid || !emptyState) return;

        if (filteredFiles.length === 0) {
            filesGrid.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            filesGrid.style.display = this.currentView === 'list' ? 'flex' : 'grid';
            emptyState.style.display = 'none';
            filesGrid.innerHTML = filteredFiles.map(file => this.createFileCard(file)).join('');
            this.attachFileEventListeners();
        }
    }

    showNotification(message, type = 'info') {
        // Eliminar notificaciones existentes
        document.querySelectorAll('.notification').forEach(notification => {
            notification.remove();
        });

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // Métodos para carpetas (jerárquicas)
    createFolderItem(folder, level = 0) {
        const subfolders = this.folders.filter(f => f.parentId === folder.id);
        const hasSubfolders = subfolders.length > 0;
        const indent = level * 20;
        const isExpanded = folder.expanded !== false; // Por defecto expandido

        return `
            <li data-folder-id="${folder.id}" class="folder-item" style="margin-left: ${indent}px">
                <div class="folder-content">
                    <div class="folder-header">
                        ${hasSubfolders ? `
                            <button class="expand-btn" data-folder-id="${folder.id}" data-expanded="${isExpanded}">
                                ${isExpanded ? '📂' : '📁'}
                            </button>
                        ` : `
                            <span class="folder-icon">📁</span>
                        `}
                        <a href="#" class="folder-link">
                            <span class="folder-name">${folder.name}</span>
                        </a>
                    </div>
                    <div class="folder-actions">
                        <button class="folder-action-btn new-subfolder-btn" data-folder-id="${folder.id}" title="Nueva subcarpeta">
                            ➕
                        </button>
                        <button class="folder-action-btn folder-delete-btn" data-folder-id="${folder.id}" title="Eliminar carpeta">
                            🗑️
                        </button>
                    </div>
                </div>
                ${hasSubfolders ? `
                    <div class="subfolders-container" data-folder-id="${folder.id}" 
                         style="${isExpanded ? '' : 'display: none;'}">
                        <ul class="subfolders-list">
                            ${subfolders.map(subfolder =>
            this.createFolderItem(subfolder, level + 1)
        ).join('')}
                        </ul>
                    </div>
                ` : ''}
            </li>
        `;
    }

    attachFolderEventListeners() {
        // Abrir carpeta
        document.querySelectorAll('.folder-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const folderId = parseInt(e.target.closest('.folder-item').dataset.folderId);
                this.openFolder(folderId);
            });
        });

        // Expandir/Colapsar subcarpetas
        document.querySelectorAll('.expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const folderId = parseInt(btn.dataset.folderId);
                this.toggleFolder(folderId, btn);
            });
        });

        // Nueva subcarpeta
        document.querySelectorAll('.new-subfolder-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const folderId = parseInt(btn.dataset.folderId);
                this.showFolderModal(folderId);
            });
        });

        // Eliminar carpeta
        document.querySelectorAll('.folder-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const folderId = parseInt(btn.dataset.folderId);
                this.deleteFolder(folderId);
            });
        });
    }

    toggleFolder(folderId, button) {
        const folder = this.folders.find(f => f.id === folderId);
        if (!folder) return;

        // Cambiar estado
        folder.expanded = !folder.expanded;

        // Actualizar icono del botón
        const isExpanded = folder.expanded;
        button.textContent = isExpanded ? '📂' : '📁';
        button.dataset.expanded = isExpanded;

        // Mostrar/ocultar subcarpetas
        const subfoldersContainer = document.querySelector(`.subfolders-container[data-folder-id="${folderId}"]`);
        if (subfoldersContainer) {
            subfoldersContainer.style.display = isExpanded ? 'block' : 'none';
        }

        // Guardar preferencia
        this.saveFolderState();
    }

    saveFolderState() {
        const folderStates = this.folders.map(f => ({
            id: f.id,
            expanded: f.expanded
        }));
        localStorage.setItem('folderStates', JSON.stringify(folderStates));
    }

    loadFolderStates() {
        try {
            const savedStates = localStorage.getItem('folderStates');
            if (savedStates) {
                const states = JSON.parse(savedStates);
                states.forEach(state => {
                    const folder = this.folders.find(f => f.id === state.id);
                    if (folder) {
                        folder.expanded = state.expanded;
                    }
                });
            }
        } catch (error) {
            console.error('Error loading folder states:', error);
        }
    }

    async deleteFolder(folderId) {
        try {
            // Obtener información detallada de la carpeta
            const infoResponse = await auth.fetchWithAuth(`/folders/${folderId}/info`);
            if (!infoResponse.ok) {
                throw new Error('Error al obtener información de la carpeta');
            }

            const folderInfo = await infoResponse.json();
            const folder = folderInfo.folder;

            // Mostrar confirmación diferente según el contenido
            if (folderInfo.stats.totalItems === 0) {
                // Carpeta vacía - eliminación simple
                if (confirm(`¿Eliminar la carpeta vacía "${folder.name}"?`)) {
                    await this.executeFolderDelete(folderId, false);
                }
            } else {
                // Carpeta con contenido - mostrar advertencia detallada
                const warningMessage =
                    `¿Eliminar la carpeta "${folder.name}" y todo su contenido?\n\n` +
                    `📊 Contenido a eliminar:\n` +
                    `• 📄 ${folderInfo.stats.files} archivo(s)\n` +
                    `• 📁 ${folderInfo.stats.subfolders} subcarpeta(s)\n\n` +
                    `⚠️  Todos los archivos se moverán a la papelera.\n` +
                    `⚠️  Las subcarpetas y su contenido también se eliminarán.\n\n` +
                    `¿Continuar?`;

                if (confirm(warningMessage)) {
                    await this.executeFolderDelete(folderId, true);
                }
            }
        } catch (error) {
            console.error('Error deleting folder:', error);
            this.showNotification(`❌ ${error.message}`, 'error');
        }
    }

    async executeFolderDelete(folderId, hasContent) {
        try {
            let response;
            if (!hasContent) {
                response = await auth.fetchWithAuth(`/folders/${folderId}`, { method: 'DELETE' });
            } else {
                response = await auth.fetchWithAuth(`/folders/${folderId}/force`, { method: 'DELETE' });
            }

            const result = await response.json();

            if (response.ok && result.success) {
                if (!hasContent) {
                    this.showNotification('✅ Carpeta eliminada', 'success');
                } else {
                    this.showNotification(`✅ Carpeta "${result.details.folderDeleted}" eliminada con todo su contenido`, 'success');
                }

                // Recargar todo
                await this.loadFolders();
                await this.loadFiles();
                await this.loadUserInfo();

                // Si estábamos en la carpeta eliminada, volver al inicio
                if (this.currentFolderId === parseInt(folderId)) {
                    this.currentFolderId = 1;
                    this.currentSection = 'home';
                    this.handleNavigation('home');
                }
            } else {
                throw new Error(result.error || 'Error al eliminar la carpeta');
            }
        } catch (error) {
            throw new Error(error.message);
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando aplicación DriveApp...');

    // Verificación SIMPLIFICADA - solo verificar localStorage
    if (!auth.isAuthenticated()) {
        console.log('❌ No autenticado, redirigiendo a login...');
        window.location.href = '/login.html';
        return;
    }

    console.log('✅ Usuario autenticado, iniciando aplicación...');

    // NO verificar con el servidor inmediatamente - iniciar la app directamente
    window.app = new DriveApp();

    // Verificación en segundo plano (opcional)
    setTimeout(async () => {
        try {
            const response = await auth.fetchWithAuth('/auth/verify');

            if (!response.ok) {
                console.log('❌ Verificación falló en segundo plano');
                // No hacer logout automático, solo log
            } else {
                console.log('✅ Verificación exitosa en segundo plano');
            }
        } catch (error) {
            console.log('⚠️ Error en verificación en segundo plano:', error);
        }
    }, 2000);
});
