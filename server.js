const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3000;

// Clave secreta para JWT
const JWT_SECRET = process.env.JWT_SECRET || 'drive-onpremise-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Middleware de autenticación mejorado
const authenticateToken = (req, res, next) => {
    // Excluir rutas públicas
    const publicRoutes = [
        '/auth/login',
        '/auth/register',
        '/login.html',
        '/health',
        '/css/',
        '/js/',
        '/favicon.ico'
    ];

    if (publicRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }

    // Para archivos HTML, solo requerir auth para index.html
    if (req.path.endsWith('.html') && req.path !== '/index.html') {
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        if (req.path === '/' || req.path === '/index.html') {
            return res.redirect('/login.html');
        }
        return res.status(401).json({ error: "Token de acceso requerido" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            if (req.path === '/' || req.path === '/index.html') {
                return res.redirect('/login.html');
            }
            return res.status(403).json({ error: "Token inválido" });
        }
        req.user = user;
        next();
    });
};

// Aplicar middleware de autenticación
app.use(authenticateToken);

// Asegurar que los directorios existan
const ensureDirectories = () => {
    const directories = ['uploads', 'data'];
    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

ensureDirectories();

// Base de datos simple (archivo JSON)
const DB_PATH = path.join(__dirname, 'data', 'database.json');

// Función mejorada para inicializar la base de datos
function initializeDB() {
    const defaultPassword = "admin123";
    const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

    const initialData = {
        users: [
            {
                id: 1,
                username: "admin",
                email: "admin@drive.com",
                password: hashedPassword,
                storageUsed: 0,
                storageLimit: 10737418240,
                createdAt: new Date().toISOString(),
                permissions: ["admin", "upload", "download", "delete"]
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
        starred: [],
        trash: []
    };

    return initialData;
}

function readDB() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initialData = initializeDB();
            writeDB(initialData);
            console.log('✅ Base de datos inicializada con usuario admin');
            return initialData;
        }

        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

        // Verificar y corregir estructura de usuarios si es necesario
        if (!data.users || data.users.length === 0) {
            console.log('⚠️  Base de datos corrupta, reinicializando...');
            const initialData = initializeDB();
            writeDB(initialData);
            return initialData;
        }

        return data;
    } catch (error) {
        console.error('Error reading database:', error);
        console.log('🔄 Creando nueva base de datos...');
        const initialData = initializeDB();
        writeDB(initialData);
        return initialData;
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing database:', error);
    }
}

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = "uploads";
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const originalName = file.originalname;
        const fileExtension = path.extname(originalName);
        const baseName = path.basename(originalName, fileExtension);
        const sanitizedName = baseName.replace(/[^a-zA-Z0-9]/g, '_') + fileExtension;
        const finalName = Date.now() + '-' + sanitizedName;
        cb(null, finalName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt', '.mp4', '.avi', '.mov', '.mp3', '.wav', '.zip', '.rar', '.tif', '.tiff'];
        const fileExtension = path.extname(file.originalname).toLowerCase();

        if (allowedTypes.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de archivo no permitido: ${fileExtension}`), false);
        }
    }
});

// RUTAS DE AUTENTICACIÓN

// Registro de usuario
app.post("/auth/register", async (req, res) => {
    try {
        const { username, password, email } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Usuario y contraseña son requeridos" });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
        }

        const db = readDB();

        // Verificar si el usuario ya existe
        const existingUser = db.users.find(u => u.username === username);
        if (existingUser) {
            return res.status(400).json({ error: "El usuario ya existe" });
        }

        // Crear nuevo usuario
        const newUser = {
            id: Date.now(),
            username,
            email: email || `${username}@drive.com`,
            password: bcrypt.hashSync(password, 10),
            storageUsed: 0,
            storageLimit: 10737418240,
            createdAt: new Date().toISOString(),
            permissions: ["upload", "download", "delete"]
        };

        db.users.push(newUser);

        // Crear carpeta principal para el usuario
        const userFolder = {
            id: Date.now() + 1,
            name: "Mis archivos",
            parentId: null,
            userId: newUser.id,
            createdAt: new Date().toISOString()
        };
        db.folders.push(userFolder);

        writeDB(db);

        console.log(`✅ Nuevo usuario registrado: ${username}`);

        res.json({
            success: true,
            message: "Usuario registrado correctamente"
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Inicio de sesión - CORREGIDO
app.post("/auth/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Usuario y contraseña son requeridos" });
        }

        const db = readDB();
        const user = db.users.find(u => u.username === username);

        if (!user) {
            console.log(`❌ Intento de login fallido - Usuario no encontrado: ${username}`);
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }

        // Verificar que el usuario tenga contraseña
        if (!user.password) {
            console.log(`❌ Usuario sin contraseña: ${username}`);
            return res.status(401).json({ error: "Error de configuración del usuario" });
        }

        // Verificar contraseña de forma segura
        try {
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                console.log(`❌ Intento de login fallido - Contraseña incorrecta para: ${username}`);
                return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
            }
        } catch (bcryptError) {
            console.error('Error en bcrypt.compare:', bcryptError);
            return res.status(500).json({ error: "Error interno de autenticación" });
        }

        // Generar token JWT
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                permissions: user.permissions
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Eliminar password del objeto de respuesta
        const { password: _, ...userWithoutPassword } = user;

        console.log(`✅ Login exitoso: ${username}`);

        res.json({
            success: true,
            message: "Inicio de sesión exitoso",
            user: userWithoutPassword,
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Verificar token
app.get("/auth/verify", (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Token requerido" });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Token inválido" });
        }

        const db = readDB();
        const user = db.users.find(u => u.id === decoded.id);

        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const { password: _, ...userWithoutPassword } = user;

        res.json({
            success: true,
            user: userWithoutPassword
        });
    });
});

// Cerrar sesión
app.post("/auth/logout", (req, res) => {
    res.json({
        success: true,
        message: "Sesión cerrada correctamente"
    });
});

// Ruta para verificar estado de la base de datos (solo desarrollo)
app.get("/auth/debug", (req, res) => {
    const db = readDB();
    const users = db.users.map(u => ({
        id: u.id,
        username: u.username,
        hasPassword: !!u.password,
        passwordLength: u.password ? u.password.length : 0
    }));

    res.json({
        totalUsers: db.users.length,
        users: users
    });
});

// ... (el resto de las rutas se mantienen igual, pero asegúrate de que todas tengan el filtro por userId)

// RUTAS DE LA API (PROTEGIDAS)

// Subir archivo
app.post("/upload", upload.single("file"), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se subió ningún archivo" });
        }

        const db = readDB();
        const fileInfo = {
            id: Date.now(),
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            extension: path.extname(req.file.originalname).toLowerCase(),
            uploadDate: new Date().toISOString(),
            folderId: parseInt(req.body.folderId) || 1,
            userId: req.user.id,
            starred: false,
            inTrash: false
        };

        db.files.push(fileInfo);

        const user = db.users.find(u => u.id === req.user.id);
        if (user) {
            user.storageUsed = (user.storageUsed || 0) + fileInfo.size;
        }

        writeDB(db);

        res.json({
            success: true,
            message: "Archivo subido correctamente",
            file: fileInfo
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: "Error interno del servidor: " + error.message });
    }
});

// Obtener archivos por sección
app.get("/files", (req, res) => {
    try {
        const db = readDB();
        const { folderId, section } = req.query;

        let files = db.files || [];

        // Filtrar archivos del usuario actual
        files = files.filter(file => file.userId === req.user.id);

        // Filtrar según la sección
        if (section === 'trash') {
            files = files.filter(file => file.inTrash);
        } else if (section === 'starred') {
            files = files.filter(file => file.starred && !file.inTrash);
        } else if (section === 'recent') {
            files = files
                .filter(file => !file.inTrash)
                .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
                .slice(0, 20);
        } else if (folderId) {
            files = files.filter(file => file.folderId === parseInt(folderId) && !file.inTrash);
        } else {
            files = files.filter(file => !file.inTrash);
        }

        res.json(files);
    } catch (error) {
        console.error('Error getting files:', error);
        res.status(500).json({ error: "Error al leer los archivos" });
    }
});

// Obtener carpetas
app.get("/folders", (req, res) => {
    try {
        const db = readDB();
        // Filtrar carpetas del usuario actual
        const userFolders = (db.folders || []).filter(folder => folder.userId === req.user.id);
        res.json(userFolders);
    } catch (error) {
        console.error('Error getting folders:', error);
        res.status(500).json({ error: "Error al leer las carpetas" });
    }
});

// Crear carpeta
app.post("/folders", (req, res) => {
    try {
        const { name, parentId } = req.body;

        if (!name) {
            return res.status(400).json({ error: "El nombre es requerido" });
        }

        const db = readDB();

        // Verificar duplicados en la misma ubicación
        const existingFolder = db.folders.find(f =>
            f.name === name &&
            f.parentId === parentId &&
            f.userId === req.user.id
        );

        if (existingFolder) {
            return res.status(400).json({ error: "Ya existe una carpeta con ese nombre" });
        }

        const newFolder = {
            id: Date.now(),
            name,
            parentId: parentId || null,
            userId: req.user.id,
            createdAt: new Date().toISOString()
        };

        db.folders.push(newFolder);
        writeDB(db);

        res.json({
            success: true,
            message: "Carpeta creada correctamente",
            folder: newFolder
        });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: "Error al crear la carpeta" });
    }
});

// Información del sistema (almacenamiento)
app.get("/system/info", (req, res) => {
    try {
        const db = readDB();
        const user = db.users.find(u => u.id === req.user.id);

        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json({
            storageUsed: user.storageUsed || 0,
            storageLimit: user.storageLimit || 10737418240, // 10GB default
            storagePercent: ((user.storageUsed || 0) / (user.storageLimit || 10737418240)) * 100
        });
    } catch (error) {
        console.error('Error getting system info:', error);
        res.status(500).json({ error: "Error al obtener información del sistema" });
    }
});

// Descargar archivo
app.get("/download/:filename", (req, res) => {
    try {
        const filename = req.params.filename;
        const db = readDB();

        // Buscar archivo y verificar propiedad
        const file = db.files.find(f => f.filename === filename && f.userId === req.user.id);

        if (!file) {
            return res.status(404).json({ error: "Archivo no encontrado" });
        }

        const filePath = path.join(__dirname, 'uploads', filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "El archivo físico no existe" });
        }

        res.download(filePath, file.originalName);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: "Error en la descarga" });
    }
});

// Destacar/No destacar archivo
app.post("/files/:filename/star", (req, res) => {
    try {
        const filename = req.params.filename;
        const db = readDB();
        const file = db.files.find(f => f.filename === filename && f.userId === req.user.id);

        if (!file) {
            return res.status(404).json({ error: "Archivo no encontrado" });
        }

        file.starred = !file.starred;
        writeDB(db);

        res.json({
            success: true,
            message: file.starred ? "Archivo destacado" : "Archivo quitado de destacados",
            starred: file.starred
        });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar estado" });
    }
});

// Mover a papelera
app.post("/files/:filename/trash", (req, res) => {
    try {
        const filename = req.params.filename;
        const db = readDB();
        const file = db.files.find(f => f.filename === filename && f.userId === req.user.id);

        if (!file) {
            return res.status(404).json({ error: "Archivo no encontrado" });
        }

        file.inTrash = true;
        file.trashedAt = new Date().toISOString();
        writeDB(db);

        res.json({ success: true, message: "Archivo movido a la papelera" });
    } catch (error) {
        res.status(500).json({ error: "Error al mover a papelera" });
    }
});

// Restaurar de papelera
app.post("/files/:filename/restore", (req, res) => {
    try {
        const filename = req.params.filename;
        const db = readDB();
        const file = db.files.find(f => f.filename === filename && f.userId === req.user.id);

        if (!file) {
            return res.status(404).json({ error: "Archivo no encontrado" });
        }

        file.inTrash = false;
        delete file.trashedAt;
        writeDB(db);

        res.json({ success: true, message: "Archivo restaurado" });
    } catch (error) {
        res.status(500).json({ error: "Error al restaurar archivo" });
    }
});

// Eliminar permanentemente
app.delete("/files/:filename/permanent", (req, res) => {
    try {
        const filename = req.params.filename;
        const db = readDB();
        const fileIndex = db.files.findIndex(f => f.filename === filename && f.userId === req.user.id);

        if (fileIndex === -1) {
            return res.status(404).json({ error: "Archivo no encontrado" });
        }

        const file = db.files[fileIndex];
        const filePath = path.join(__dirname, 'uploads', filename);

        // Eliminar archivo físico
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Actualizar espacio usado
        const user = db.users.find(u => u.id === req.user.id);
        if (user) {
            user.storageUsed = Math.max(0, (user.storageUsed || 0) - file.size);
        }

        // Eliminar de DB
        db.files.splice(fileIndex, 1);
        writeDB(db);

        res.json({ success: true, message: "Archivo eliminado permanentemente" });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: "Error al eliminar archivo" });
    }
});

// Vaciar papelera
app.delete("/trash/empty", (req, res) => {
    try {
        const db = readDB();
        const userFiles = db.files.filter(f => f.userId === req.user.id && f.inTrash);

        let deletedCount = 0;
        const user = db.users.find(u => u.id === req.user.id);

        userFiles.forEach(file => {
            const filePath = path.join(__dirname, 'uploads', file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            if (user) {
                user.storageUsed = Math.max(0, (user.storageUsed || 0) - file.size);
            }

            const index = db.files.findIndex(f => f.id === file.id);
            if (index !== -1) {
                db.files.splice(index, 1);
                deletedCount++;
            }
        });

        writeDB(db);
        res.json({ success: true, message: `Papelera vaciada (${deletedCount} archivos eliminados)` });
    } catch (error) {
        res.status(500).json({ error: "Error al vaciar papelera" });
    }
});

// Info de carpeta (para eliminación)
app.get("/folders/:id/info", (req, res) => {
    try {
        const folderId = parseInt(req.params.id);
        const db = readDB();

        const folder = db.folders.find(f => f.id === folderId && f.userId === req.user.id);
        if (!folder) {
            return res.status(404).json({ error: "Carpeta no encontrada" });
        }

        // Contar contenido recursivamente (simple)
        const filesInFolder = db.files.filter(f => f.folderId === folderId && f.userId === req.user.id);
        const subfolders = db.folders.filter(f => f.parentId === folderId && f.userId === req.user.id);

        res.json({
            folder,
            stats: {
                files: filesInFolder.length,
                subfolders: subfolders.length,
                totalItems: filesInFolder.length + subfolders.length
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener info de carpeta" });
    }
});

// Eliminar carpeta vacía
app.delete("/folders/:id", (req, res) => {
    try {
        const folderId = parseInt(req.params.id);
        const db = readDB();

        const folderIndex = db.folders.findIndex(f => f.id === folderId && f.userId === req.user.id);
        if (folderIndex === -1) {
            return res.status(404).json({ error: "Carpeta no encontrada" });
        }

        // Verificar si está vacía
        const hasFiles = db.files.some(f => f.folderId === folderId);
        const hasSubfolders = db.folders.some(f => f.parentId === folderId);

        if (hasFiles || hasSubfolders) {
            return res.status(400).json({ error: "La carpeta no está vacía" });
        }

        db.folders.splice(folderIndex, 1);
        writeDB(db);

        res.json({ success: true, message: "Carpeta eliminada" });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar carpeta" });
    }
});

// Eliminar carpeta forzada (con contenido)
app.delete("/folders/:id/force", (req, res) => {
    try {
        const folderId = parseInt(req.params.id);
        const db = readDB();

        // Función recursiva para obtener todos los IDs de carpetas a eliminar
        const getFolderIdsToDelete = (rootId) => {
            const ids = [rootId];
            const subfolders = db.folders.filter(f => f.parentId === rootId);
            subfolders.forEach(sub => {
                ids.push(...getFolderIdsToDelete(sub.id));
            });
            return ids;
        };

        const folderIds = getFolderIdsToDelete(folderId);

        // Mover archivos a papelera
        let filesMoved = 0;
        db.files.forEach(file => {
            if (folderIds.includes(file.folderId) && file.userId === req.user.id) {
                file.inTrash = true;
                file.trashedAt = new Date().toISOString();
                filesMoved++;
            }
        });

        // Eliminar carpetas
        const initialFolderCount = db.folders.length;
        db.folders = db.folders.filter(f => !folderIds.includes(f.id));
        const foldersDeleted = initialFolderCount - db.folders.length;

        writeDB(db);

        res.json({
            success: true,
            message: "Carpeta y contenido eliminados",
            details: {
                foldersDeleted,
                filesMovedToTrash: filesMoved
            }
        });
    } catch (error) {
        console.error('Force delete error:', error);
        res.status(500).json({ error: "Error al eliminar carpeta y contenido" });
    }
});

// Ruta de salud
app.get("/health", (req, res) => {
    const db = readDB();
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uploadsDir: fs.existsSync('uploads'),
        totalUsers: db.users.length,
        authenticated: !!req.user,
        user: req.user ? { id: req.user.id, username: req.user.username } : null
    });
});

// Ruta principal
// Ruta principal - servir index.html si está autenticado, sino login.html
app.get("/", (req, res) => {
    // Si no hay usuario autenticado, servir login.html
    if (!req.user) {
        return res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
    // Si está autenticado, servir index.html
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta explícita para index.html
app.get("/index.html", (req, res) => {
    if (!req.user) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para login.html
// Ruta para login.html - siempre accesible
app.get("/login.html", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Manejo de errores
app.use((error, req, res, next) => {
    console.error('Error no manejado:', error);
    res.status(500).json({ error: "Error interno del servidor" });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`📁 Directorio de uploads: ${path.join(__dirname, 'uploads')}`);
    console.log(`💾 Base de datos: ${DB_PATH}`);
    console.log(`🔐 Sistema de autenticación activado`);

    // Inicializar y verificar base de datos
    const db = readDB();
    console.log(`📊 Usuarios en base de datos: ${db.users.length}`);
    db.users.forEach(user => {
        console.log(`   👤 ${user.username} (ID: ${user.id})`);
    });

    console.log(`\n👤 Credenciales de demostración:`);
    console.log(`   Usuario: admin`);
    console.log(`   Contraseña: admin123`);
    console.log(`\n🔗 Acceso rápido:`);
    console.log(`   http://localhost:${PORT}/login.html`);
    console.log(`   http://localhost:${PORT}/health`);
    console.log(`   http://localhost:${PORT}/auth/debug`);
});