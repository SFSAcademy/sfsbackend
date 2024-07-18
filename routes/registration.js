const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db'); 

const router = express.Router();

router.post('/register', async (req, res) => {
    const { firstName, lastName, email, mobileNumber, password} = req.body;

    try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const currentDate = new Date();

    // if (password !== confirmPassword) {
    //     return res.status(400).json({ error: "Passwords do not match" });
    // }

    const query = `INSERT INTO newRegStud (firstName, lastName, email, mobileNumber, password, registrationDate) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(query, [firstName, lastName, email, mobileNumber, hashedPassword, currentDate], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            res.status(500).json({ error: "Registration failed" });
        } else {
            res.status(201).json({ message: "Registration successful" });
        }
    });
} catch (error) {
    console.error('Error in hashing password:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;

    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid email or password.' });
        }

        const user = results[0];

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, message: 'Invalid email or password.' });
        }
    });
});

module.exports = router;