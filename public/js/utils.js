// Utilidades generales para la aplicación
class Utils {
    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    static getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    }

    static sanitizeFilename(filename) {
        return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    }

    static debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    static formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    static getFileType(mimetype) {
        const typeMap = {
            'image/': 'Imagen',
            'video/': 'Video',
            'audio/': 'Audio',
            'application/pdf': 'PDF',
            'application/msword': 'Documento Word',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Documento Word',
            'text/': 'Texto',
            'application/zip': 'Archivo comprimido',
            'application/x-rar-compressed': 'Archivo comprimido'
        };

        for (const [key, value] of Object.entries(typeMap)) {
            if (mimetype.startsWith(key)) {
                return value;
            }
        }

        return 'Archivo';
    }
}

// Exportar para uso global
window.Utils = Utils;   