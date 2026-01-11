const express = require('express');
const path = require('path');

const app = express();
const PORT = 5000;

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Redirect root to login
app.get('/', (req, res) => {
    res.redirect('/views/login.html');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌐 FRONTEND SERVER: http://localhost:${PORT}`);
    console.log(`📡 Backend API: http://localhost:3000`);
});
