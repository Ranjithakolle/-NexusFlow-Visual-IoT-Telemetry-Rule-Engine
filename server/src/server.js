
import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";

dotenv.config();

// =====================================================
// CONFIGURATION
// =====================================================

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 4000;
const COLLECTION_NAME = "iot_telemetry_ts";

// Prevent Mongoose from creating a normal collection.
// We will create the MongoDB Time-Series collection manually.
mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  })
);

app.use(express.json());

// =====================================================
// SOCKET.IO CONFIGURATION
// =====================================================

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// =====================================================
// MONGODB TIME-SERIES MODEL
// =====================================================

const telemetrySchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true
    },

    metadata: {
      deviceId: {
        type: String,
        required: true
      },

      machineName: {
        type: String,
        default: "Turbine"
      }
    },

    temperature: {
      type: Number,
      required: true
    },

    pressure: {
      type: Number,
      required: true
    },

    status: {
      type: String,
      enum: ["Normal", "Warning"],
      default: "Normal"
    }
  },
  {
    versionKey: false,
    collection: COLLECTION_NAME,
    autoCreate: false,
    autoIndex: false
  }
);

const Telemetry = mongoose.model(
  "Telemetry",
  telemetrySchema,
  COLLECTION_NAME
);

// =====================================================
// CREATE MONGODB TIME-SERIES COLLECTION
// =====================================================

async function setupTimeSeriesCollection() {
  const db = mongoose.connection.db;

  const existing = await db
    .listCollections({ name: COLLECTION_NAME })
    .toArray();

  if (existing.length === 0) {
    await db.createCollection(COLLECTION_NAME, {
      timeseries: {
        timeField: "timestamp",
        metaField: "metadata",
        granularity: "seconds"
      }
    });

    console.log("MongoDB Time-Series collection created!");
    return;
  }

  if (!existing[0].options?.timeseries) {
    throw new Error(
      `${COLLECTION_NAME} already exists as a normal collection. Please check it in MongoDB Atlas.`
    );
  }

  console.log("MongoDB Time-Series collection already exists!");
}

// =====================================================
// HEALTH CHECK API
// =====================================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    project: "NexusFlow",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
    message: "Backend server is running"
  });
});

// =====================================================
// TELEMETRY INGESTION API
// =====================================================

app.post("/api/telemetry", async (req, res) => {
  try {
    const {
      temperature,
      pressure,
      deviceId,
      machineName,
      timestamp
    } = req.body;

    if (
      typeof temperature !== "number" ||
      !Number.isFinite(temperature) ||
      typeof pressure !== "number" ||
      !Number.isFinite(pressure)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid temperature and pressure numbers are required."
      });
    }

    const readingTime = timestamp
      ? new Date(timestamp)
      : new Date();

    if (Number.isNaN(readingTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid timestamp."
      });
    }

    const reading = await Telemetry.create({
      timestamp: readingTime,

      metadata: {
        deviceId: deviceId || "T-001",
        machineName: machineName || "Turbine"
      },

      temperature,
      pressure,

      status: temperature > 77 ? "Warning" : "Normal"
    });

    // Send new reading to connected frontend clients.
    io.emit("telemetry:new", reading);

    return res.status(201).json({
      success: true,
      message: "Telemetry stored successfully!",
      data: reading
    });

  } catch (error) {
    console.error("Telemetry ingestion error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to store telemetry.",
      error: error.message
    });
  }
});

// =====================================================
// GET TELEMETRY HISTORY API
// =====================================================

app.get("/api/telemetry", async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);

    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 500)
      : 20;

    const readings = await Telemetry.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      count: readings.length,
      data: readings
    });

  } catch (error) {
    console.error("Telemetry retrieval error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve telemetry.",
      error: error.message
    });
  }
});

// =====================================================
// START SERVER AFTER DATABASE CONNECTION
// =====================================================

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully!");

    await setupTimeSeriesCollection();

    httpServer.listen(PORT, () => {
      console.log(
        `NexusFlow server running at http://localhost:${PORT}`
      );
    });

  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
