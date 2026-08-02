const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const auth = require('../middleware/auth');

// ===== CLOUDINARY CONFIG =====
console.log('🔧 Cloudinary Config:');
console.log('  Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
console.log('  API Key:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
console.log('  API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 🔍 TEMPORARY DEBUG - remove once the upload issue is confirmed fixed.
// Prints lengths/values that are safe to see in logs (not the actual secret)
// so we can catch a truncated/corrupted env var without re-exposing credentials.
console.log('🔍 Debug — Cloud Name value:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('🔍 Debug — API Key length:', process.env.CLOUDINARY_API_KEY?.length, '(expected 15)');
console.log('🔍 Debug — API Secret length:', process.env.CLOUDINARY_API_SECRET?.length, '(expected 27)');
console.log('🔍 Debug — Cloud Name length:', process.env.CLOUDINARY_CLOUD_NAME?.length, '(expected 8)');

// ===== STORAGE CONFIG =====
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chateau-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{
      width: 800,
      height: 800,
      crop: 'limit',
      quality: 'auto'
    }]
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ===== UPLOAD IMAGE =====
// ✅ FIX: multer is now called manually with an explicit error callback,
// instead of as chained middleware (`upload.single('image')` directly in
// the route). Errors thrown DURING the Cloudinary upload happen inside
// multer's middleware step, which runs BEFORE this handler's try/catch
// ever starts - so they were previously invisible, never logged, and
// Express just returned a bare 500 with no details. This wrapper catches
// that error explicitly so we can finally see what's actually failing.
router.post('/image', auth, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      // Log the ENTIRE raw error object, unfiltered - Cloudinary's SDK
      // often nests the real reason in fields we weren't printing before
      // (e.g. err.error.message), so a partial log was hiding the actual cause.
      console.error('❌ FULL Cloudinary/Multer error object:');
      console.error(JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      return res.status(500).json({
        error: 'Upload failed',
        details: err.message,
        fullError: JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)))
      });
    }

    try {
      console.log('📤 Upload request received');

      if (!req.file) {
        console.log('❌ No file in request');
        return res.status(400).json({ error: 'No image uploaded' });
      }

      console.log('✅ File uploaded to Cloudinary:', req.file.path);

      res.json({
        imageUrl: req.file.path,
        imagePublicId: req.file.filename
      });
    } catch (error) {
      console.error('❌ Upload error details:', error);
      console.error('  Message:', error.message);
      res.status(500).json({
        error: 'Upload failed',
        details: error.message
      });
    }
  });
});

module.exports = router;