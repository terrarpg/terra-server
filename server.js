const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

// API /files (obligatoire pour minecraft-java-core)
app.get("/files", (req, res) => {
    const instance = req.query.instance;

    if (!instance) {
        return res.status(400).json({ error: "Missing instance" });
    }

    const instancePath = path.join(__dirname, "instances", instance);

    if (!fs.existsSync(instancePath)) {
        return res.status(404).json({ error: "Instance not found" });
    }

    const files = [];

    function walk(dir) {
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const relative = fullPath.replace(instancePath, "").replace(/\\/g, "/");

            if (fs.statSync(fullPath).isDirectory()) {
                walk(fullPath);
            } else {
                files.push({
                    path: relative,
                    url: `https://terra-server-lfgc.onrender.com/static/${instance}${relative}`
                });
            }
        });
    }

    walk(instancePath);

    res.json({ files });
});

// Fichiers statiques exposés
app.use("/static", express.static(path.join(__dirname, "instances")));

app.get("/", (req, res) => res.send("Terra File Server OK — /files API ready"));

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
