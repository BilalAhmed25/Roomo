const express = require("express"),
    path = require("path"),
    fs = require("fs"),
    jwt = require("jsonwebtoken"),
    router = express.Router(),
    sendEmail = require("../sendEmail"),
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
    try {
        const insertUserQuery = `INSERT INTO UserDetails (Name, Phone, Email, Password, AccountType) VALUES (?, ?, ?, ?, ?, ?)`;
        await con.execute(insertUserQuery, [name, phone, email, password, accountType]);

        const [result] = await con.execute("SELECT * FROM UserDetails WHERE Email = ?", [email]);
        const user = result[0];
        const { Password, ...userData } = user;
        const token = jwt.sign(userData, process.env.SECRET_KEY, { expiresIn: "10h", });

        res.status(201).json({ message: "User registered successfully.", token: token, user: userData });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json("User with this email already exists.");
        }
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const query = "SELECT * FROM `UserDetails` WHERE Email = ? AND Password = ? LIMIT 1";
    try {
        const [result] = await con.execute(query, [email, password]);
        if (result.length === 0) {
            return res.status(401).json("Incorrect email or password.");
        }

        const user = result[0];
        const { Password, ...userData } = user;
        const token = jwt.sign(userData, process.env.SECRET_KEY, {
            expiresIn: "10h",
        });
        res.status(200).json({ token: token, user: userData });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

const generateOTP = (length = 6) => {
    const digits = "0123456789";
    let otp = "";
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
};

let otp = 0;
router.post("/verify-account", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Missing required field: email" });
        }

        // Check if user exists
        const [existingUsers] = await con.execute("SELECT * FROM UserDetails WHERE Email = ?", [email]);
        if (existingUsers.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        otp = generateOTP(6);

        const templatePath = path.join(__dirname, "../email-templates", "otp-email-template.html");
        let emailTemplate = fs.readFileSync(templatePath, "utf-8");

        const currentDate = new Date().toLocaleDateString();
        emailTemplate = emailTemplate.replace(/{{OTP}}/g, otp).replace(/{{firstName}}/g, existingUsers[0].FirstName).replace(/{{date}}/g, currentDate);

        // Hardcoded from and subject
        const from = `"Roomo" <${process.env.SMTP_USER}>`;
        const subject = "Your One Time Password (OTP)";

        await sendEmail(from, email, subject, emailTemplate, [], smtpConfig);

        res.json({ message: "OTP email sent successfully.", otp: otp, });
    } catch (error) {
        console.error("Error sending OTP email:", error);
        res.status(500).json({ message: "Failed to send OTP email." });
    }
});

router.post("/send-otp", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Missing required field: email" });
        }

        // Check if user exists
        const [existingUsers] = await con.execute("SELECT * FROM UserDetails WHERE Email = ?", [email]);
        if (existingUsers.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        otp = generateOTP(6);

        const templatePath = path.join(__dirname, "../email-templates", "otp-email-template.html");
        let emailTemplate = fs.readFileSync(templatePath, "utf-8");

        const currentDate = new Date().toLocaleDateString();
        emailTemplate = emailTemplate.replace(/{{OTP}}/g, otp).replace(/{{firstName}}/g, existingUsers[0].FirstName).replace(/{{date}}/g, currentDate);

        // Hardcoded from and subject
        const from = `"Roomo" <${process.env.SMTP_USER}>`;
        const subject = "Your One Time Password (OTP)";

        await sendEmail(from, email, subject, emailTemplate, [], smtpConfig);

        res.json({ message: "OTP email sent successfully.", otp: otp, });
    } catch (error) {
        console.error("Error sending OTP email:", error);
        res.status(500).json({ message: "Failed to send OTP email." });
    }
});

router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!otp) {
            return res.status(400).json({ message: "Missing required field: otp" });
        }

        if (otp != this.otp) {
            return res.status(401).json({ message: "Invalid OTP." });
        }

        res.json({ message: "OTP verified successfully.", otp: otp, });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ message: "Failed to verify OTP." });
    }
});

router.put("/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({ message: "New password is required." });
    }

    try {
        const [rows] = await con.execute("SELECT Password FROM UserDetails WHERE Email = ?", [email]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        if (otp != userOTP) {
            return res.status(401).json({ message: "OTP is incorrect." });
        }

        // Update password
        const updatePasswordQuery = `UPDATE UserDetails SET Password = ? WHERE Email = ?`;
        await con.execute(updatePasswordQuery, [newPassword, email]);

        return res.json({ message: "Password updated successfully." });
    } catch (error) {
        console.error("Update password error:", error);
        return res.status(500).json({ message: "Internal server error. Please try again later." });
    }
});

module.exports = router;