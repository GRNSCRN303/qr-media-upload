require("dotenv").config();
const express = require("express");
const multer = require("multer");
const QRCode = require("qrcode");
const sharp = require("sharp");
const auth = require("basic-auth");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const QR_DIR = path.join(__dirname, "qr", "png");

// Ensure folders exist
[UPLOAD_DIR, QR_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Auth only for root page and POST /upload
app.use((req, res, next) => {
  const needsAuth =
    req.path === "/" ||
    (req.path === "/upload" && req.method === "POST");

  if (!needsAuth) return next();

  const user = auth(req);
  if (
    !user ||
    user.name !== process.env.AUTH_USER ||
    user.pass !== process.env.AUTH_PASS
  ) {
    res.set("WWW-Authenticate", 'Basic realm="Upload Area"');
    return res.status(401).send("Authentication required.");
  }

  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static("public"));
app.use("/qr", express.static("qr"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, safeName);
  }
});
const upload = multer({ storage });

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");

  const { mode = "black" } = req.query;

  const qrColor =
    mode === "white"
      ? { dark: "#ffffff", light: "#00000000" }
      : { dark: "#000000", light: "#00000000" };

  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  const svg = await QRCode.toString(imageUrl, {
    type: "svg",
    margin: 2,
    color: qrColor,
    errorCorrectionLevel: "L"
  });

  const filename = req.file.filename.replace(path.extname(req.file.filename), "");
  const pngFilename = `qr-${filename}.png`;
  const buffer = await sharp(Buffer.from(svg)).resize(2046, 2046).png({ compressionLevel: 9 }).toBuffer();

  fs.writeFileSync(path.join(QR_DIR, pngFilename), buffer);

  res.json({
    message: "Upload & QR erfolgreich",
    imageUrl,
    qrUrl: `/qr/png/${pngFilename}`
  });
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
