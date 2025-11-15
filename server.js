const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

const FILES_DIR = path.join(__dirname, 'files');

// Middleware CORS essentiel pour le launcher
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Route statique pour servir les fichiers
app.use('/files', express.static(FILES_DIR, {
    index: false,
    setHeaders: (res, path) => {
        res.set('Cache-Control', 'no-cache');
    }
}));

// Route pour lister les fichiers d'une instance (comme le launcher l'attend)
app.get('/files/', (req, res) => {
    const instance = req.query.instance;

    if (!instance) {
        return res.status(400).json({
            error: 'Missing instance parameter',
            usage: '/files/?instance=instance-name'
        });
    }

    const instancePath = path.join(FILES_DIR, instance);

    if (!fs.existsSync(instancePath)) {
        return res.status(404).json({
            error: 'Instance not found',
            instance: instance,
            available: getAvailableInstances()
        });
    }

    try {
        const files = getAllFiles(instancePath, instance);
        res.json(files);
    } catch (error) {
        res.status(500).json({
            error: 'Error reading instance files',
            message: error.message
        });
    }
});

// Route pour afficher le contenu d'un fichier
app.get('/view', (req, res) => {
    const instance = req.query.instance;
    const filepath = req.query.file;

    if (!instance || !filepath) {
        return res.status(400).send('Paramètres manquants: instance et file requis');
    }

    const filePath = path.join(FILES_DIR, instance, filepath);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Fichier non trouvé');
    }

    try {
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            return res.redirect(`/explorer?instance=${instance}&path=${filepath}`);
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const extension = path.extname(filePath).toLowerCase();
        
        res.send(generateFileViewerHTML(instance, filepath, content, extension));
    } catch (error) {
        res.status(500).send(`Erreur de lecture: ${error.message}`);
    }
});

// Route pour l'explorateur de fichiers détaillé
app.get('/explorer', (req, res) => {
    const instance = req.query.instance || 'Terra-Survieval-World';
    const subpath = req.query.path || '';
    
    const instancePath = path.join(FILES_DIR, instance);
    const currentPath = path.join(instancePath, subpath);

    if (!fs.existsSync(instancePath)) {
        return res.send(`
            <html>
            <head><title>Instance non trouvée</title></head>
            <body>
                <div class="container">
                    <h1>❌ Instance non trouvée</h1>
                    <p>L'instance <strong>${instance}</strong> n'existe pas.</p>
                    <a href="/">Retour à l'accueil</a>
                </div>
            </body>
            </html>
        `);
    }

    if (!fs.existsSync(currentPath)) {
        return res.send(`
            <html>
            <head><title>Chemin non trouvé</title></head>
            <body>
                <div class="container">
                    <h1>❌ Chemin non trouvé</h1>
                    <p>Le chemin <strong>${subpath}</strong> n'existe pas dans l'instance ${instance}.</p>
                    <a href="/explorer?instance=${instance}">Retour à la racine</a>
                </div>
            </body>
            </html>
        `);
    }

    try {
        const stats = fs.statSync(currentPath);
        if (stats.isDirectory()) {
            const files = getDirectoryContents(currentPath, instance, subpath);
            res.send(generateExplorerHTML(instance, subpath, files));
        } else {
            // Si c'est un fichier, afficher son contenu
            const content = fs.readFileSync(currentPath, 'utf8');
            const extension = path.extname(currentPath).toLowerCase();
            res.send(generateFileViewerHTML(instance, subpath, content, extension));
        }
    } catch (error) {
        res.status(500).send(`
            <html>
            <head><title>Erreur</title></head>
            <body>
                <div class="container">
                    <h1>❌ Erreur</h1>
                    <p>${error.message}</p>
                    <a href="/">Retour à l'accueil</a>
                </div>
            </body>
            </html>
        `);
    }
});

// Route pour télécharger des fichiers
app.get('/download', (req, res) => {
    const instance = req.query.instance;
    const filepath = req.query.file;

    if (!instance || !filepath) {
        return res.status(400).send('Paramètres manquants');
    }

    const filePath = path.join(FILES_DIR, instance, filepath);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Fichier non trouvé');
    }

    res.download(filePath);
});

// Page d'accueil avec explorateur
app.get('/', (req, res) => {
    if (!fs.existsSync(FILES_DIR)) {
        fs.mkdirSync(FILES_DIR, { recursive: true });
    }

    const instances = getAvailableInstances();
    
    res.send(generateHomeHTML(instances));
});

// Fonction pour générer la page d'accueil
function generateHomeHTML(instances) {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🚀 Terra File Server</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #2c3e50, #34495e);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .content {
            padding: 30px;
        }
        
        .section {
            margin-bottom: 30px;
            padding: 25px;
            background: #f8f9fa;
            border-radius: 10px;
            border-left: 4px solid #3498db;
        }
        
        .section h2 {
            color: #2c3e50;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .instances-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .instance-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            border: 2px solid #e9ecef;
            transition: all 0.3s ease;
            cursor: pointer;
        }
        
        .instance-card:hover {
            transform: translateY(-5px);
            border-color: #3498db;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        }
        
        .instance-card h3 {
            color: #2c3e50;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .instance-info {
            display: flex;
            justify-content: space-between;
            color: #6c757d;
            font-size: 0.9em;
            margin-top: 10px;
        }
        
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            transition: background 0.3s ease;
            border: none;
            cursor: pointer;
            margin: 5px;
        }
        
        .btn:hover {
            background: #2980b9;
        }
        
        .btn-success {
            background: #27ae60;
        }
        
        .btn-success:hover {
            background: #219a52;
        }
        
        .endpoints {
            background: #2c3e50;
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
        }
        
        .endpoint-item {
            background: #34495e;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
        }
        
        .file-structure {
            background: white;
            padding: 15px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            line-height: 1.6;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Terra File Server</h1>
            <p>Serveur de fichiers pour Terra Survival Launcher</p>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>📊 Instances Disponibles</h2>
                ${instances.length === 0 ? `
                    <div class="empty-state">
                        <div>📁</div>
                        <h3>Aucune instance trouvée</h3>
                        <p>Créez le dossier : <code>files/Terra-Survieval-World/</code></p>
                    </div>
                ` : `
                    <div class="instances-grid">
                        ${instances.map(instance => {
                            const instancePath = path.join(FILES_DIR, instance);
                            const fileCount = countFiles(instancePath);
                            const size = calculateFolderSize(instancePath);
                            
                            return `
                                <div class="instance-card" onclick="openExplorer('${instance}')">
                                    <h3>📦 ${instance}</h3>
                                    <p>Instance Minecraft</p>
                                    <div class="instance-info">
                                        <span>${fileCount} fichiers</span>
                                        <span>${formatSize(size)}</span>
                                    </div>
                                    <div style="margin-top: 15px;">
                                        <button class="btn" onclick="event.stopPropagation(); openExplorer('${instance}')">Explorer</button>
                                        <button class="btn btn-success" onclick="event.stopPropagation(); openJsonView('${instance}')">JSON API</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
            
            <div class="section">
                <h2>🔗 Endpoints API</h2>
                <div class="endpoints">
                    <div class="endpoint-item">GET /files/?instance=Terra-Survieval-World</div>
                    <div class="endpoint-item">GET /explorer?instance=Terra-Survieval-World</div>
                    <div class="endpoint-item">GET /view?instance=X&file=chemin/fichier</div>
                    <div class="endpoint-item">GET /download?instance=X&file=chemin/fichier</div>
                </div>
            </div>
            
            <div class="section">
                <h2>📁 Fichiers Exemples</h2>
                <div class="file-structure">
files/
├── instances.json
├── launcher/
│   ├── news-launcher/
│   │   └── news.json
│   └── config-launcher/
│       └── config.json
└── Terra-Survieval-World/
    ├── mods/
    ├── config/
    ├── resourcepacks/
    └── saves/
                </div>
            </div>
        </div>
    </div>

    <script>
        function openExplorer(instance) {
            window.open('/explorer?instance=' + encodeURIComponent(instance), '_blank');
        }
        
        function openJsonView(instance) {
            window.open('/files/?instance=' + encodeURIComponent(instance), '_blank');
        }
    </script>
</body>
</html>`;
}

// Fonction pour générer l'explorateur de fichiers
function generateExplorerHTML(instance, currentPath, files) {
    const breadcrumbs = generateBreadcrumbs(instance, currentPath);
    
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Explorateur - ${instance}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            color: #333;
        }
        
        .header {
            background: #2c3e50;
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .breadcrumb {
            background: #34495e;
            padding: 15px 20px;
            color: white;
            font-size: 0.9em;
        }
        
        .breadcrumb a {
            color: #3498db;
            text-decoration: none;
        }
        
        .breadcrumb a:hover {
            text-decoration: underline;
        }
        
        .container {
            padding: 20px;
            max-width: 1000px;
            margin: 0 auto;
        }
        
        .file-list {
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .file-item {
            display: flex;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 1px solid #eee;
            transition: background 0.2s ease;
        }
        
        .file-item:hover {
            background: #f8f9fa;
        }
        
        .file-item:last-child {
            border-bottom: none;
        }
        
        .file-icon {
            font-size: 1.5em;
            margin-right: 15px;
            width: 30px;
            text-align: center;
        }
        
        .file-info {
            flex: 1;
        }
        
        .file-name {
            font-weight: 500;
            margin-bottom: 5px;
        }
        
        .file-details {
            font-size: 0.8em;
            color: #6c757d;
            display: flex;
            gap: 15px;
        }
        
        .file-actions {
            display: flex;
            gap: 10px;
        }
        
        .btn {
            padding: 5px 10px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 3px;
            font-size: 0.8em;
            border: none;
            cursor: pointer;
        }
        
        .btn:hover {
            background: #2980b9;
        }
        
        .btn-success {
            background: #27ae60;
        }
        
        .btn-success:hover {
            background: #219a52;
        }
        
        .empty-folder {
            text-align: center;
            padding: 40px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📁 Explorateur - ${instance}</h1>
        <a href="/" class="btn">Accueil</a>
    </div>
    
    <div class="breadcrumb">
        ${breadcrumbs}
    </div>
    
    <div class="container">
        <div class="file-list">
            ${files.length === 0 ? `
                <div class="empty-folder">
                    <div style="font-size: 3em; margin-bottom: 20px;">📂</div>
                    <h3>Dossier vide</h3>
                    <p>Ce dossier ne contient aucun fichier</p>
                </div>
            ` : files.map(file => `
                <div class="file-item">
                    <div class="file-icon">
                        ${file.type === 'directory' ? '📁' : getFileIcon(file.name)}
                    </div>
                    <div class="file-info">
                        <div class="file-name">
                            ${file.type === 'directory' ? 
                                `<a href="/explorer?instance=${instance}&path=${encodeURIComponent(file.fullPath)}" style="color: #2c3e50; text-decoration: none;">
                                    ${file.name}
                                </a>` : 
                                `<a href="/view?instance=${instance}&file=${encodeURIComponent(file.fullPath)}" style="color: #2c3e50; text-decoration: none;">
                                    ${file.name}
                                </a>`
                            }
                        </div>
                        <div class="file-details">
                            <span>${file.type === 'directory' ? 'Dossier' : 'Fichier'}</span>
                            <span>${file.size}</span>
                            <span>${file.modified || ''}</span>
                        </div>
                    </div>
                    <div class="file-actions">
                        ${file.type === 'file' ? 
                            `<a href="/view?instance=${instance}&file=${encodeURIComponent(file.fullPath)}" class="btn">Voir</a>
                             <a href="/download?instance=${instance}&file=${encodeURIComponent(file.fullPath)}" class="btn btn-success">Télécharger</a>` : 
                            `<a href="/explorer?instance=${instance}&path=${encodeURIComponent(file.fullPath)}" class="btn">Ouvrir</a>`
                        }
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
}

// Fonction pour générer la visionneuse de fichiers
function generateFileViewerHTML(instance, filepath, content, extension) {
    const highlightedContent = highlightSyntax(content, extension);
    
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${filepath} - ${instance}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            color: #333;
        }
        
        .header {
            background: #2c3e50;
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .breadcrumb {
            background: #34495e;
            padding: 15px 20px;
            color: white;
            font-size: 0.9em;
        }
        
        .breadcrumb a {
            color: #3498db;
            text-decoration: none;
        }
        
        .container {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .file-header {
            background: white;
            padding: 20px;
            border-radius: 10px 10px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #eee;
        }
        
        .file-content {
            background: #1e1e1e;
            color: #d4d4d4;
            border-radius: 0 0 10px 10px;
            overflow: auto;
            max-height: 70vh;
        }
        
        pre {
            margin: 0;
            padding: 20px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
            tab-size: 4;
        }
        
        .btn {
            padding: 8px 16px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            border: none;
            cursor: pointer;
            margin-left: 10px;
        }
        
        .btn:hover {
            background: #2980b9;
        }
        
        .btn-success {
            background: #27ae60;
        }
        
        .btn-success:hover {
            background: #219a52;
        }
        
        /* Syntax Highlighting */
        .json-key { color: #9cdcfe; }
        .json-string { color: #ce9178; }
        .json-number { color: #b5cea8; }
        .json-boolean { color: #569cd6; }
        .json-null { color: #569cd6; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📄 ${filepath}</h1>
        <div>
            <a href="/explorer?instance=${instance}&path=${encodeURIComponent(path.dirname(filepath))}" class="btn">Retour</a>
            <a href="/download?instance=${instance}&file=${encodeURIComponent(filepath)}" class="btn btn-success">Télécharger</a>
        </div>
    </div>
    
    <div class="breadcrumb">
        Instance: <strong>${instance}</strong> | 
        Chemin: <strong>${filepath}</strong> | 
        Taille: <strong>${formatSize(Buffer.byteLength(content, 'utf8'))}</strong> |
        Type: <strong>${extension}</strong>
    </div>
    
    <div class="container">
        <div class="file-header">
            <h3>Contenu du fichier</h3>
            <span>${content.split('\n').length} lignes</span>
        </div>
        <div class="file-content">
            <pre>${highlightedContent}</pre>
        </div>
    </div>
</body>
</html>`;
}

// Fonction pour la coloration syntaxique basique
function highlightSyntax(content, extension) {
    if (extension === '.json') {
        try {
            const parsed = JSON.parse(content);
            const formatted = JSON.stringify(parsed, null, 2);
            return formatted
                .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
                    if (/:$/.test(match)) {
                        return `<span class="json-key">${match}</span>`;
                    } else if (/^"/.test(match)) {
                        return `<span class="json-string">${match}</span>`;
                    }
                    return match;
                })
                .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
                .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
                .replace(/\b(\d+\.?\d*)\b/g, '<span class="json-number">$1</span>');
        } catch (e) {
            return content; // Retourne le contenu original si JSON invalide
        }
    }
    
    // Échapper le HTML pour les autres types de fichiers
    return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ... (les autres fonctions utilitaires restent les mêmes)

function getDirectoryContents(currentPath, instance, subpath) {
    const items = fs.readdirSync(currentPath);
    const files = [];

    items.forEach(item => {
        if (item.startsWith('.')) return;

        const fullPath = path.join(currentPath, item);
        const relativePath = subpath ? path.join(subpath, item) : item;
        const stat = fs.statSync(fullPath);

        files.push({
            name: item,
            type: stat.isDirectory() ? 'directory' : 'file',
            size: formatSize(stat.size),
            modified: stat.mtime.toLocaleString(),
            fullPath: relativePath
        });
    });

    // Trier: dossiers d'abord, puis fichiers
    return files.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
}

function generateBreadcrumbs(instance, currentPath) {
    const parts = currentPath.split(path.sep).filter(p => p);
    let breadcrumb = `<a href="/explorer?instance=${instance}">racine</a>`;
    
    let accumulatedPath = '';
    parts.forEach(part => {
        accumulatedPath = accumulatedPath ? path.join(accumulatedPath, part) : part;
        breadcrumb += ` / <a href="/explorer?instance=${instance}&path=${encodeURIComponent(accumulatedPath)}">${part}</a>`;
    });
    
    return breadcrumb;
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'txt': '📄', 'json': '📋', 'xml': '📋', 'js': '📜',
        'jar': '⚙️', 'zip': '📦', 'rar': '📦',
        'png': '🖼️', 'jpg': '🖼️', 'jpeg': '🖼️', 'gif': '🖼️'
    };
    return icons[ext] || '📄';
}

function getAllFiles(dir, basePath = '') {
    const results = [];
    
    function scanDirectory(currentDir, relativePath) {
        const items = fs.readdirSync(currentDir);
        
        items.forEach(item => {
            if (item.startsWith('.')) return;
            
            const fullPath = path.join(currentDir, item);
            const relPath = relativePath ? path.join(relativePath, item) : item;
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                results.push({
                    type: 'directory',
                    name: item,
                    path: relPath,
                    size: 0
                });
                scanDirectory(fullPath, relPath);
            } else {
                results.push({
                    type: 'file',
                    name: item,
                    path: relPath,
                    size: stat.size,
                    modified: stat.mtime
                });
            }
        });
    }
    
    scanDirectory(dir, '');
    return results;
}

function getAvailableInstances() {
    if (!fs.existsSync(FILES_DIR)) {
        return [];
    }
    
    try {
        return fs.readdirSync(FILES_DIR, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
    } catch (error) {
        return [];
    }
}

function countFiles(dir) {
    if (!fs.existsSync(dir)) return 0;
    
    let count = 0;
    
    function countRecursive(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        items.forEach(item => {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                countRecursive(fullPath);
            } else {
                count++;
            }
        });
    }
    
    countRecursive(dir);
    return count;
}

function calculateFolderSize(dir) {
    if (!fs.existsSync(dir)) return 0;
    
    let totalSize = 0;
    
    function calculateRecursive(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        items.forEach(item => {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                calculateRecursive(fullPath);
            } else {
                totalSize += stat.size;
            }
        });
    }
    
    calculateRecursive(dir);
    return totalSize;
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initialisation
function initializeStructure() {
    if (!fs.existsSync(FILES_DIR)) {
        console.log('📁 Creating files directory...');
        fs.mkdirSync(FILES_DIR, { recursive: true });
    }
}

// Fonction pour générer la visionneuse de fichiers
function generateFileViewerHTML(instance, filepath, content, extension) {
    const highlightedContent = highlightSyntax(content, extension);
    
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${filepath} - ${instance}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            color: #333;
        }
        
        .header {
            background: #2c3e50;
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .breadcrumb {
            background: #34495e;
            padding: 15px 20px;
            color: white;
            font-size: 0.9em;
        }
        
        .breadcrumb a {
            color: #3498db;
            text-decoration: none;
        }
        
        .container {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .file-header {
            background: white;
            padding: 20px;
            border-radius: 10px 10px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #eee;
        }
        
        .file-content {
            background: #1e1e1e;
            color: #d4d4d4;
            border-radius: 0 0 10px 10px;
            overflow: auto;
            max-height: 70vh;
        }
        
        pre {
            margin: 0;
            padding: 20px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
            tab-size: 4;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .btn {
            padding: 8px 16px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            border: none;
            cursor: pointer;
            margin-left: 10px;
        }
        
        .btn:hover {
            background: #2980b9;
        }
        
        .btn-success {
            background: #27ae60;
        }
        
        .btn-success:hover {
            background: #219a52;
        }
        
        /* Syntax Highlighting */
        .json-key { color: #9cdcfe; }
        .json-string { color: #ce9178; }
        .json-number { color: #b5cea8; }
        .json-boolean { color: #569cd6; }
        .json-null { color: #569cd6; }
        
        /* Raw content styling */
        .raw-content {
            background: white;
            color: #333;
            border: 1px solid #ddd;
        }
        
        .toggle-buttons {
            margin-bottom: 10px;
        }
        
        .toggle-btn {
            padding: 5px 10px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            margin-right: 5px;
        }
        
        .toggle-btn.active {
            background: #3498db;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📄 ${filepath}</h1>
        <div>
            <a href="/explorer?instance=${instance}&path=${encodeURIComponent(path.dirname(filepath))}" class="btn">Retour</a>
            <a href="/download?instance=${instance}&file=${encodeURIComponent(filepath)}" class="btn btn-success">Télécharger</a>
        </div>
    </div>
    
    <div class="breadcrumb">
        Instance: <strong>${instance}</strong> | 
        Chemin: <strong>${filepath}</strong> | 
        Taille: <strong>${formatSize(Buffer.byteLength(content, 'utf8'))}</strong> |
        Type: <strong>${extension}</strong>
    </div>
    
    <div class="container">
        <div class="file-header">
            <h3>Contenu du fichier</h3>
            <span>${content.split('\n').length} lignes</span>
        </div>
        
        <div class="toggle-buttons">
            <button class="toggle-btn active" onclick="showView('raw')">Vue Brut</button>
            <button class="toggle-btn" onclick="showView('highlighted')">Vue Colorée</button>
        </div>
        
        <div id="raw-view" class="file-content raw-content">
            <pre>${content}</pre>
        </div>
        
        <div id="highlighted-view" class="file-content" style="display: none;">
            <pre>${highlightedContent}</pre>
        </div>
    </div>

    <script>
        function showView(viewType) {
            // Mettre à jour les boutons
            document.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Afficher/masquer les vues
            if (viewType === 'raw') {
                document.getElementById('raw-view').style.display = 'block';
                document.getElementById('highlighted-view').style.display = 'none';
            } else {
                document.getElementById('raw-view').style.display = 'none';
                document.getElementById('highlighted-view').style.display = 'block';
            }
        }
    </script>
</body>
</html>`;
}

// Fonction pour la coloration syntaxique basique
function highlightSyntax(content, extension) {
    // Pour la vue brute, on retourne le contenu sans modifications
    // La coloration est gérée côté client maintenant
    
    if (extension === '.json') {
        try {
            const parsed = JSON.parse(content);
            const formatted = JSON.stringify(parsed, null, 2);
            return formatted
                .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
                    if (/:$/.test(match)) {
                        return `<span class="json-key">${match}</span>`;
                    } else if (/^"/.test(match)) {
                        return `<span class="json-string">${match}</span>`;
                    }
                    return match;
                })
                .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
                .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
                .replace(/\b(\d+\.?\d*)\b/g, '<span class="json-number">$1</span>');
        } catch (e) {
            return content; // Retourne le contenu original si JSON invalide
        }
    }
    
    // Pour les autres fichiers, échapper le HTML
    return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

app.listen(port, () => {
    console.log(`🚀 Terra File Server running on http://localhost:${port}`);
    console.log(`📁 Serving files from: ${FILES_DIR}`);
    console.log(`🌐 CORS enabled for all origins`);
    console.log(`📊 Explorer available at: http://localhost:${port}/explorer`);
    console.log(`👀 File viewer available at: http://localhost:${port}/view`);
    
    initializeStructure();
    
    const instances = getAvailableInstances();
    console.log(`📦 Available instances: ${instances.join(', ')}`);
});
