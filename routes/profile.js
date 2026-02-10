var express = require('express'),
    router = express.Router(),
    { con } = require('../database')
    ;

router.put("/complete-profile", async (req, res) => {
    const { profilePicture, aboutMe, ageRange, moveinTimeline, lifestylePreferences } = req.body;
    const { Email } = req.user;

    if (!profilePicture || !aboutMe || !ageRange || !moveinTimeline || !lifestylePreferences) {
        return res.status(400).json({ message: "All profile fields are required." });
    }

    try {
        const [rows] = await con.execute("SELECT Password FROM UserDetails WHERE Email = ?;", [Email]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const updateProfileQuery = `UPDATE UserDetails SET ProfilePicture = ?, AboutMe = ?, AgeRange = ?, MoveinTimeline = ?, LifestylePreferences = ? WHERE Email = ?`;
        await con.execute(updateProfileQuery, [profilePicture, aboutMe, ageRange, moveinTimeline, lifestylePreferences, Email]);

        return res.json({ message: "Profile updated successfully." });
    } catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({ message: "Internal server error. Please try again later." });
    }
});

router.put('/update-profile', async (req, res) => {
    const { updateType } = req.body;
    const email = req.user?.Email;
    if (!email) {
        return res.status(400).json({ message: "Email is required to identify the user." });
    }

    try {
        // Check if user exists
        const [existingUsers] = await con.execute("SELECT * FROM UserDetails WHERE Email = ?", [email]);
        if (existingUsers.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        if (updateType === 'data') {
            const { firstName, lastName, phone, dob, userRole } = req.body;
            let formattedDob = null;
            if (dob) {
                const dateObj = new Date(dob);
                if (isNaN(dateObj)) {
                    return res.status(400).json({ message: "Invalid date of birth format." });
                }
                formattedDob = dateObj.toISOString().split('T')[0];
            }

            // Build update query dynamically to update only provided fields
            const fields = [];
            const values = [];

            if (firstName) {
                fields.push("FirstName = ?");
                values.push(firstName);
            }
            if (lastName) {
                fields.push("LastName = ?");
                values.push(lastName);
            }
            if (phone) {
                fields.push("Phone = ?");
                values.push(phone);
            }
            if (formattedDob) {
                fields.push("DOB = ?");
                values.push(formattedDob);
            }
            if (userRole) {
                fields.push("UserRole = ?");
                values.push(userRole);

                if (userRole === 'Consumer') {
                    fields.push("Status = ?");
                    values.push('Approved');
                }
            }

            if (fields.length === 0) {
                return res.status(400).json({ message: "No details provided to update." });
            }

            const updateQuery = `UPDATE UserDetails SET ${fields.join(", ")} WHERE Email = ?`;
            values.push(email);

            await con.execute(updateQuery, values);

            return res.json({ message: "User details updated successfully." });

        } else if (updateType === 'password') {
            // Update password only
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ message: "Current and new passwords are required for password update." });
            }

            if (existingUsers[0].Password !== currentPassword) {
                return res.status(400).json({ message: "Current password does not match with database." });
            }

            // Store password as plain text (per your request, but not recommended)
            const updatePasswordQuery = `UPDATE UserDetails SET Password = ? WHERE Email = ?`;
            await con.execute(updatePasswordQuery, [newPassword, email]);

            return res.json({ message: "Password updated successfully." });

        } else {
            return res.status(400).json({ message: "Invalid updateType. Must be 'data' or 'password'." });
        }

    } catch (error) {
        console.error("Update user error:", error);
        return res.status(500).json({ message: "Internal server error. Please try again later." });
    }
});

module.exports = router;