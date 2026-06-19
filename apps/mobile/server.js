const express = require('express');
const path = require('path');

const app = express();
const PORT = 8082;

// Serve static files
app.use(express.static(__dirname));

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🧘‍♀️ SoulSync Mobile App running on http://localhost:${PORT}`);
  console.log('📱 Mobile app interface ready!');
});
