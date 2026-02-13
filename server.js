const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from 'public' directory

// In-Memory Storage
let currentStatus = {
    distance: 0,
    level: 0,
    rssi: -100,
    time: "--:--",
    lastSeen: 0 // Timestamp of last update
};

// History storage (keep last 100 points)
let history = [];
const MAX_HISTORY = 100;

// --- Telegram Notification Logic ---
const bot = new TelegramBot(config.telegram.token, {
    polling: false,
    request: {
        family: 4 // Force IPv4 to avoid ETIMEDOUT on some networks (like Render?)
    }
});

let lastAlertTime = 0;
let lastAlertType = null; // 'low' or 'high'

function checkAlerts(level) {
    const now = Date.now();
    let alertType = null;
    let message = null;

    if (level < config.alerts.low) {
        alertType = 'low';
        message = `⚠️ **CRITICAL: Low Water Level!**\nCurrent Level: ${level}%`;
    } else if (level > config.alerts.high) {
        alertType = 'high';
        message = `✅ **Tank Full!**\nCurrent Level: ${level}%`;
    }

    if (alertType) {
        // Send if:
        // 1. Different alert type than last time (e.g., went from low to high)
        // 2. OR enough time has passed since last alert of THIS type
        if (alertType !== lastAlertType || (now - lastAlertTime > config.alerts.cooldown)) {

            console.log(`Sending Telegram message to ${config.telegram.chatId}...`);
            bot.sendMessage(config.telegram.chatId, message, { parse_mode: 'Markdown' })
                .then(() => {
                    console.log(`Telegram alert sent: ${alertType}`);
                    lastAlertTime = now;
                    lastAlertType = alertType;
                })
                .catch((error) => {
                    console.error('Telegram Send Error:', error.message);
                });
        }
    } else {
        // Reset alert type if back to normal range, so next alert sends immediately
        if (lastAlertType !== null && level >= config.alerts.low && level <= config.alerts.high) {
            lastAlertType = null;
        }
    }
}

// --- API Endpoints ---

// POST /api/update - Receive data from ESP8266
// Expects: { distance: float, level: float, rssi: int, status: string (optional) }
app.post('/api/update', (req, res) => {
    const { distance, level, rssi, status } = req.body;

    if (distance === undefined || level === undefined) {
        return res.status(400).json({ error: 'Missing data' });
    }

    // Update current status
    currentStatus = {
        distance: parseFloat(distance),
        level: parseFloat(level),
        rssi: parseInt(rssi) || -100,
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        lastSeen: Date.now()
    };

    // Add to history
    const historyPoint = {
        t: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        v: parseFloat(level)
    };

    history.push(historyPoint);
    if (history.length > MAX_HISTORY) {
        history.shift(); // Remove oldest
    }

    console.log(`[${currentStatus.time}] Data received: Level ${level}%, RSSI ${rssi}, Status: ${status || 'normal'}`);

    // Handle System Status Notifications (Boot / Wake)
    if (status === 'boot') {
        const msg = `🟢 **System Online**\nWater Monitor is back online.\nCurrent Level: ${level}%`;
        bot.sendMessage(config.telegram.chatId, msg, { parse_mode: 'Markdown' });
        console.log("Sent 'System Online' notification");
    } else if (status === 'wake') {
        const msg = `☀️ **Good Morning!**\nExiting Night Mode.\nCurrent Level: ${level}%`;
        bot.sendMessage(config.telegram.chatId, msg, { parse_mode: 'Markdown' });
        console.log("Sent 'Wake Up' notification");
    }

    // Check for alerts (only for normal/wake updates, boot might trigger immediate alert too which is fine)
    checkAlerts(currentStatus.level);

    res.json({ success: true });
});

// GET /api/debug-telegram - Manual test endpoint to see errors directly
app.get('/api/debug-telegram', async (req, res) => {
    try {
        const msg = `🔔 Test Notification from Server\nTime: ${new Date().toLocaleTimeString()}`;
        console.log("Attempting to send debug message...");
        const sent = await bot.sendMessage(config.telegram.chatId, msg);
        console.log("Debug message sent successfully");
        res.json({ success: true, result: sent });
    } catch (error) {
        console.error("Debug message failed:", error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code || 'UNKNOWN',
            details: error.response ? error.response.body : null
        });
    }
});

// GET /api/status - Used by Frontend for real-time display
app.get('/api/status', (req, res) => {
    // Check if data is stale (older than 2 minutes)
    const isOnline = (Date.now() - currentStatus.lastSeen) < 120000;

    res.json({
        ...currentStatus,
        online: isOnline
    });
});

// GET /api/history - Used by Chart
app.get('/api/history', (req, res) => {
    res.json(history);
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("VERSION: 2.1 - Telegram Debug Enabled");
});
