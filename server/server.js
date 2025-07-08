// server.js
const express = require('express');
const mysql2 = require('mysql2');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Database connection
const db = mysql2.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // Your MySQL password if you have one
    database: 'firstapp'
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to MySQL database as ID ' + db.threadId);
});

// --- User Authentication Routes (unchanged from previous interaction) ---

// SIGNUP ROUTE
app.post('/signup', (req, res) => {
    const { name,  email, password } = req.body; // Added lastName based on signup.jsx

    if (!name || !email || !password) { // Check for lastName
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // Check if user already exists
    const checkUserSql = "SELECT COUNT(*) AS count FROM users WHERE email = ?";
    db.query(checkUserSql, [email], (err, result) => {
        if (err) {
            console.error('Error checking existing user:', err);
            return res.status(500).json({ error: 'Database error during user check.' });
        }

        if (result[0].count > 0) {
            return res.status(409).json({ error: 'Email already registered.' });
        }

        // Insert new user if email is not taken
        // Assuming your 'users' table has a 'created_at' or 'registration_date' column.
        // If not, you might need to add one and set its default value to CURRENT_TIMESTAMP.
        const insertSql = 'INSERT INTO users (name,email, password, created_at) VALUES (?, ?, ?, ?, NOW())'; // Added created_at
        const values = [name,email, password];

        db.query(insertSql, values, (err, result) => {
            if (err) {
                console.error('Error during signup:', err);
                return res.status(500).json({ error: 'Database error during signup.' });
            }
            res.status(201).json({ success: true, message: 'User registered successfully!' });
        });
    });
});

// LOGIN ROUTE
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Also update last_login_at on successful login for 'active users' tracking
    const sql = "SELECT ID, name, email, password FROM users WHERE email = ?";
    db.query(sql, [email], (err, data) => {
        if (err) {
            console.error('Error during login query:', err);
            return res.status(500).json({ error: 'Database error during login.' });
        }

        if (data.length > 0) {
            const user = data[0];
            if (user.password === password) { // In a real app, use bcrypt for password hashing
                // Update last_login_at
                const updateLoginTimeSql = "UPDATE users SET last_login_at = NOW() WHERE ID = ?";
                db.query(updateLoginTimeSql, [user.ID], (updateErr) => {
                    if (updateErr) {
                        console.error('Error updating last_login_at:', updateErr);
                        // Don't block login if update fails, but log it
                    }
                });

                return res.json({
                    success: true,
                    message: "Login successful!",
                    name: user.name,
                    email: user.email,
                    role: "User", // Hardcoded role for now
                    ID: user.ID
                });
            } else {
                return res.status(401).json({ success: false, error: "InvalID credentials." });
            }
        } else {
            return res.status(401).json({ success: false, error: "InvalID credentials." });
        }
    });
});

// --- User Management Routes (for Users.jsx - unchanged) ---

// GET all users
app.get('/users', (req, res) => {
    const sql = "SELECT ID, name, email FROM users"; // Do not select password
    db.query(sql, (err, data) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: 'Failed to retrieve users.' });
        }
        res.json(data);
    });
});

// DELETE a user
app.delete('/users/:ID', (req, res) => {
    const userId = req.params.ID;
    const sql = "DELETE FROM users WHERE ID = ?";
    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error('Error deleting user:', err);
            return res.status(500).json({ error: 'Failed to delete user.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ success: true, message: 'User deleted successfully.' });
    });
});

// UPDATE a user
app.put('/users/:ID', (req, res) => {
    const userId = req.params.ID;
    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required for update.' });
    }

    const sql = "UPDATE users SET name = ?, email = ? WHERE ID = ?";
    db.query(sql, [name, email, userId], (err, result) => {
        if (err) {
            console.error('Error updating user:', err);
            return res.status(500).json({ error: 'Failed to update user.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ success: true, message: 'User updated successfully.' });
    });
});

// --- NEW Report Data Endpoint ---
app.get('/reports', async (req, res) => {
    try {
        // 1. Fetch User Activity (using users table, assuming 'created_at' column)
        const [userActivityRows] = await db.promise().query(
            "SELECT ID, name, created_at FROM users ORDER BY created_at DESC LIMIT 10"
        );
        const userActivity = userActivityRows.map(user => ({
            ID: user.ID,
            user: user.name,
            action: 'Registered', // Simplified: real activity needs an activity log table
            timestamp: new Date(user.created_at).toLocaleString() // Format date for display
        }));

        // 2. Fetch Data Trends
        // Registrations Last 7 Days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
        const [recentRegistrations] = await db.promise().query(
            "SELECT COUNT(*) AS count FROM users WHERE created_at >= ?",
            [sevenDaysAgo]
        );
        const registrationsLast7Days = recentRegistrations[0].count;

        // Active Users Today (simplified: total users)
        // A robust solution needs a 'last_login_at' column updated on login, or an activity log.
        const [totalUsersResult] = await db.promise().query("SELECT COUNT(*) AS count FROM users");
        const activeUsersToday = totalUsersResult[0].count;

        // New Items Created Today (hardcoded as no 'items' table available)
        const newItemsCreatedToday = 0; // Requires an 'items' table and relevant data

        // System Performance (simulated as not database-driven)
        const systemPerformance = {
            cpuUsage: '18%',
            memoryUsage: '65%',
            diskSpace: '78% Used',
            uptime: '16 days, 2 hours',
        };

        res.json({
            userActivity,
            dataTrends: {
                registrationsLast7Days,
                activeUsersToday,
                newItemsCreatedToday,
            },
            systemPerformance,
        });

    } catch (err) {
        console.error('Error fetching report data:', err);
        res.status(500).json({ error: 'Failed to retrieve report data from the database.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});