require("dotenv").config();
const express = require("express"),
    http = require("http"),
    cors = require("cors"),
    bodyParser = require("body-parser"),
    { con } = require("./database"),
    authenticateToken = require("./authenticateToken"),
    auth = require("./routes/auth"),
    consumer = require("./routes/consumer"),
    vendor = require("./routes/vendor"),
    admin = require("./routes/admin"),
    profile = require("./routes/profile"),
    app = express(),
    server = http.createServer(app);

const allowedOrigins = ["http://localhost:5173"];

// app.use(cors());
app.use(
    cors({
        origin: function (origin, callback) {
            // allow requests with no origin (like mobile apps or curl)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            } else {
                return callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(bodyParser.json());
// app.use('/assets', express.static(path.join(__dirname, 'assets')))

app.use("/auth", auth);
app.use(authenticateToken);

app.use("/consumer", consumer);
app.use("/vendor", vendor);
app.use("/admin", admin);
app.use("/profile", profile);

app.get("*", (req, res) => {
    // console.log('This is requested URL: ' + req.url);
    res.status(404).json("API not found.");
});

const port = process.env.PORT;
server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
