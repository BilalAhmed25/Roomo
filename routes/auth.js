const express = require("express"),
    path = require("path"),
    fs = require("fs"),
    jwt = require("jsonwebtoken"),
    router = express.Router(),
    sendEmail = require("../sendEmail"),
    authenticateToken = require("../authenticateToken"),
    { con } = require("../database");

const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    // secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
};

router.post("/sign-up", async (req, res) => {
    const { name, email, phone, dob, password, accountType } = req.body;
    let connection;
    try {
        connection = await con.getConnection();
        await connection.beginTransaction();

        const insertUserQuery = `INSERT INTO UserDetails (Name, Phone, Email, Password, AccountType) VALUES (?, ?, ?, ?, ?)`;
        await connection.execute(insertUserQuery, [name, phone, email, password, accountType,]);

        const [result] = await connection.execute("SELECT * FROM UserDetails WHERE Email = ?", [email],);
        const user = result[0];
        if (!user) {
            throw new Error("User not found after insert");
        }
        const { Password, password: _p, ...userData } = user;
        const secretKey = process.env.SECRET_KEY || process.env.JWT_SECRET;
        if (!secretKey) {
            throw new Error("SECRET_KEY or JWT_SECRET is not configured");
        }
        const token = jwt.sign(userData, secretKey, {
            expiresIn: "10h",
        });

        await connection.commit();
        connection.release();

        res.status(201).json({ user: userData, message: "User registered successfully.", token: token, });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackErr) {
                console.error("Rollback error:", rollbackErr);
            }
            connection.release();
        }
        if (error.code === "ER_DUP_ENTRY") {
            const msg = error.sqlMessage || "";
            if (msg.includes("Email") || msg.includes("email")) {
                return res.status(409).json({ message: "User with this email already exists." });
            } else if (msg.includes("Phone") || msg.includes("phone")) {
                return res.status(409).json({ message: "User with this phone number already exists." });
            } else {
                return res.status(409).json({ message: "A user with this email or phone already exists." });
            }
        }
        res.status(500).json({ message: "Internal server error. Please try again later." });
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const [result] = await con.execute("SELECT * FROM `UserDetails` WHERE Email = ? LIMIT 1", [email],);
        if (result.length === 0) {
            return res.status(401).json({ message: "Email is incorrect." });
        }

        const user = result[0];
        if (user.Password !== password) {
            return res.status(401).json({ message: "Password is incorrect." });
        }

        const { Password, ...userData } = user;
        const secretKey = process.env.SECRET_KEY || process.env.JWT_SECRET;
        const token = jwt.sign(userData, secretKey, { expiresIn: "10h", });
        res.status(200).json({ user: userData, message: "Login successful.", token: token });
    } catch (error) {
        res.status(500).json({ message: "Internal server error. Please try again later." });
    }
});

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const generateOTP = (length = 6) => {
    const digits = "0123456789";
    let otp = "";
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
};

let otpStore = { value: null, expiresAt: 0 };
router.post("/verify-account", authenticateToken, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Missing required field: email" });
        }

        if (req.user && req.user.Email !== email) {
            return res.status(403).json({ message: "You can only verify your own account." });
        }

        // Check if user exists
        const [existingUsers] = await con.execute("SELECT * FROM UserDetails WHERE Email = ?", [email],);
        if (existingUsers.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const otpValue = generateOTP(6);
        otpStore = { value: otpValue, expiresAt: Date.now() + OTP_EXPIRY_MS };

        const templatePath = path.join(__dirname, "../email-templates", "otp-email-template.html",);
        let emailTemplate = fs.readFileSync(templatePath, "utf-8");

        const currentDate = new Date().toLocaleDateString();
        emailTemplate = emailTemplate
            .replace(/{{OTP}}/g, otpValue)
            .replace(/{{firstName}}/g, existingUsers[0].FirstName)
            .replace(/{{date}}/g, currentDate);

        // Hardcoded from and subject
        const from = `"Roomo" <${process.env.SMTP_USER}>`;
        const subject = "Your One Time Password (OTP)";

        await sendEmail(from, email, subject, emailTemplate, [], smtpConfig);

        res.json({ message: "OTP email sent successfully.", otp: otpValue });
    } catch (error) {
        res.status(500).json({ message: "Failed to send OTP email." });
    }
});

router.post("/send-otp", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Missing required field: email" });
        }

        if (req.user && req.user.Email !== email) {
            return res.status(403).json({ message: "You can only verify your own account." });
        }

        // Check if user exists
        const [existingUsers] = await con.execute("SELECT * FROM UserDetails WHERE Email = ?", [email],);
        if (existingUsers.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const otpValue = generateOTP(6);
        otpStore = { value: otpValue, expiresAt: Date.now() + OTP_EXPIRY_MS };

        const templatePath = path.join(__dirname, "../email-templates", "otp-email-template.html",);
        let emailTemplate = fs.readFileSync(templatePath, "utf-8");

        const currentDate = new Date().toLocaleDateString();
        emailTemplate = emailTemplate
            .replace(/{{OTP}}/g, otpValue)
            .replace(/{{firstName}}/g, existingUsers[0].FirstName)
            .replace(/{{date}}/g, currentDate);

        // Hardcoded from and subject
        const from = `"Roomo" <${process.env.SMTP_USER}>`;
        const subject = "Your One Time Password (OTP)";

        await sendEmail(from, email, subject, emailTemplate, [], smtpConfig);

        res.json({ message: "OTP email sent successfully.", otp: otpValue });
    } catch (error) {
        res.status(500).json({ message: "Failed to send OTP email." });
    }
});

router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp: userOtp } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Missing required field: email" });
        }
        if (!userOtp) {
            return res.status(400).json({ message: "Missing required field: otp" });
        }

        if (Date.now() > otpStore.expiresAt) {
            return res.status(401).json({ message: "OTP has expired. Please request a new one." });
        }
        if (String(userOtp) !== String(otpStore.value)) {
            return res.status(401).json({ message: "Invalid OTP." });
        }

        await con.execute("UPDATE UserDetails SET IsVerified = 1 WHERE Email = ?", [email,]);
        res.json({ message: "OTP verified successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to verify OTP." });
    }
});

router.put("/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required." });
    }
    if (!newPassword) {
        return res.status(400).json({ message: "New password is required." });
    }

    try {
        const [rows] = await con.execute("SELECT Password FROM UserDetails WHERE Email = ?", [email],);

        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const updatePasswordQuery = `UPDATE UserDetails SET Password = ? WHERE Email = ?`;
        await con.execute(updatePasswordQuery, [newPassword, email]);

        return res.json({ message: "Password updated successfully." });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error. Please try again later." });
    }
});

module.exports = router;