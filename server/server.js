// server.js
const express = require('express');
const mysql2 = require('mysql2');
const cors = require('cors');
require('dotenv').config(); // Keep this for local development

const app = express();
app.use(cors());
app.use(express.json());

// Use process.env.PORT for dynamic port assignment by Railway
// Fallback to 3001 for local development
const port = process.env.PORT || 3001;

// Database connection - Use Railway's auto-injected environment variables
const db = mysql2.createConnection({
  host: process.env.MYSQL_HOST,      // Railway's MySQL host
  user: process.env.MYSQL_USER,      // Railway's MySQL user
  password: process.env.MYSQL_PASSWORD, // Railway's MySQL password
  database: process.env.MYSQL_DATABASE, // Railway's MySQL database name
  port: process.env.MYSQL_PORT,      // Railway's MySQL port
  // You might need SSL if Railway enforces it, but usually not for internal project connections
  // For external connections or if issues arise, add:
  // ssl: { rejectUnauthorized: true }
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        process.exit(1);
    }
    console.log('Connected to Railway MySQL database as ID ' + db.threadId);
});

// Your existing API routes go here (signup, login, users, reports)
// Example: Signup Route
app.post('/signup', (req, res) => {
    const { name, lastName, email, password } = req.body;

    if (!name || !lastName || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const checkUserSql = "SELECT COUNT(*) AS count FROM users WHERE email = ?";
    db.query(checkUserSql, [email], (err, result) => {
        if (err) {
            console.error('Error checking existing user:', err);
            return res.status(500).json({ error: 'Database error during user check.' });
        }

        if (result[0].count > 0) {
            return res.status(409).json({ error: 'Email already registered.' });
        }

        const insertSql = 'INSERT INTO users (name, lastName, email, password, created_at) VALUES (?, ?, ?, ?, NOW())';
        const values = [name, lastName, email, password];

        db.query(insertSql, values, (err, result) => {
            if (err) {
                console.error('Error during signup:', err);
                return res.status(500).json({ error: 'Database error during signup.' });
            }
            res.status(201).json({ success: true, message: 'User registered successfully!' });
        });
    });
});

// ... (All your other routes like /login, /users, /reports) ...

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});