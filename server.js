const express = require("express");
const multer = require("multer");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");

// **Server Configuration**
const app = express();
const PORT = 3000;
const HTTPS_PORT = 3443; // HTTPS Port
const UPLOADS_DIR = path.join(__dirname, "uploads");
const DATA_FILE = path.join(__dirname, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");

// **Ensure Required Directories Exist**
[UPLOADS_DIR, PUBLIC_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// **Middleware**
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: "*" })); // Allow all origins

// **Serve Static Files**
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR, { 
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript");
    }
  }
}));

// **Get Local IP Address**
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

const SERVER_IP = getLocalIPAddress();

// **Configure Multer for File Uploads**
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// **Load Stored Data**
let storedData = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE)) : {};

// **🟢 POST: Upload M3U File or URL**
app.post("/upload", upload.single("m3uFile"), (req, res) => {
  try {
    const { macId, m3uUrl } = req.body;
    console.log("Received MAC ID:", macId);
    console.log("Received m3uUrl:", m3uUrl);
    console.log("Uploaded File:", req.file);

    if (!macId) return res.status(400).json({ error: "MAC ID is required" });

    let filePath = req.file ? `http://${SERVER_IP}:${PORT}/uploads/${req.file.filename}` : null;
    let entry = filePath || m3uUrl;

    if (!entry) {
      return res.status(400).json({ error: "Either M3U file or URL is required" });
    }

    if (!storedData[macId]) {
      storedData[macId] = [];
    }

    storedData[macId].push(entry);

    fs.writeFileSync(DATA_FILE, JSON.stringify(storedData, null, 2));
    res.json({ message: "M3U File/URL stored successfully!", links: storedData[macId] });
  } catch (error) {
    console.error("Upload Error:", error); // 🔴 This will show what went wrong
    res.status(500).json({ error: "Internal server error" });
  }
});

// **🔵 GET: Retrieve M3U File or URL by MAC ID**
app.get("/get-m3u/:macId", (req, res) => {
  try {
    const { macId } = req.params;
    if (storedData[macId]) {
      res.json({ macId, links: storedData[macId] });
    } else {
      res.status(404).json({ error: "MAC ID not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
// **🔵 GET: Retrieve All MAC IDs**
app.get("/get-mac-ids", (req, res) => {
  res.json({ macIds: Object.keys(storedData) });
});

// **🔵 GET: Get MAC Address of Requesting Device**
app.get("/get-mac-address", (req, res) => {
  try {
    const macAddresses = Object.values(os.networkInterfaces())
      .flat()
      .filter(iface => iface.mac && iface.mac !== "00:00:00:00:00:00")
      .map(iface => iface.mac.toLowerCase());

    res.json({ macAddress: macAddresses[0] || "No valid MAC address found" });
  } catch (error) {
    res.status(500).json({ error: "Failed to get MAC address" });
  }
});

// **HTTPS Setup (Self-Signed Certificate)**
const keyPath = path.join(__dirname, "server.key");
const certPath = path.join(__dirname, "server.cert");

// **Generate Self-Signed Certificate If Not Exists**
if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.log("Generating SSL Certificate...");
  const { execSync } = require("child_process");
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/CN=localhost"`,
    { stdio: "inherit" }
  );
}

// **Create HTTPS Server**
const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
  console.log(`🔒 HTTPS Server running at https://${SERVER_IP}:${HTTPS_PORT}`);
});

// **Start HTTP Server**
app.listen(PORT, () => console.log(`🌍 HTTP Server running at http://${SERVER_IP}:${PORT}`));