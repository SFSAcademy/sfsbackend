const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const ftp = require('basic-ftp');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const authenticateJWT = require('../middlewares/authenticateJWT');
const bcrypt = require('bcryptjs');
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

const storage = multer.memoryStorage()
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, path.join(__dirname, '..', 'public_html','uploads'));
//     },
//     filename: (req, file, cb) => {
//         cb(null, Date.now() + path.extname(file.originalname));
//     }
// });
const upload = multer({ storage: storage });

const uploadFileToFTP = async (file) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    
    try {
        await client.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: process.env.FTP_SECURE === 'false'// or false, depending on your setup
        });
        await client.ensureDir("/public_html/uploads");
        await client.uploadFrom(file.buffer, `/public_html/uploads/${Date.now()}_${file.originalname}`);
    }
    catch (err) {
        console.error(err);
    }
    client.close();
};

router.post('/upload', authenticateJWT, upload.single('document'), async (req, res) => {
    const { category, subcategory, documentName } = req.body;
    const fileName = Date.now() + path.extname(req.file.originalname);
    const filePath = `uploads/${fileName}`;

    try {
        await uploadFileToFTP(req.file);

        const query = `INSERT INTO documents (category, subcategory, document_name, file_path) VALUES (?, ?, ?, ?)`;
        db.query(query, [category, subcategory, documentName, filePath], (err, result) => {
            if (err) {
                console.error('Error inserting document data:', err);
                return res.status(500).json({ error: "Document upload failed" });
            }
            res.status(201).json({ message: "Document uploaded successfully", document: { id: result.insertId, category, subcategory, document_name: documentName, file_path: filePath } });
        });
    } catch (err) {
        console.error('Error uploading document:', err);
        return res.status(500).json({ error: "Document upload failed" });
    }
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

const deleteFileFromFTP = async (filePath) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        await client.access({
            host: process.env.FTP_HOST,
            user:  process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: process.env.FTP_SECURE === 'false' // Set to false if using regular FTP, true for FTPS/SFTP
        });
        await client.remove(`/public_html/${filePath}`);
    } catch (err) {
        console.error(err);
    }
    client.close();
};

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
        db.query(queryDelete, [documentId], async (err, result) => {
            if (err) {
                console.error('Error deleting document from database:', err);
                return res.status(500).json({ error: "Failed to delete document" });
            }

            try {
                await deleteFileFromFTP(filePath);
                res.json({ message: "Document deleted successfully" });
            } catch (err) {
                console.error('Error deleting file from FTP storage:', err);
                return res.status(500).json({ error: "Failed to delete file from FTP storage" });
            }

        });
    });
});

const videoStorage = multer.memoryStorage()
// const videoStorage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, path.join(__dirname, '..', 'public_html', 'videos'));
//     },
//     filename: (req, file, cb) => {
//         cb(null, Date.now() + path.extname(file.originalname));
//     }
// });
const uploadVideo = multer({ storage: videoStorage });

const uploadVideoToFTP = async (file) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        await client.access({
            host: process.env.FTP_HOST,
            user: process.env.FTPv_USER,
            password: process.env.FTPv_PASSWORD,
            secure: process.env.FTPv_SECURE === 'false'
        });
        await client.ensureDir("/public_html/videos");
        await client.uploadFrom(file.buffer, `/public_html/videos/${Date.now()}_${file.originalname}`);
    }
    catch (err) {
        console.error(err);
    }
    client.close();
};

router.post('/upload-video', authenticateJWT, uploadVideo.single('video'), async (req, res) => {
    const { category, videoName } = req.body;
    const fileName = Date.now() + path.extname(req.file.originalname);
    const filePath = `videos/${fileName}`;

    try {
        await uploadVideoToFTP(req.file);

        const query = `INSERT INTO videos (category, video_name, file_path) VALUES (?, ?, ?)`;
        db.query(query, [category, videoName, filePath], (err, result) => {
            if (err) {
                console.error('Error inserting video data:', err);
                return res.status(500).json({ error: "Video upload failed" });
            }
            res.status(201).json({ message: "Video uploaded successfully", video: { id: result.insertId, category, video_name: videoName, file_path: filePath } });
        });
    } catch (err) {
        console.error('Error uploading Video:', err);
        return res.status(500).json({ error: "Video upload failed" });
    }
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

const deleteVideoFromFTP = async (filePath) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        await client.access({
            host: process.env.FTP_HOST,
            user:  process.env.FTPv_USER,
            password: process.env.FTPv_PASSWORD,
            secure: process.env.FTPv_SECURE === 'false' // Set to false if using regular FTP, true for FTPS/SFTP
        });
        await client.remove(`/public_html/${filePath}`);
    } catch (err) {
        console.error(err);
    }
    client.close();
};

router.delete('/delete-video/:id', authenticateJWT, (req, res) => {
    const videoId = req.params.id;

    const querySelect = 'SELECT file_path FROM videos WHERE id = ?';
    db.query(querySelect, [videoId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).json({ error: 'Failed to fetch video' });
        }

        const filePath = results[0].file_path;
        const queryDelete = 'DELETE FROM videos WHERE id = ?';
        db.query(queryDelete, [videoId], async (err, result) => {
            if (err) {
                console.error('Error deleting video:', err);
                return res.status(500).json({ error: "Failed to delete video" });
            }

            try {
                await deleteFileFromFTP(filePath);
                res.json({ message: "Document deleted successfully" });
            } catch (err) {
                console.error('Error deleting file from FTP storage:', err);
                return res.status(500).json({ error: "Failed to delete file from FTP storage" });
            }
        });
    });
});

module.exports = router;
