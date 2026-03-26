const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

const uploadRoute = require("./routes/upload");

const app = express();
const PORT = process.env.PORT || 5000;

// Allow frontend to communicate with backend
app.use(cors());
app.use(express.json());

// All upload requests go to the upload route
app.use("/api", uploadRoute);

// Simple test route
app.get("/", (req, res) => {
  res.json({ message: "SummaryMyNote API is running!" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});