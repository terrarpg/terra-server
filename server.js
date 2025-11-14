const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

// Route API /files pour le launcher
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
            const relativePath = fullPath.replace(instancePath, "").replace(/\\/g, "/");

            if (fs.statSync(fullPath).isDirectory()) {
                walk(fullPath);
            } else {
                files.push({
                    path: relativePath,
                    url: `https://terra-server-lfgc.onrender.com/static/${instance}${relativePath}`
                });
            }
        });
    }

    walk(instancePath);

    res.json({ files });
});

// Servir les fichiers Minecraft
app.use("/static", express.static(path.join(__dirname, "instances")));

app.get("/", (req, res) => {
    res.send("Terra File Server OK — API /files opérationnelle");
});

app.listen(port, () => {
    console.log(`File server running on port ${port}`);
});
