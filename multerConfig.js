const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error("Only PDF and image files are allowed (e.g. JPEG, PNG, GIF, WebP, SVG)."), false); // Reject the file
    }
};


const upload = multer({ storage, fileFilter });

module.exports = upload;