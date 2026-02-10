const express = require("express"),
    router = express.Router(),
    { con } = require("../database"),
    { v2: cloudinary } = require("cloudinary"),
    upload = require("../multerConfig.js");

router.get("/get-requests", async (req, res) => {
    const query = "SELECT `Requests`.*, UserDetails.FirstName, UserDetails.LastName FROM `Requests` JOIN UserDetails ON Requests.UserID = UserDetails.ID WHERE PublishStatus = 'Published' AND Requests.Status = 'Pending';";
    try {
        const [result] = await con.execute(query);
        res.status(200).json({ requests: result });
    } catch (error) {
        console.error("An error occurred:", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.put("/make-a-bid", async (req, res) => {
    const { requestID, deliveryTime, price, requestor } = req.body;
    const bidderID = req.user.ID;
    const query1 = "UPDATE `Requests` SET Status = 'Bid received' WHERE ID = ?";
    let query2 = "INSERT INTO `Biddings`(`RequestID`, `BidderID`, `DeliveryDate`, `Price`) VALUES (?, ?, ?, ?);";
    if (requestor === 'admin') {
        query2 = "INSERT INTO `Biddings`(`RequestID`, `BidderID`, `DeliveryDate`, `Price`, `Status`) VALUES (?, ?, ?, ?, 'Admin approved');";
    }
    let connection;
    try {
        connection = await con.getConnection();
        await connection.beginTransaction(); // Start transaction

        const [updateResult] = await con.execute(query1, [requestID]);
        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            return res
                .status(404)
                .json({ message: "Request not found or already updated." });
        }

        await connection.execute(query2, [
            requestID,
            bidderID,
            deliveryTime,
            price,
        ]);

        await connection.commit(); // Commit both queries
        res.status(200).json({ message: "Bid placed and request status updated successfully." });
    } catch (error) {
        await connection.rollback(); // Rollback if any query fails
        console.error("Transaction error:", error);
        res.status(500).json({ message: "Failed to place bid. Please try again later." });
    } finally {
        connection.release(); // Release connection back to pool
    }
});

router.get("/get-my-bids", async (req, res) => {
    let query = "SELECT Biddings.*, Requests.Title, Requests.Description FROM `Biddings` JOIN Requests ON Requests.ID = Biddings.RequestID WHERE `BidderID` = ?;";
    try {
        const [result] = await con.execute(query, [req.user.ID]);
        res.status(200).json({ requests: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-received-orders", async function (req, res) {
    try {
        const sql = "SELECT * FROM Biddings WHERE BidderID = ? AND Status = 'Client approved';";
        const [result] = await con.execute(sql, [req.user.ID]);
        res.status(200).json({ orders: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-past-orders", async function (req, res) {
    try {
        // const sql = "SELECT * FROM Orders WHERE AND OrderStatus = 'Delivered';";
        const sql = "SELECT Orders.OrderStatus, Requests.Title, Requests.Description, Biddings.Price, Biddings.Commission FROM Orders JOIN Biddings ON Orders.BidID = Biddings.ID JOIN Requests ON Requests.ID = Biddings.RequestID WHERE Biddings.BidderID = ? AND OrderStatus = 'Delivered';";
        const [result] = await con.execute(sql, [req.user.ID]);
        res.status(200).json({ orders: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/orders-in-progress", async function (req, res) {
    try {
        // const sql = "SELECT * FROM Orders WHERE AND OrderStatus = 'Delivered';";
        const sql = "SELECT Orders.OrderStatus, Requests.Title, Requests.Description, Biddings.Price, Biddings.Commission FROM Orders JOIN Biddings ON Orders.BidID = Biddings.ID JOIN Requests ON Requests.ID = Biddings.RequestID WHERE Biddings.BidderID = ? AND OrderStatus != 'Delivered';";
        const [result] = await con.execute(sql, [req.user.ID]);
        res.status(200).json({ orders: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-order-status", async function (req, res) {
    try {
        const { orderID } = req.query;
        const sql = "SELECT * FROM Biddings WHERE ID = ?;";
        const [result] = await con.execute(sql, [orderID]);
        res.status(200).json({ orderDetails: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.post("/upload-payment", async function (req, res) {
    try {
        const { paymentID, amount } = req.body;
        const sql = "INSERT INTO Payments (PaymentID, UserID, Amount) VALUES(?, ?, ?);";
        const [result] = await con.execute(sql, [paymentID, req.user.ID, amount]);
        res.status(200).json({ payments: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-payment-history", async function (req, res) {
    try {
        const sql = "SELECT * FROM Payments WHERE UserID = ?;";
        const [result] = await con.execute(sql, [req.user.ID]);
        res.status(200).json({ payments: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

// router.post("/update-bid-status", async function (req, res) {
//     try {
//         const { bidID, status } = req.body;
//         const sql = "UPDATE Biddings SET Status = ? WHERE ID = ?;";
//         const [result] = await con.execute(sql, [bidID, status]);
//         res.status(200).json({ message: "Status updated successfully." });
//     } catch (error) {
//         console.error("An error occurred: ", error);
//         res.status(500).json("Internal server error. Please try again later.");
//     }
// });

router.get("/get-bid-details", async function (req, res) {
    try {
        const bidID = req.query?.bidID;
        if (!bidID) return res.status(500).json("Please provide bid ID as bidID.");
        const [result] = await con.execute(
            "SELECT * FROM `Biddings` JOIN UserDetails ON Biddings.BidderID = UserDetails.ID WHERE Biddings.ID = ?",
            [bidID]
        );
        res.status(200).json({ details: result });
    } catch (err) {
        console.error("An error occurred: ", err);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.post("/upload-documents", upload.array("documents"), async (req, res) => {
    try {
        const { userID, businessName, businessCategory } = req.body;
        const files = req.files;

        if (!userID) return res.status(400).json({ error: "userID is required" });
        if (!files || files.length === 0)
            return res.status(400).json({ error: "No PDF documents uploaded" });

        // Upload each file to Cloudinary
        const uploadPromises = files.map(file =>
            cloudinary.uploader.upload_stream(
                { resource_type: "raw", folder: "gim_vendor_documents" },
                (error, result) => {
                    if (error) throw error;
                }
            )
        );

        // Fix: use a Promise wrapper for upload_stream
        const uploadToCloudinary = file =>
            new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { resource_type: "raw", folder: "user_documents" },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result.secure_url);
                    }
                );
                stream.end(file.buffer);
            });

        const urls = await Promise.all(files.map(uploadToCloudinary));

        // Create CSV string
        const csvURLs = urls.join(",");

        // Insert into DB
        const [result] = await con.execute("INSERT INTO Documents (UserID, BusinessName, BusinessCategory, Documents) VALUES (?, ?, ?, ?)", [userID, businessName, businessCategory, csvURLs]);

        res.status(200).json({ message: "Documents uploaded successfully", documentURLs: urls, });
    } catch (error) {
        console.error("Error uploading documents:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;