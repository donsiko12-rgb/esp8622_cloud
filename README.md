# Cloud Water Level Server

This is the **Cloud Server** component for the Water Level Monitor system.
It acts as the central hub: receiving data from the ESP8266 and serving the web dashboard to users.

## Features
- **Data Receiver**: endpoint `POST /api/update` accepts JSON data from the device.
- **Web Dashboard**: Simple, responsive HTML5 interface (in `public/`).
- **Offline Detection**: Automatically marks the device as offline if no data is received for 2 minutes.
- **History Storage**: Keeps the last 100 data points in memory for graphing.

## Deployment (Render.com)
1. Push this folder to GitHub.
2. Creates a **New Web Service** on Render.
3. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

## Local Development
1. Install dependencies: `npm install`
2. Run server: `node server.js`
3. Open browser: `http://localhost:3000`
