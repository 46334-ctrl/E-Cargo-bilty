const cloudinary = require('cloudinary').v2;
const fs = require('fs');

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

if (isCloudinaryConfigured) {
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }
}

/**
 * Uploads a local file to Cloudinary.
 * If Cloudinary is not configured or throws, it returns null
 * so the system seamlessly falls back to local static serving.
 *
 * @param {string} filePath - Absolute or relative path to the local file
 * @param {string} folder - Target Cloudinary folder name
 * @returns {Promise<string|null>} - Cloudinary secure URL or null
 */
async function uploadToCloudinary(filePath, folder = 'e_cargo_lost_evidence') {
  if (!isCloudinaryConfigured) {
    return null;
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'auto'
    });
    return result.secure_url;
  } catch (err) {
    console.warn('⚠️ Cloudinary upload failed, falling back to local storage:', err.message);
    return null;
  }
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadToCloudinary
};

