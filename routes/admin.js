const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const authenticateJWT = require('../middlewares/authenticateJWT');
const bcrypt = require('bcrypt');
const db = require('../config/db'); // Make sure you have this file set up to export your db connection
require('dotenv').config();

const router = express.Router();
const app = express();

app.use(bodyParser.json({ limit: '3gb' }));
app.use(bodyParser.urlencoded({ limit: '3gb', extended: true }));

// Admin Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Replace with your own admin validation logic
    if (username === 'Shahfaisal' && password === 'adminpassword') {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token });
    } else {
        res.json({ success: false });
    }
});

// Fetch new registered students
router.get('/new-students', authenticateJWT, (req, res) => {
    const query = 'SELECT * FROM newregstud';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching new students:', err);
            res.status(500).json({ error: 'Failed to fetch new students' });
        } else {
            res.json(results);
        }
    });
});

router.get('/registered-students', authenticateJWT, (req, res) => {
    const query = 'SELECT * FROM users';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching registered students:', err);
            res.status(500).json({ error: 'Failed to fetch new students' });
        } else {
            res.json(results);
        }
    });
});

// Accept a student
router.post('/accept-student', authenticateJWT, async (req, res) => {
    const { studentId } = req.body;

    const querySelect = 'SELECT * FROM newregstud WHERE id = ?';
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

            const queryDelete = 'DELETE FROM newregstud WHERE id = ?';
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

router.post('/remove-student', authenticateJWT, async (req, res) => {
    const { studentId } = req.body;

    const querySelect = 'SELECT * FROM users WHERE id = ?';
    db.query(querySelect, [studentId], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).json({ error: 'Failed to fetch student' });
        }

        const student = results[0];

        const queryInsert = `INSERT INTO oldstudents (firstName, lastName, email, password, mobileNumber, registrationDate) VALUES (?, ?, ?, ?, ?, ?)`;
        db.query(queryInsert, [student.firstName, student.lastName, student.email, student.password, student.mobileNumber, student.registrationDate], (err, result) => {
            if (err) {
                console.error('Error inserting student into user:', err);
                return res.status(500).json({ error: 'Failed to accept student' });
            }
            const queryDelete = 'DELETE FROM users WHERE id = ?';
            db.query(queryDelete, [studentId], (err, result) => {
                if (err) {
                    console.error('Error deleting student from users:', err);
                    return res.status(500).json({ error: 'Failed to delete student from users' });
                }
                res.json({ success: true });
            });
        });
    });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'public_html','uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

router.post('/upload', authenticateJWT, upload.single('document'), (req, res) => {
    const { category, subcategory, documentName } = req.body;
    const filePath = path.join('uploads', req.file.filename);

    const query = `INSERT INTO documents (category, subcategory, document_name, file_path) VALUES (?, ?, ?, ?)`;
    db.query(query, [category, subcategory, documentName, filePath], (err, result) => {
        if (err) {
            console.error('Error inserting document data:', err);
            return res.status(500).json({ error: "Document upload failed" });
        }
        res.status(201).json({ message: "Document uploaded successfully", document: { id: result.insertId, category, subcategory, document_name: documentName, file_path: filePath } });
    });
});

router.get('/documents', authenticateJWT, (req, res) => {
    const query = 'SELECT * FROM documents';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching documents:', err);
            return res.status(500).json({ error: "Failed to fetch documents" });
        }
        res.json(results);
    });
});

router.delete('/delete-document/:id', authenticateJWT, (req, res) => {
    const documentId = req.params.id;

    const querySelect = 'SELECT * FROM documents WHERE id = ?';
    db.query(querySelect, [documentId], (err, results) => {
        if (err || results.length === 0) {
            console.error('Error fetching document data:', err);
            return res.status(500).json({ error: "Failed to fetch document data" });
        }

        const filePath = results[0].file_path;

        const queryDelete = 'DELETE FROM documents WHERE id = ?';
        db.query(queryDelete, [documentId], (err, result) => {
            if (err) {
                console.error('Error deleting document from database:', err);
                return res.status(500).json({ error: "Failed to delete document" });
            }

            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('Error deleting file from storage:', err);
                    return res.status(500).json({ error: "Failed to delete file from storage" });
                }
                res.json({ message: "Document deleted successfully" });
            });
        });
    });
});

const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'public_html','videos'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const uploadVideo = multer({ storage: videoStorage });

router.post('/upload-video', authenticateJWT, uploadVideo.single('video'), (req, res) => {
    const { category, videoName } = req.body;
    const filePath = path.join('videos', req.file.filename);

    const query = `INSERT INTO videos (category, video_name, file_path) VALUES (?, ?, ?)`;
    db.query(query, [category, videoName, filePath], (err, result) => {
        if (err) {
            console.error('Error inserting video data:', err);
            return res.status(500).json({ error: "Video upload failed" });
        }
        res.status(201).json({ message: "Video uploaded successfully", video: { id: result.insertId, category, video_name: videoName, file_path: filePath } });
    });
});

router.get('/videos', authenticateJWT, (req, res) => {
    const query = 'SELECT * FROM videos';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching videos:', err);
            return res.status(500).json({ error: "Failed to fetch videos" });
        }
        res.json(results);
    });
});

router.delete('/delete-video/:id', authenticateJWT, (req, res) => {
    const videoId = req.params.id;

    const querySelect = 'SELECT file_path FROM videos WHERE id = ?';
    db.query(querySelect, [videoId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).json({ error: 'Failed to fetch video' });
        }

        const filePath = results[0].file_path;
        const queryDelete = 'DELETE FROM videos WHERE id = ?';
        db.query(queryDelete, [videoId], (err, result) => {
            if (err) {
                console.error('Error deleting video:', err);
                return res.status(500).json({ error: "Failed to delete video" });
            }

            // Remove file from storage
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('Error deleting file:', err);
                    return res.status(500).json({ error: "Failed to delete file" });
                }
                res.json({ message: "Video deleted successfully" });
            });
        });
    });
});

module.exports = router;
