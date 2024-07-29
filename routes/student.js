const express = require('express');
const jwt = require('jsonwebtoken');
const authenticateJWT1 = require('../middlewares/authenticateJWT');
const db = require('../config/db'); 
require('dotenv').config();

const router = express.Router();

router.get('/notes', authenticateJWT1, (req, res) => {
    const query = 'SELECT * FROM documents';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching documents:', err);
            return res.status(500).json({ error: "Failed to fetch documents" });
        }
        res.json(results);
    });
});

router.get('/videos', authenticateJWT1, (req, res) => {
    const query = 'SELECT * FROM videos';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching videos:', err);
            return res.status(500).json({ error: "Failed to fetch videos" });
        }
        res.json(results);
    });
});

module.exports = router;