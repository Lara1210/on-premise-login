// Sistema de autenticación simplificado y corregido
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.token = null;
        this.init();
    }

    init() {
        this.loadStoredAuth();
        console.log('🔐 Auth inicializada:', {
            hasUser: !!this.currentUser,
            hasToken: !!this.token,
            user: this.currentUser
        });
    }

    // Cargar autenticación almacenada
    loadStoredAuth() {
        try {
            const storedUser = localStorage.getItem('driveUser');
            const storedToken = localStorage.getItem('driveToken');
            
            if (storedUser && storedToken) {
                this.currentUser = JSON.parse(storedUser);
                this.token = storedToken;
                console.log('✅ Auth cargada desde localStorage');
            }
        } catch (error) {
            console.error('Error loading auth:', error);
            this.clearAuth();
        }
    }

    // Verificar si el usuario está autenticado (SOLO verifica localStorage)
    isAuthenticated() {
        const hasAuth = !!(this.currentUser && this.token);
        console.log('🔍 Verificando autenticación:', hasAuth);
        return hasAuth;
    }

    // Iniciar sesión
    async login(username, password) {
        try {
            console.log('🚀 Intentando login para:', username);
            
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Error ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.currentUser = result.user;
                this.token = result.token;
                
                // Guardar en localStorage
                localStorage.setItem('driveUser', JSON.stringify(result.user));
                localStorage.setItem('driveToken', result.token);
                
                console.log('✅ Login exitoso, datos guardados:', {
                    user: result.user.username,
                    tokenLength: result.token.length
                });
                
                return { success: true, user: result.user };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            return { success: false, error: error.message || 'Error de conexión' };
        }
    }

    // Registrar nuevo usuario
    async register(username, password, email = '') {
        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, email })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                return { success: true, message: result.message };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('Register error:', error);
            return { success: false, error: 'Error de conexión' };
        }
    }

    // Cerrar sesión
    logout() {
        console.log('🔒 Cerrando sesión...');
        this.clearAuth();
        window.location.href = '/login.html';
    }

    // Limpiar autenticación
    clearAuth() {
        this.currentUser = null;
        this.token = null;
        localStorage.removeItem('driveUser');
        localStorage.removeItem('driveToken');
        console.log('🧹 Auth limpiada');
    }

    // Obtener usuario actual
    getCurrentUser() {
        return this.currentUser;
    }

    // Obtener token para usar en fetch
    getAuthHeaders() {
        if (this.token) {
            return { 'Authorization': `Bearer ${this.token}` };
        }
        return {};
    }

    // Fetch con autenticación automática
    async fetchWithAuth(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
            ...options.headers
        };

        try {
            const response = await fetch(url, { ...options, headers });
            
            // Si hay error de autenticación, limpiar y redirigir
            if (response.status === 401) {
                console.log('❌ Token inválido, cerrando sesión...');
                this.logout();
                return response;
            }
            
            return response;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }
}

// Instancia global de autenticación
window.auth = new AuthSystem();