const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware CORS pour autoriser les requêtes cross-origin
app.use(cors());

// Middleware pour parser le JSON
app.use(express.json());

// Middleware pour logger les requêtes
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

// Servir les fichiers static avec configuration étendue
app.use('/files', express.static(path.join(__dirname, 'files'), {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res, filePath) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('X-Content-Type-Options', 'nosniff');
        
        // Headers de cache pour les fichiers
        if (filePath.includes('.jar') || filePath.includes('.zip')) {
            res.set('Cache-Control', 'public, max-age=3600'); // 1 heure pour les archives
        } else {
            res.set('Cache-Control', 'public, max-age=300'); // 5 minutes pour les autres fichiers
        }
    }
}));

// Route pour lister les instances disponibles
app.get('/instances', (req, res) => {
    const filesPath = path.join(__dirname, 'files');
    
    if (!fs.existsSync(filesPath)) {
        return res.status(404).json({
            error: 'Files directory not found',
            path: filesPath
        });
    }
    
    try {
        const instances = fs.readdirSync(filesPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => ({
                name: dirent.name,
                path: `/files/${dirent.name}`,
                created: fs.statSync(path.join(filesPath, dirent.name)).birthtime
            }));
        
        res.json({
            success: true,
            instances: instances,
            count: instances.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error reading instances directory',
            message: error.message
        });
    }
});

// Route pour obtenir les informations d'une instance spécifique
app.get('/files/:instance', (req, res) => {
    const instanceName = req.params.instance;
    const instancePath = path.join(__dirname, 'files', instanceName);
    
    if (!fs.existsSync(instancePath)) {
        return res.status(404).json({
            success: false,
            error: 'Instance not found',
            instance: instanceName,
            availableInstances: getAvailableInstances()
        });
    }
    
    try {
        const instanceStats = fs.statSync(instancePath);
        const files = listFilesRecursive(instancePath);
        
        res.json({
            success: true,
            instance: {
                name: instanceName,
                path: instancePath,
                created: instanceStats.birthtime,
                modified: instanceStats.mtime,
                size: calculateTotalSize(instancePath),
                fileCount: files.length,
                files: files
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error reading instance files',
            message: error.message,
            instance: instanceName
        });
    }
});

// Route pour télécharger un fichier spécifique
app.get('/files/:instance/*', (req, res) => {
    const instanceName = req.params.instance;
    const filePath = req.params[0]; // Le reste du chemin après l'instance
    const fullPath = path.join(__dirname, 'files', instanceName, filePath);
    
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({
            success: false,
            error: 'File not found',
            instance: instanceName,
            file: filePath
        });
    }
    
    try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
            return res.status(400).json({
                success: false,
                error: 'Path is a directory, not a file',
                instance: instanceName,
                path: filePath
            });
        }
        
        res.sendFile(fullPath);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error serving file',
            message: error.message
        });
    }
});

// Route pour créer une nouvelle instance (POST)
app.post('/instances/:instance', (req, res) => {
    const instanceName = req.params.instance;
    const instancePath = path.join(__dirname, 'files', instanceName);
    
    if (fs.existsSync(instancePath)) {
        return res.status(409).json({
            success: false,
            error: 'Instance already exists',
            instance: instanceName
        });
    }
    
    try {
        fs.mkdirSync(instancePath, { recursive: true });
        
        // Créer une structure de base si nécessaire
        const subdirs = ['mods', 'config', 'resourcepacks', 'shaderpacks', 'saves'];
        subdirs.forEach(dir => {
            fs.mkdirSync(path.join(instancePath, dir), { recursive: true });
        });
        
        res.status(201).json({
            success: true,
            message: 'Instance created successfully',
            instance: instanceName,
            path: instancePath,
            created: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error creating instance',
            message: error.message
        });
    }
});

// Route de santé du serveur
app.get('/health', (req, res) => {
    const filesPath = path.join(__dirname, 'files');
    const diskInfo = getDiskInfo();
    
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        server: 'Terra File Server',
        version: '1.0.0',
        disk: diskInfo,
        instances: {
            available: getAvailableInstances().length,
            list: getAvailableInstances()
        }
    });
});

// Route racine
app.get('/', (req, res) => {
    res.json({
        message: 'Terra File Server - OK',
        endpoints: {
            instances: '/instances',
            files: '/files/{instance}',
            health: '/health',
            documentation: 'Voir la documentation pour plus de détails'
        },
        version: '1.0.0'
    });
});

// Gestion des routes non trouvées
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        requested: req.originalUrl,
        availableEndpoints: [
            'GET /',
            'GET /health',
            'GET /instances',
            'GET /files/{instance}',
            'POST /instances/{instance}'
        ]
    });
});

// Gestion globale des erreurs
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Fonctions utilitaires
function listFilesRecursive(dir, baseDir = dir) {
    const items = fs.readdirSync(dir);
    const files = [];
    
    items.forEach(item => {
        if (item.startsWith('.')) return; // Ignorer les fichiers cachés
        
        const fullPath = path.join(dir, item);
        const relativePath = path.relative(baseDir, fullPath);
        
        try {
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                files.push({
                    name: item,
                    path: relativePath,
                    type: 'directory',
                    size: stat.size,
                    modified: stat.mtime,
                    children: listFilesRecursive(fullPath, baseDir)
                });
            } else {
                files.push({
                    name: item,
                    path: relativePath,
                    type: 'file',
                    size: stat.size,
                    modified: stat.mtime,
                    extension: path.extname(item)
                });
            }
        } catch (error) {
            console.warn(`Cannot access file: ${fullPath}`, error.message);
        }
    });
    
    return files;
}

function calculateTotalSize(dir) {
    let totalSize = 0;
    
    function calculate(dir) {
        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                calculate(fullPath);
            } else {
                totalSize += stat.size;
            }
        });
    }
    
    calculate(dir);
    return totalSize;
}

function getAvailableInstances() {
    const filesPath = path.join(__dirname, 'files');
    
    if (!fs.existsSync(filesPath)) {
        return [];
    }
    
    try {
        return fs.readdirSync(filesPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
    } catch (error) {
        return [];
    }
}

function getDiskInfo() {
    const filesPath = path.join(__dirname, 'files');
    try {
        const stats = fs.statSync(filesPath);
        // Informations basiques sur le disque
        return {
            totalInstances: getAvailableInstances().length,
            path: filesPath
        };
    } catch (error) {
        return { error: 'Unable to get disk info' };
    }
}

// Initialisation au démarrage
function initializeServer() {
    const filesPath = path.join(__dirname, 'files');
    
    // Créer le dossier files s'il n'existe pas
    if (!fs.existsSync(filesPath)) {
        console.log('📁 Creating files directory...');
        fs.mkdirSync(filesPath, { recursive: true });
        console.log('✅ Files directory created');
    }
    
    // Vérifier les instances existantes
    const instances = getAvailableInstances();
    console.log(`📊 Found ${instances.length} instances:`, instances);
}

// Démarrer le serveur
app.listen(port, () => {
    console.log(`🚀 Terra File Server running on http://localhost:${port}`);
    console.log(`📁 Serving files from: ${path.join(__dirname, 'files')}`);
    console.log(`🌐 CORS enabled for all origins`);
    console.log(`📊 Health check available at: http://localhost:${port}/health`);
    
    initializeServer();
});

module.exports = app;
