const fs = require('fs');
const path = require('path');

// Crear estructura de directorios
const directories = [
    'uploads',
    'data',
    'public',
    'public/css',
    'public/js',
    'public/uploads'
];

directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Directorio creado: ${dir}`);
    }
});

// Crear base de datos inicial
const dbPath = path.join(__dirname, 'data', 'database.json');
if (!fs.existsSync(dbPath)) {
    const initialData = {
        users: [
            {
                id: 1,
                username: "admin",
                email: "admin@drive.com",
                storageUsed: 0,
                storageLimit: 10737418240, // 10GB en bytes
                createdAt: new Date().toISOString()
            }
        ],
        files: [],
        folders: [
            {
                id: 1,
                name: "Mis archivos",
                parentId: null,
                userId: 1,
                createdAt: new Date().toISOString()
            }
        ],
        settings: {
            maxFileSize: 52428800, // 50MB
            allowedTypes: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt', '.mp4', '.avi', '.mov', '.mp3', '.wav', '.zip', '.rar']
        }
    };
    
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    console.log('✅ Base de datos inicializada');
}

console.log('🚀 Configuración completada!');
console.log('📁 Estructura de carpetas creada');
console.log('💾 Base de datos inicializada');