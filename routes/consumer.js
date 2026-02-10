var express = require("express"),
    router = express.Router(),
    { con } = require("../database");

router.post("/post-request", async (req, res) => {
    const { title, description, price, pickupCity, deliveryCity, publishStatus } = req.body;
    const query = "INSERT INTO `Requests`(`UserID`, `Title`, `Description`, `Price`, `PickupCity`, `DeliveryCity`, `PublishStatus`) VALUES (?, ?, ?, ?, ?, ?, ?)"; //PublishStatus is either Published or Draft
    try {
        const [result] = await con.execute(query, [req.user.ID, title, description, price, pickupCity, deliveryCity, publishStatus]);
        res.status(200).json({ message: "Request uploaded successfully." });
    } catch (error) {
        console.error("An error occurred:", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.put("/update-request-status", async (req, res) => {
    const { requestID, publishStatus } = req.body; //publishStatus is either Archived or Deleted
    const query = "UPDATE `Requests` SET PublishStatus = ? WHERE ID = ?";
    try {
        const [result] = await con.execute(query, [publishStatus, requestID]);
        if (result.affectedRows === 0)
            return res.status(401).json({ message: "No record updated." });
        res.status(200).json({ message: "Request status updated successfully." });
    } catch (error) {
        console.error("An error occurred:", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-published-requests", async (req, res) => {
    let query = "SELECT * FROM `Requests` WHERE `UserID` = ? AND `PublishStatus` = 'Published'";
    let params = [req.user.ID];

    try {
        const [result] = await con.execute(query, params);
        res.status(200).json({ requests: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-draft-requests", async (req, res) => {
    let query = "SELECT * FROM `Requests` WHERE `UserID` = ? AND `PublishStatus` = 'Draft'";
    let params = [req.user.ID];

    try {
        const [result] = await con.execute(query, params);
        res.status(200).json({ requests: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-deleted-requests", async (req, res) => {
    let query = "SELECT * FROM `Requests` WHERE `UserID` = ? AND `PublishStatus` = 'Deleted'";
    let params = [req.user.ID];

    try {
        const [result] = await con.execute(query, params);
        res.status(200).json({ requests: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-archived-requests", async (req, res) => {
    let query = "SELECT * FROM `Requests` WHERE `UserID` = ? AND `PublishStatus` = 'Archived'";
    let params = [req.user.ID];

    try {
        const [result] = await con.execute(query, params);
        res.status(200).json({ requests: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-received-bids", async function (req, res) {
    try {
        const sql = `SELECT Biddings.ID, Biddings.RequestID, Biddings.BidderID, Biddings.Status, Biddings.Price, Biddings.Commission,Requests.Price AS 'RequestedPrice', Requests.Title AS 'BidTitle', Requests.Description AS 'BidDescription', Requests.PickupCity, Requests.DeliveryCity
            FROM 
                Biddings
            JOIN 
                Requests ON Biddings.RequestID = Requests.ID
            WHERE 
                Biddings.Status = 'Admin approved'
                AND Requests.UserID = ?;
            `;
        const [result] = await con.execute(sql, [req.user.ID]);
        res.status(200).json({ bids: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.post("/decline-bid", async function (req, res) {
    try {
        const { bidID } = req.body;
        const sql = "UPDATE Biddings SET Status = 'Customer declined' WHERE ID = ?;";
        const [result] = await con.execute(sql, [bidID]);
        res.status(200).json({ message: "Status updated successfully." });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.post("/accept-bid", async function (req, res) {
    try {
        const { bidID } = req.body;

        connection = await con.getConnection();
        await connection.beginTransaction(); // Start transaction

        const sql1 = "UPDATE `Biddings` SET `Status` = 'Customer approved' WHERE ID = ?;";
        const sql2 = "INSERT INTO `Orders` (`BidID`) VALUES (?);";

        // Run both queries
        await connection.execute(sql1, [bidID]);
        await connection.execute(sql2, [bidID]);

        // Commit if both succeeded
        await connection.commit();

        res.status(200).json({ message: "Order placed successfully." });
    } catch (error) {
        // Rollback if any query failed
        await connection.rollback();
        console.error("Transaction failed: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-bid-details", async function (req, res) {
    try {
        const { bidID } = req.query;
        if (!bidID) return res.status(500).json("Please provide bid ID as bidID.");
        const query = `SELECT Biddings.ID, Biddings.RequestID, Biddings.BidderID, Requests.Title AS 'BidTitle', Requests.Description AS 'BidDescription', Biddings.DeliveryDate, Biddings.Price, Biddings.Commission, Biddings.Status, Biddings.Dated, UserDetails.FirstName, UserDetails.LastName, UserDetails.Email, UserDetails.Phone, UserDetails.DOB, UserDetails.Password, UserDetails.UserRole FROM Biddings JOIN UserDetails ON Biddings.BidderID = UserDetails.ID JOIN Requests ON Biddings.RequestID = Requests.ID WHERE Biddings.ID = ?`
        // const query = "SELECT * FROM `Biddings` JOIN UserDetails ON Biddings.BidderID = UserDetails.ID WHERE Biddings.ID = ?";
        const [result] = await con.execute(query, [bidID]);
        res.status(200).json({ details: result });
    } catch (err) {
        console.error("An error occurred: ", err);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-my-orders", async function (req, res) {
    try {
        // const sql = "SELECT * FROM Orders JOIN Biddings ON Orders.BidID = Biddings.ID JOIN Requests ON Biddings.RequestID WHERE Requests.UserID = ? AND Orders.OrderStatus != 'Delivered';";
        // const sql = "SELECT Orders.OrderID, Orders.BidID, Orders.OrderStatus, Orders.Rating, Orders.Dated, Biddings.ID AS 'BidID', Biddings.RequestID, Biddings.BidderID, Biddings.DeliveryDate, Biddings.Price, Biddings.Commission, Biddings.Status, Requests.UserID, Requests.Title, Requests.Description, Requests.PickupCity, Requests.PublishStatus FROM Orders JOIN Biddings ON Orders.BidID = Biddings.ID JOIN Requests ON Biddings.RequestID WHERE Requests.UserID = ? AND Orders.OrderStatus != 'Delivered' GROUP BY Orders.BidID;";
        const sql = "SELECT Orders.OrderID, Orders.BidID, Orders.OrderStatus, Orders.Rating, Orders.Dated, Biddings.ID AS 'BidID', Biddings.RequestID, Biddings.BidderID, Biddings.DeliveryDate, Biddings.Price, Biddings.Commission, Biddings.Status, Requests.UserID, Requests.Title, Requests.Description, Requests.PickupCity, Requests.PublishStatus FROM Orders JOIN Biddings ON Orders.BidID = Biddings.ID JOIN Requests ON Biddings.RequestID = Requests.ID WHERE Requests.UserID = ? AND Orders.OrderStatus != 'Delivered';";
        const sql1 = `SELECT *
                    FROM Requests r
                    JOIN Biddings b ON r.ID = b.RequestID
                    JOIN Orders o ON o.BidID = b.ID
                    WHERE r.UserID = ?
                    AND EXISTS (
                        SELECT 1
                        FROM Orders o2
                        JOIN Biddings b2 ON o2.BidID = b2.ID
                        WHERE b2.RequestID = r.ID
                        AND o2.OrderStatus != 'Delivered'
                    );`;
        const [result] = await con.execute(sql, [req.user.ID]);
        res.status(200).json({ orders: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-past-orders", async function (req, res) {
    try {
        const sql = "SELECT Orders.OrderID, Orders.BidID, Orders.OrderStatus, Orders.Rating, Orders.Dated, Biddings.ID AS 'BidID', Biddings.RequestID, Biddings.BidderID, Biddings.DeliveryDate, Biddings.Price, Biddings.Commission, Biddings.Status, Requests.UserID, Requests.Title, Requests.Description, Requests.PickupCity, Requests.PublishStatus FROM Orders JOIN Biddings ON Orders.BidID = Biddings.ID JOIN Requests ON Biddings.RequestID = Requests.ID WHERE Requests.UserID = ? AND Orders.OrderStatus = 'Delivered';";
        const sql1 = `SELECT *
                    FROM Orders
                    JOIN Biddings ON Orders.BidID = Biddings.ID
                    JOIN Requests ON Biddings.RequestID = Requests.ID
                    WHERE Requests.UserID = ?
                    AND Orders.OrderStatus = 'Delivered'
                    LIMIT 1;
                    `;
        const [result] = await con.execute(sql, [req.user.ID]);
        res.status(200).json({ orders: result });
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

// router.get("/get-order-details", async function (req, res) {
//     try {
//         const { orderID } = req.query;
//         if (!orderID) return res.status(500).json("Please provide order ID as orderID.");
//         // const sql = "SELECT * FROM Orders WHERE OrderID = ?;";
//         const sql = "SELECT * FROM Orders JOIN Biddings ON Orders.BidID = Biddings.ID JOIN Requests ON Biddings.RequestID WHERE OrderID = ?;";
//         const [result] = await con.execute(sql, [orderID]);
//         res.status(200).json({ orderDetails: result });
//     } catch (error) {
//         console.error("An error occurred: ", error);
//         res.status(500).json("Internal server error. Please try again later.");
//     }
// });

router.get("/get-order-status", async function (req, res) {
    try {
        const { orderID } = req.query;
        if (!orderID) return res.status(500).json("Please provide order ID as orderID.");
        const sql = "SELECT Orders.OrderStatus, Orders.Rating, Biddings.DeliveryDate FROM Orders JOIN Biddings ON Orders.BidID = Biddings.ID WHERE OrderID = ?;";
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

module.exports = router;
