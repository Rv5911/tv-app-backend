const express = require("express");
const multer = require("multer");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
const PORT = 3000;
const UPLOADS_DIR = path.join(__dirname, "uploads");
const DATA_FILE = path.join(__dirname, "data.json");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static(UPLOADS_DIR)); // Serve uploaded files

// Configure file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Load existing data
let storedData = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE)) : {};

// 🟢 **POST API: Upload M3U File or URL**
app.post("/upload", upload.single("m3uFile"), (req, res) => {
  const { macId, m3uUrl } = req.body;
  let filePath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!macId) return res.status(400).json({ error: "MAC ID is required" });

  storedData[macId] = filePath ? `http://localhost:${PORT}${filePath}` : m3uUrl;
  fs.writeFileSync(DATA_FILE, JSON.stringify(storedData, null, 2));

  res.json({ message: "M3U File/URL stored successfully!", link: storedData[macId] });
});

// 🔵 **GET API: Retrieve M3U File or URL by MAC ID**
app.get("/get-m3u/:macId", (req, res) => {
  const { macId } = req.params;
  if (storedData[macId]) {
    res.json({ macId, link: storedData[macId] });
  } else {
    res.status(404).json({ error: "MAC ID not found" });
  }
});

// 🔵 **GET API: Retrieve All MAC IDs**
app.get("/get-mac-ids", (req, res) => {
  const macIds = Object.keys(storedData);
  res.json({ macIds });
});

// 🔵 **GET API: Get MAC Address of Requesting Device**
app.get("/get-mac-address", (req, res) => {
  try {
    const networkInterfaces = os.networkInterfaces();
    const macAddresses = Object.values(networkInterfaces)
      .flat()
      .filter(interface => interface.mac !== "00:00:00:00:00:00")
      .map(interface => interface.mac.toLowerCase());

    res.json({ macAddress: macAddresses[0] || "No valid MAC address found" });
  } catch (error) {
    res.status(500).json({ error: "Failed to get MAC address" });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));