// Interfaz de usuario para autenticación
class AuthUI {
    constructor() {
        this.currentForm = 'login';
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkExistingAuth();
    }

    bindEvents() {
        // Alternar entre login y registro
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('register');
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('login');
        });

        // Formularios
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Enter key en formularios
        document.querySelectorAll('.auth-form input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const form = e.target.closest('form');
                    if (form.id === 'loginForm') {
                        this.handleLogin();
                    } else if (form.id === 'registerForm') {
                        this.handleRegister();
                    }
                }
            });
        });
    }

    showForm(formType) {
        document.getElementById('loginForm').classList.toggle('hidden', formType !== 'login');
        document.getElementById('registerForm').classList.toggle('hidden', formType !== 'register');
        this.currentForm = formType;

        // Enfocar el primer campo
        setTimeout(() => {
            const firstInput = document.querySelector(`#${formType}Form input`);
            if (firstInput) firstInput.focus();
        }, 100);
    }

    async handleLogin() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showMessage('Por favor completa todos los campos', 'error');
            return;
        }

        this.setLoading('login', true);

        try {
            const result = await auth.login(username, password);

            if (result.success) {
                this.showMessage('¡Inicio de sesión exitoso!', 'success');

                // Esperar un momento antes de redirigir
                setTimeout(() => {
                    console.log('🔄 Redirigiendo a la aplicación...');
                    window.location.href = '/';
                }, 1000);
            } else {
                this.showMessage(result.error, 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Error de conexión', 'error');
        } finally {
            this.setLoading('login', false);
        }
    }

    async handleRegister() {
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;

        // Validaciones
        if (!username || !password) {
            this.showMessage('Usuario y contraseña son requeridos', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showMessage('Las contraseñas no coinciden', 'error');
            return;
        }

        this.setLoading('register', true);

        try {
            const result = await auth.register(username, password, email);

            if (result.success) {
                this.showMessage('¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.', 'success');
                this.showForm('login');

                // Limpiar formulario de registro
                document.getElementById('registerForm').reset();
            } else {
                this.showMessage(result.error, 'error');
            }
        } catch (error) {
            this.showMessage('Error de conexión', 'error');
        } finally {
            this.setLoading('register', false);
        }
    }

    setLoading(formType, loading) {
        const btn = document.getElementById(`${formType}Btn`);
        const btnText = document.getElementById(`${formType}BtnText`);
        const spinner = document.getElementById(`${formType}Spinner`);

        if (loading) {
            btn.disabled = true;
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
        } else {
            btn.disabled = false;
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    }

    showMessage(message, type) {
        // Eliminar mensajes existentes
        document.querySelectorAll('.auth-message').forEach(msg => msg.remove());

        const messageEl = document.createElement('div');
        messageEl.className = `auth-message auth-message-${type}`;
        messageEl.textContent = message;

        // Estilos para el mensaje
        messageEl.style.cssText = `
            padding: 0.75rem 1rem;
            margin: 1rem 0;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 500;
            text-align: center;
            border: 1px solid;
            animation: slideIn 0.3s ease;
        `;

        if (type === 'error') {
            messageEl.style.backgroundColor = 'var(--danger-color)';
            messageEl.style.color = 'white';
            messageEl.style.borderColor = 'var(--danger-color)';
        } else if (type === 'success') {
            messageEl.style.backgroundColor = 'var(--success-color)';
            messageEl.style.color = 'white';
            messageEl.style.borderColor = 'var(--success-color)';
        }

        // Insertar después del header
        const authHeader = document.querySelector('.auth-header');
        authHeader.parentNode.insertBefore(messageEl, authHeader.nextSibling);

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }

    checkExistingAuth() {
        if (auth.isAuthenticated()) {
            window.location.href = '/';
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.authUI = new AuthUI();
});