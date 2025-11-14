const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

// =============================
//  API OBLIGATOIRE POUR LAUNCHER
// =============================
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
