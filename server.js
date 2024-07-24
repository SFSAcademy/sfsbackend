require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const app = express();
const port = process.env.PORT || 5000;

const cors = require('cors');
app.use(cors());

app.use(bodyParser.json());

// const db = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: '',
//   database: 'sfs_academy'
// });

// db.connect((err) => {
//   if (err) {
//     throw err;
//   }
//   console.log('MySQL Connected...');
// });

app.get('/', (req, res) => {
    res.send('Hello from the backend!');
});

const registration = require('./routes/registration.js');
app.use('/api/auth', registration);

const adminRoutes = require('./routes/admin.js');
app.use('/api/admin', adminRoutes);

const studentRoute = require('./routes/student.js');
app.use('/api/student', studentRoute);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
