const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db'); // Make sure you have this file set up to export your db connection

const router = express.Router();

// Admin Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Replace with your own admin validation logic
    if (username === 'Shahfaisal' && password === 'adminpassword') {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// Fetch new registered students
router.get('/new-students', (req, res) => {
    const query = 'SELECT * FROM newRegStud';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching new students:', err);
            res.status(500).json({ error: 'Failed to fetch new students' });
        } else {
            res.json(results);
        }
    });
});

// Accept a student
router.post('/accept-student', async (req, res) => {
    const { studentId } = req.body;

    const querySelect = 'SELECT * FROM newRegStud WHERE id = ?';
    db.query(querySelect, [studentId], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).json({ error: 'Failed to fetch student' });
        }

        const student = results[0];

        const queryInsert = `INSERT INTO users (firstName, lastName, email, password, mobileNumber, registrationDate) VALUES (?, ?, ?, ?, ?, ?)`;
        db.query(queryInsert, [student.firstName, student.lastName, student.email, student.password, student.mobileNumber, student.registrationDate], (err, result) => {
            if (err) {
                console.error('Error inserting student into user:', err);
                return res.status(500).json({ error: 'Failed to accept student' });
            }

            const queryDelete = 'DELETE FROM newRegStud WHERE id = ?';
            db.query(queryDelete, [studentId], (err, result) => {
                if (err) {
                    console.error('Error deleting student from newRegStud:', err);
                    return res.status(500).json({ error: 'Failed to delete student from newRegStud' });
                }
                res.json({ success: true });
            });
        });
    });
});

module.exports = router;
