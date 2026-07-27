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
router.post('/image', auth, upload.single('image'), async (req, res) => {
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
    console.error('  Stack:', error.stack);
    res.status(500).json({ 
      error: 'Upload failed',
      details: error.message 
    });
  }
});

module.exports = router;