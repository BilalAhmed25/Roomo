var express = require("express"),
    router = express.Router(),
    { con } = require("../database");

router.get("/get-all-profiles", async (req, res) => {
    try {
        const [result] = await con.execute("SELECT * FROM `UserDetails` ORDER BY ID DESC");
        res.status(200).json(result);
    } catch (error) {
        console.error("An error occurred:", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-user-details", async (req, res) => {
    const { userID, email } = req.query;

    try {
        let query = "";
        let params = [];

        if (userID) {
            query = "SELECT * FROM `UserDetails` WHERE ID = ?";
            params = [userID];
        } else if (email) {
            query = "SELECT * FROM `UserDetails` WHERE Email = ?";
            params = [email];
        } else {
            return res.status(400).json({ message: "Missing userID or email in query parameters." });
        }

        const [result] = await con.execute(query, params);
        res.status(200).json(result);
    } catch (error) {
        console.error("An error occurred:", error);
        res.status(500).json({ message: "Internal server error. Please try again later." });
    }
});

router.put("/update-profile-status", async (req, res) => {
    try {
        const { userID, status } = req.body;
        const [result] = await con.execute("UPDATE `UserDetails` SET Status = ? WHERE ID = ?;", [status, userID]);
        res.status(200).json('Profile status updated successfully.');
    } catch (error) {
        console.error("An error occurred:", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-all-orders", async (req, res) => {
    try {
        const query = `SELECT
            o.OrderID,
            o.OrderStatus,
            o.Rating,
            o.Dated AS OrderDate,

            -- Bid details
            b.ID AS BidID,
            b.Price AS BidPrice,
            b.Commission,
            b.Status AS BidStatus,
            b.Dated AS BidDate,
            b.DeliveryDate,

            -- Request details
            r.ID AS RequestID,
            r.Title AS RequestTitle,
            r.Description AS RequestDescription,
            r.Price AS RequestPrice,
            r.Quantity AS RequestQuantity,
            r.PickupCity,
            r.DeliveryCity,
            r.Status AS RequestStatus,
            r.PublishStatus,

            -- Consumer / Requester details
            consumer.ID AS ConsumerID,
            consumer.FirstName AS ConsumerFirstName,
            consumer.LastName AS ConsumerLastName,
            consumer.Email AS ConsumerEmail,
            consumer.Phone AS ConsumerPhone,
            consumer.UserRole AS ConsumerRole,
            consumer.Status AS ConsumerStatus,

            -- Vendor / Bidder details
            vendor.ID AS VendorID,
            vendor.FirstName AS VendorFirstName,
            vendor.LastName AS VendorLastName,
            vendor.Email AS VendorEmail,
            vendor.Phone AS VendorPhone,
            vendor.UserRole AS VendorRole,
            vendor.Status AS VendorStatus

        FROM Orders o
        JOIN Biddings b ON o.BidID = b.ID
        JOIN Requests r ON b.RequestID = r.ID
        JOIN UserDetails consumer ON r.UserID = consumer.ID
        JOIN UserDetails vendor ON b.BidderID = vendor.ID

        WHERE o.OrderID = 1 ORDER BY o.OrderID DESC;
            `;
        const [result] = await con.execute(query);
        res.status(200).json(result);
    } catch (error) {
        console.error("An error occurred:", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-all-bids", async (req, res) => {
    let query = "SELECT Requests.*, Biddings.ID AS 'BidID', Biddings.BidderID, Biddings.DeliveryDate, Biddings.Price AS 'BidPrice', Biddings.Commission, Biddings.Status AS 'BidStatus', Biddings.Dated, UserDetails.FirstName, UserDetails.LastName, UserDetails.Email, UserDetails.Phone, UserDetails.Status FROM `Requests` JOIN Biddings ON Requests.ID = Biddings.RequestID JOIN UserDetails ON Biddings.BidderID = UserDetails.ID WHERE Requests.PublishStatus = 'Published' ORDER BY Biddings.ID DESC;";
    try {
        const [result] = await con.execute(query);
        res.status(200).json(result);
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-payment-history", async function (req, res) {
    try {
        const { status } = req.body;
        const sql = "SELECT * FROM Payments";
        const [result] = await con.execute(sql, [req.user.ID, status]);
        res.status(200).json(result);
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.get("/get-all-requests", async function (req, res) {
    try {
        const sql = `SELECT 
                        Requests.ID AS RequestID,
                        Requests.Title AS RequestTitle,
                        Requests.Description AS RequestDescription,
                        Requests.Price AS RequestPrice,
                        Requests.Quantity AS RequestedQuantity,
                        Requests.PickupCity,
                        Requests.DeliveryCity,
                        Requests.Status AS RequestStatus,
                        Requests.PublishStatus,

                        Biddings.ID AS BidID,
                        Biddings.DeliveryDate,
                        Biddings.Price AS BidPrice,
                        Biddings.Commission,
                        Biddings.Status AS BidStatus,
                        Biddings.Dated AS BidDated,

                        Consumer.ID AS ConsumerID,
                        Consumer.FirstName AS ConsumerFirstName,
                        Consumer.LastName AS ConsumerLastName,
                        Consumer.Email AS ConsumerEmail,
                        Consumer.Phone AS ConsumerPhone,
                        Consumer.UserRole AS ConsumerRole,
                        Consumer.Status AS ConsumerStatus,

                        Vendor.ID AS VendorID,
                        Vendor.FirstName AS VendorFirstName,
                        Vendor.LastName AS VendorLastName,
                        Vendor.Email AS VendorEmail,
                        Vendor.Phone AS VendorPhone,
                        Vendor.UserRole AS VendorRole,
                        Vendor.Status AS VendorStatus

                    FROM Requests
                    LEFT JOIN Biddings 
                        ON Requests.ID = Biddings.RequestID
                    LEFT JOIN UserDetails AS Vendor 
                        ON Biddings.BidderID = Vendor.ID
                    JOIN UserDetails AS Consumer 
                        ON Requests.UserID = Consumer.ID
                        ORDER BY RequestID DESC;
                    `;
        const [result] = await con.execute(sql);
        res.status(200).json(result);
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.put("/add-commission", async function (req, res) {
    try {
        const { bidID, commissionAmount } = req.body;
        const sql = "UPDATE Biddings SET Status = 'Admin approved', Commission = ? WHERE ID = ?;";
        const [result] = await con.execute(sql, [commissionAmount, bidID]);
        res.status(200).json('Successfully updated commission.');
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.put("/update-bid-status", async function (req, res) {
    try {
        const { bidID, bidStatus } = req.body;
        const sql = "UPDATE Biddings SET Status = ? WHERE ID = ?;";
        const [result] = await con.execute(sql, [bidStatus, bidID]);
        res.status(200).json('Successfully updated bid status.');
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.put("/update-order-status", async function (req, res) {
    try {
        const { orderID, orderStatus } = req.body;
        const sql = "UPDATE Orders SET OrderStatus = ? WHERE OrderID = ?;";
        const [result] = await con.execute(sql, [orderStatus, orderID]);
        res.status(200).json('Successfully updated order status.');
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

router.delete("/delete-my-bid", async function (req, res) {
    try {
        const { requestID } = req.query;
        console.log("Request ID to delete bid:", requestID);
        const sql = "DELETE FROM Biddings WHERE RequestID = ? AND BidderID = ?;";
        const [result] = await con.execute(sql, [requestID, req.user.ID]);
        res.status(200).json('Successfully deleted bid.');
    } catch (error) {
        console.error("An error occurred: ", error);
        res.status(500).json("Internal server error. Please try again later.");
    }
});

module.exports = router;