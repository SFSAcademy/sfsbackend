const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const crypto = require('crypto');
require('dotenv').config();

const router = express.Router();

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL, // Your email
        pass: process.env.EMAIL_PASSWORD, // Your email password
    },
});

router.post('/register', async (req, res) => {
    const { firstName, lastName, email, mobileNumber, password} = req.body;

    try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const currentDate = new Date();

    // if (password !== confirmPassword) {
    //     return res.status(400).json({ error: "Passwords do not match" });
    // }

    const query = `INSERT INTO newregstud (firstName, lastName, email, mobileNumber, password, registrationDate) VALUES (?, ?, ?, ?, ?, ?)`;
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
            const token1 = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET_STUD, { expiresIn: '12h' });
            res.json({ success: true, token1 });
        } else {
            res.status(400).json({ success: false, message: 'Invalid email or password.' });
        }
    });
});

router.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ success: false, message: 'Email not found.' });
        }

        const user = results[0];
        const token3 = crypto.randomBytes(20).toString('hex');
        const resetPasswordToken = token3;
        const resetPasswordExpires = Date.now() + 3600000; // 1 hour

        const updateQuery = 'UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?';
        db.query(updateQuery, [resetPasswordToken, resetPasswordExpires, email], (updateErr) => {
            if (updateErr) {
                return res.status(500).json({ success: false, message: 'Error updating user with reset token.' });
            }

            const mailOptions = {
                to: email,
                from: process.env.EMAIL,
                subject: 'Password Reset',
                text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
                    Please click on the following link, or paste this into your browser to complete the process:\n\n
                    https://sfsacademy.in/reset-password/${token3}\n\n
                    If you did not request this, please ignore this email and your password will remain unchanged.\n`,
            };
            console.log(`https://sfsacademy.in/reset-password?token3=${token3}`)
            transporter.sendMail(mailOptions, (mailErr) => {
                if (mailErr) {
                    console.error('Error sending email:', mailErr);
                    return res.status(500).json({ success: false, message: 'Error sending reset email.' });
                }
                res.json({ success: true, message: 'Password reset email sent.' });
            });
        });
    });
});

router.post('/reset-password', async (req, res) => {
    const { token3, password } = req.body;
    console.log(token3)
    const query = 'SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?';
    db.query(query, [token3, Date.now()], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ success: false, message: 'Password reset token is invalid or has expired.' });
        }

        const user = results[0];
        const hashedPassword = await bcrypt.hash(password, 10);
        const updateQuery = 'UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?';

        db.query(updateQuery, [hashedPassword, user.id], (updateErr) => {
            if (updateErr) {
                return res.status(500).json({ success: false, message: 'Error updating password.' });
            }
            res.json({ success: true, message: 'Password updated successfully.' });
        });
    });
});


module.exports = router;
