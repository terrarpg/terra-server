const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Dossier contenant les fichiers du launcher
const FILES_DIR = path.join(__dirname, 'files');

// Fonction pour créer un hash pour chaque fichier
function getFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha1');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

// Route API → utilisée par le launcher
app.get('/files', (req, res) => {
    const instance = req.query.instance;

    if (!instance) {
        return res.status(400).json({ error: "instance not specified" });
    }

    // Scan dossier /files/INSTANCE/
    const instancePath = path.join(FILES_DIR, instance);

    if (!fs.existsSync(instancePath)) {
        return res.status(404).json({ error: "Instance not found" });
    }

    const fileList = [];

    function scanDirectory(dir, baseDir = '') {
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const relativePath = path.join(baseDir, file);

            if (fs.statSync(fullPath).isDirectory()) {
                scanDirectory(fullPath, relativePath);
            } else {
                fileList.push({
                    path: relativePath.replace(/\\/g, '/'),
                    hash: getFileHash(fullPath)
                });
            }
        });
    }

    scanDirectory(instancePath);

    res.json({
        instance: instance,
        files: fileList
    });
});

// Route de test
app.get('/', (req, res) => {
    res.send('Terra File Server ONLINE');
});

app.listen(PORT, () => {
    console.log(`Server running on PORT ${PORT}`);
});
