const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const authenticateJWT = (req, res, next) => {
    const token = req.headers.authorization;
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

const authenticateJWT1 = (req, res, next) => {
    const token1 = req.headers.authorization;
    if (token1) {
        jwt.verify(token1, process.env.JWT_SECRET_STUD, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

module.exports = router;