require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./database/models');
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
// const { setupTelegramBot } = require('./services/telegramService'); -> Deprecated for SaaS

const app = express();
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 5000;

// Pass Socket.IO to Baileys service
const baileysService = require('./services/baileysService');
baileysService.setIO(io);

// Ensure uploads directory exists
const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
    console.log('📁 Created missing uploads directory.');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploads)
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/webhooks', webhookRoutes);

// Serve Frontend (Production)
const path = require('path');
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.get(/.*/, (req, res) => {
    // Exclude API routes to avoid confusion
    if (req.path.startsWith('/api') || req.path.startsWith('/webhooks')) {
        return res.status(404).json({ error: 'Not Found' });
    }
    const indexPath = path.join(__dirname, '../../frontend/dist/index.html');
    res.sendFile(indexPath);
});

// Database & Server Start
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected.');
    
    // Sync models
    await sequelize.sync({ alter: true }); 
    console.log('✅ Models synced.');

    // Start SaaS Bot Manager
    const botManager = require('./services/botManager');
    await botManager.loadAllBots();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
  }
}

startServer();
