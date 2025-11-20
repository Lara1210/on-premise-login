const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const dataDir = path.join(baseDir, 'data');
const uploadsDir = path.join(baseDir, 'uploads');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Creado:', dir);
  } else {
    console.log('Existe:', dir);
  }
}

const initialDB = {
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@drive.com",
      "storageUsed": 0,
      "storageLimit": 10737418240,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "files": [],
  "folders": [
    {
      "id": 1,
      "name": "Mis archivos",
      "parentId": null,
      "userId": 1,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "settings": {
    "maxFileSize": 52428800,
    "allowedTypes": [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".pdf",
      ".doc",
      ".docx",
      ".txt",
      ".mp4",
      ".avi",
      ".mov",
      ".mp3",
      ".wav",
      ".zip",
      ".rar"
    ]
  }
};

try {
  ensureDir(dataDir);
  ensureDir(uploadsDir);

  const dbPath = path.join(dataDir, 'database.json');
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(initialDB, null, 2), 'utf8');
    console.log('Base de datos inicial creada en:', dbPath);
  } else {
    console.log('La base de datos ya existe en:', dbPath);
  }

  console.log('\nInicialización completada. Puedes arrancar el servidor con: node server.js');
  process.exit(0);
} catch (err) {
  console.error('Error durante la inicialización:', err);
  process.exit(1);
}