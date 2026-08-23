const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { protect } = require("../middleware/auth");
const { scanUploadMetadata } = require("../services/uploadScanService");

const router = express.Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image uploads are allowed."));
    return cb(null, true);
  }
});
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
    if (!allowed) return cb(new Error("Only image or PDF documents are allowed."));
    return cb(null, true);
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = ({ file, folder, resourceType = "auto" }) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(file.buffer);
  });

router.post("/image", protect, imageUpload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image file is required." });
    const scan = scanUploadMetadata(req.file);
    if (scan.status === "flagged") {
      return res.status(422).json({
        message: "Upload metadata appears to include contact details. Remove phone, WhatsApp, or email text before uploading.",
        scan
      });
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(201).json({
        url: `demo-upload://${req.file.originalname}`,
        size: req.file.size,
        scan,
        demo: true
      });
    }

    const result = await uploadToCloudinary({ file: req.file, folder: "basera/images", resourceType: "image" });
    return res.status(201).json({ ...result, scan });
  } catch (error) {
    next(error);
  }
});

router.post("/document", protect, documentUpload.single("document"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Document file is required." });
    const scan = scanUploadMetadata(req.file);
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(201).json({
        url: `demo-document://${req.file.originalname}`,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        scan,
        demo: true
      });
    }

    const result = await uploadToCloudinary({ file: req.file, folder: "basera/verification-documents" });
    return res.status(201).json({
      ...result,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      scan
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
