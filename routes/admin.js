const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const ftp = require('basic-ftp');
const jwt = require('jsonwebtoken');
const fs = require('fs');
// const { Readable } = require('stream');
const authenticateJWT = require('../middlewares/authenticateJWT');
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
        cb(null, '/tmp/uploads');
    },
    filename: (req, file, cb) => {
        cb(null, path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const uploadFileToFTP = async (localFilePath, fileName) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;

    try {
        await client.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: true,// or false, depending on your setup
            secureOptions: {
                rejectUnauthorized: false
            }
        });
        await client.ensureDir("/");
        // const readableStream = new Readable();
        // readableStream._read = () => {}; // _read is required but you can noop it
        // readableStream.push(file.buffer);
        // readableStream.push(null);
        await client.uploadFrom(localFilePath, `/${fileName}`);
    }
    catch (err) {
        console.error(err);
    }
    client.close();
};

router.post('/upload', authenticateJWT, upload.single('document'), async (req, res) => {
    const { category, subcategory, documentName } = req.body;
    const fileName = `${Date.now()}_${req.file.originalname}`;
    const localFilePath = req.file.path;

    try {
        await uploadFileToFTP(localFilePath, fileName);

        const query = `INSERT INTO documents (category, subcategory, document_name, file_path) VALUES (?, ?, ?, ?)`;
        db.query(query, [category, subcategory, documentName, fileName], (err, result) => {
            if (err) {
                console.error('Error inserting document data:', err);
                return res.status(500).json({ error: "Document upload failed" });
            }
            res.status(201).json({ message: "Document uploaded successfully", document: { id: result.insertId, category, subcategory, document_name: documentName, file_path: fileName } });
        });
    } catch (err) {
        console.error('Error uploading document:', err);
        return res.status(500).json({ error: "Document upload failed" });
    } finally {
        fs.unlink(localFilePath, (err) => {
            if (err) {
                console.error(`Failed to delete local file: ${localFilePath}`, err);
            } else {
                console.log(`Successfully deleted local file: ${localFilePath}`);
            }
        });
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
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: true,
            secureOptions: {
                rejectUnauthorized: false
            }
        });
        await client.remove(`/${filePath}`);
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

// const videoStorage = multer.memoryStorage()
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/tmp/uploads');
    },
    filename: (req, file, cb) => {
        cb(null, path.extname(file.originalname));
    }
});
const uploadVideo = multer({ storage: videoStorage });

const uploadVideoToFTP = async (localFilePath, fileName, retries = 3) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;

    try {
        await client.access({
            host: process.env.FTP_HOST,
            user: process.env.FTPv_USER,
            password: process.env.FTPv_PASSWORD,
            secure: false,
            secureOptions: {
                rejectUnauthorized: false
            }
        });
        await client.ensureDir("/");
        // const readableStream = new Readable();
        // readableStream._read = () => {}; // _read is required but you can noop it
        // readableStream.push(file.buffer);
        // readableStream.push(null);
        await client.uploadFrom(localFilePath, `/${fileName}`);
    }
    catch (err) {
        if (retries > 0) {
            console.error(`FTP upload failed, retrying... (${retries} retries left)`, err);
            await uploadVideoToFTP(localFilePath, fileName, retries - 1); // Retry upload
        } else {
            console.error('Failed to upload video to FTP after multiple attempts', err);
            throw err;
        }
    } finally {
        client.close();
    }
};

router.post('/upload-video-chunk', [authenticateJWT, uploadVideo.single('chunk')], async (req, res) => {
    try {
        const { category, videoName, fileName, start } = req.body;
        const chunk = req.file;
        const uploadDir = '/tmp/uploads';

        // Ensure the directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        // const fileName = `${Date.now()}_${req.file.originalname}`;
        const localFilePath = path.join('/tmp/uploads', fileName);

        fs.appendFileSync(localFilePath, fs.readFileSync(chunk.path));
        fs.unlinkSync(chunk.path);

        const fileStat = fs.statSync(localFilePath);
        if (fileStat.size >= parseInt(start) + chunk.size) {
            await uploadVideoToFTP(localFilePath, fileName);
        }
        fs.unlinkSync(localFilePath);

        const query = `INSERT INTO videos (category, video_name, file_path) VALUES (?, ?, ?)`;
        db.query(query, [category, videoName, fileName], (err, result) => {
            if (err) {
                console.error('Error inserting video data:', err);
                return res.status(500).json({ error: "Video upload failed" });
            }
            res.status(201).json({ message: "Video uploaded successfully", video: { id: result.insertId, category, video_name: videoName, file_path: fileName } });
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
            user: process.env.FTPv_USER,
            password: process.env.FTPv_PASSWORD,
            secure: true,
            secureOptions: {
                rejectUnauthorized: false
            }
        });
        await client.remove(`/${filePath}`);
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
                await deleteVideoFromFTP(filePath);
                res.json({ message: "Document deleted successfully" });
            } catch (err) {
                console.error('Error deleting file from FTP storage:', err);
                return res.status(500).json({ error: "Failed to delete file from FTP storage" });
            }
        });
    });
});

module.exports = router;
