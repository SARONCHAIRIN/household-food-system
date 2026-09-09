const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token missing or unauthorized' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user; // { id, username, role }
        next();
    });
};

const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Admin resource access denied' });
        }
        next();
    });
};

module.exports = { verifyToken, verifyAdmin };