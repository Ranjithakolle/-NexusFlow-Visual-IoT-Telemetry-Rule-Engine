
import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { compileWorkflow } from "./services/workflowCompiler.js";

dotenv.config();

// =====================================================
// CONFIGURATION
// =====================================================

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 4000;

const TELEMETRY_COLLECTION = "iot_telemetry_ts";
const RULES_COLLECTION = "automation_rules";
const WORKFLOWS_COLLECTION = "automation_workflows";

mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: "http://localhost:5179",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  })
);

app.use(express.json());

// =====================================================
// SOCKET.IO CONFIGURATION
// =====================================================

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5179",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// =====================================================
// MONGODB TELEMETRY MODEL
// =====================================================

const telemetrySchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true,
    },

    metadata: {
      deviceId: {
        type: String,
        required: true,
      },

      machineName: {
        type: String,
        default: "Turbine",
      },
    },

    temperature: {
      type: Number,
      required: true,
    },

    pressure: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["Normal", "Warning"],
      default: "Normal",
    },
  },
  {
    versionKey: false,
    collection: TELEMETRY_COLLECTION,
    autoCreate: false,
    autoIndex: false,
  }
);

const Telemetry = mongoose.model(
  "Telemetry",
  telemetrySchema,
  TELEMETRY_COLLECTION
);

// =====================================================
// MONGODB AUTOMATION RULE MODEL
// =====================================================

const ruleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    sensor: {
      type: String,
      required: true,
      enum: ["Temperature", "Pressure"],
    },

    operator: {
      type: String,
      required: true,
      enum: [">", "<", ">=", "<="],
    },

    threshold: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isFinite,
        message: "Threshold must be a finite number.",
      },
    },

    action: {
      type: String,
      required: true,
      enum: [
        "Generate Alert",
        "Monitor Machine",
        "Send Notification",
      ],
    },

    enabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: RULES_COLLECTION,
    autoCreate: false,
    autoIndex: false,
  }
);

const AutomationRule = mongoose.model(
  "AutomationRule",
  ruleSchema,
  RULES_COLLECTION
);

// =====================================================
// MONGODB VISUAL WORKFLOW MODEL
// =====================================================

const workflowSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    nodes: {
      type: [mongoose.Schema.Types.Mixed],
      required: true,
      default: [],
    },

    edges: {
      type: [mongoose.Schema.Types.Mixed],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
    collection: WORKFLOWS_COLLECTION,
    autoCreate: false,
    autoIndex: false,
  }
);

const AutomationWorkflow = mongoose.model(
  "AutomationWorkflow",
  workflowSchema,
  WORKFLOWS_COLLECTION
);

// =====================================================
// SERIALIZATION HELPERS
// =====================================================

function serializeRule(rule) {
  return {
    id: rule._id.toString(),
    name: rule.name,
    sensor: rule.sensor,
    operator: rule.operator,
    threshold: rule.threshold,
    action: rule.action,
    enabled: rule.enabled,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

function serializeWorkflow(workflow) {
  return {
    id: workflow._id.toString(),
    name: workflow.name,
    nodes: workflow.nodes,
    edges: workflow.edges,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
  };
}

// =====================================================
// RXJS WORKFLOW RUNTIME MANAGER
// =====================================================

const activeWorkflowRuntimes = new Map();

function handleWorkflowAction(event) {
  console.log(
    `Workflow triggered: ${event.workflowName} | ` +
    `${event.sensor}: ${event.evaluatedValue}`
  );

  io.emit("workflow:triggered", event);

  if (
    event.action === "Generate Alert" ||
    event.action === "Send Notification"
  ) {
    io.emit("alert:new", {
      id: new mongoose.Types.ObjectId().toString(),
      title: event.workflowName,
      message:
        `${event.sensor} condition matched. ` +
        `Processed value: ${event.evaluatedValue}`,
      severity: "Warning",
      timestamp: event.triggeredAt,
    });
  }
}

function activateWorkflow(workflow) {
  const workflowId = workflow._id
    ? workflow._id.toString()
    : String(workflow.id);

  const existingRuntime = activeWorkflowRuntimes.get(workflowId);

  if (existingRuntime) {
    existingRuntime.stop();
    activeWorkflowRuntimes.delete(workflowId);
  }

  const runtime = compileWorkflow(
    {
      id: workflowId,
      name: workflow.name,
      nodes: workflow.nodes,
      edges: workflow.edges,
    },
    {
      onAction: handleWorkflowAction,
    }
  );

  runtime.start();
  activeWorkflowRuntimes.set(workflowId, runtime);

  console.log(`Workflow runtime activated: ${workflow.name}`);
}

async function refreshWorkflowRuntimes() {
  for (const runtime of activeWorkflowRuntimes.values()) {
    runtime.stop();
  }

  activeWorkflowRuntimes.clear();

  const workflows = await AutomationWorkflow.find().lean();

  let activatedCount = 0;

  for (const workflow of workflows) {
    try {
      activateWorkflow(workflow);
      activatedCount++;
    } catch (error) {
      console.error(
        `Could not activate workflow "${workflow.name}":`,
        error.message
      );
    }
  }

  console.log(
    `Workflow runtime ready: ${activatedCount}/${workflows.length} workflow(s) activated.`
  );
}

// =====================================================
// CREATE / VERIFY MONGODB COLLECTIONS
// =====================================================

async function ensureCollection(name, options = {}) {
  const db = mongoose.connection.db;

  const existing = await db
    .listCollections({ name })
    .toArray();

  if (existing.length === 0) {
    await db.createCollection(name, options);

    console.log(`MongoDB collection "${name}" created!`);

    return;
  }

  if (
    options.timeseries &&
    !existing[0].options?.timeseries
  ) {
    throw new Error(
      `${name} already exists as a normal collection. Please check it in MongoDB Atlas.`
    );
  }

  console.log(`MongoDB collection "${name}" already exists!`);
}

async function setupDatabaseCollections() {
  await ensureCollection(TELEMETRY_COLLECTION, {
    timeseries: {
      timeField: "timestamp",
      metaField: "metadata",
      granularity: "seconds",
    },
  });

  await ensureCollection(RULES_COLLECTION);

  await ensureCollection(WORKFLOWS_COLLECTION);

  // Seed starter rules only when the collection is empty.

  const existingRuleCount =
    await AutomationRule.countDocuments();

  if (existingRuleCount === 0) {
    await AutomationRule.insertMany([
      {
        name: "High Temperature Alert",
        sensor: "Temperature",
        operator: ">",
        threshold: 77,
        action: "Generate Alert",
        enabled: true,
      },
      {
        name: "High Pressure Alert",
        sensor: "Pressure",
        operator: ">",
        threshold: 38,
        action: "Generate Alert",
        enabled: true,
      },
      {
        name: "Machine Monitoring",
        sensor: "Temperature",
        operator: "<",
        threshold: 80,
        action: "Monitor Machine",
        enabled: true,
      },
    ]);

    console.log("Starter automation rules inserted!");
  }
}

// =====================================================
// HEALTH CHECK API
// =====================================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "NexusFlow backend is running!",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// =====================================================
// AUTOMATION RULE APIs
// =====================================================

// GET ALL RULES

app.get("/api/rules", async (req, res) => {
  try {
    const rules = await AutomationRule.find().sort({
      createdAt: 1,
    });

    res.json({
      success: true,
      rules: rules.map(serializeRule),
    });
  } catch (error) {
    console.error("Error fetching rules:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch automation rules.",
    });
  }
});

// CREATE A NEW RULE

app.post("/api/rules", async (req, res) => {
  try {
    const {
      name,
      sensor,
      operator,
      threshold,
      action,
    } = req.body;

    if (
      !name ||
      !sensor ||
      !operator ||
      threshold === undefined ||
      !action ||
      !Number.isFinite(Number(threshold))
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid rule details.",
      });
    }

    const rule = await AutomationRule.create({
      name,
      sensor,
      operator,
      threshold: Number(threshold),
      action,
      enabled: true,
    });

    res.status(201).json({
      success: true,
      message: "Automation rule created successfully!",
      rule: serializeRule(rule),
    });
  } catch (error) {
    console.error("Error creating rule:", error);

    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to create automation rule.",
    });
  }
});

// ENABLE / DISABLE A RULE

app.patch("/api/rules/:id", async (req, res) => {
  try {
    if (typeof req.body.enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "The enabled field must be true or false.",
      });
    }

    const rule = await AutomationRule.findByIdAndUpdate(
      req.params.id,
      { enabled: req.body.enabled },
      { new: true, runValidators: true }
    );

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Rule not found.",
      });
    }

    res.json({
      success: true,
      message: "Rule updated successfully!",
      rule: serializeRule(rule),
    });
  } catch (error) {
    console.error("Error updating rule:", error);

    res.status(400).json({
      success: false,
      message: "Failed to update rule.",
    });
  }
});

// DELETE A RULE

app.delete("/api/rules/:id", async (req, res) => {
  try {
    const rule = await AutomationRule.findByIdAndDelete(
      req.params.id
    );

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Rule not found.",
      });
    }

    res.json({
      success: true,
      message: "Rule deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting rule:", error);

    res.status(400).json({
      success: false,
      message: "Failed to delete rule.",
    });
  }
});

// =====================================================
// VISUAL WORKFLOW APIs
// =====================================================

// GET ALL SAVED WORKFLOWS

app.get("/api/workflows", async (req, res) => {
  try {
    const workflows = await AutomationWorkflow.find()
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      count: workflows.length,
      workflows: workflows.map(serializeWorkflow),
    });
  } catch (error) {
    console.error("Error fetching workflows:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch visual workflows.",
    });
  }
});

// SAVE A NEW VISUAL WORKFLOW

app.post("/api/workflows", async (req, res) => {
  try {
    const { name, nodes, edges } = req.body;

    if (
      !name ||
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid workflow name.",
      });
    }

    if (
      !Array.isArray(nodes) ||
      nodes.length === 0 ||
      !Array.isArray(edges)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid workflow nodes and edges are required.",
      });
    }

    // Validate the graph by compiling it before saving.

    compileWorkflow(
      {
        name: name.trim(),
        nodes,
        edges,
      },
      {
        onAction: () => {},
      }
    );

    const workflow = await AutomationWorkflow.create({
      name: name.trim(),
      nodes,
      edges,
    });

    console.log(`Workflow saved: ${workflow.name}`);

    // Activate the newly saved workflow.

    activateWorkflow(workflow);

    res.status(201).json({
      success: true,
      message: "Visual workflow saved successfully!",
      workflow: serializeWorkflow(workflow),
    });
  } catch (error) {
    console.error("Error saving workflow:", error);

    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to save visual workflow.",
    });
  }
});

// =====================================================
// RULE EVALUATION HELPERS
// =====================================================
// DELETE WORKFLOW
app.delete("/api/workflows/:id", async (req, res) => {
    try {
        const workflow = await AutomationWorkflow.findByIdAndDelete(
            req.params.id
        );

        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: "Workflow not found"
            });
        }

        const workflowId = workflow._id.toString();

        // Stop the workflow runtime
        const runtime = activeWorkflowRuntimes.get(workflowId);

        if (runtime) {
            runtime.stop();
            activeWorkflowRuntimes.delete(workflowId);
        }

        return res.json({
            success: true,
            message: "Workflow deleted successfully"
        });

    } catch (error) {
        console.error("Workflow deletion error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete workflow"
        });
    }
});
function evaluateCondition(value, operator, threshold) {
  switch (operator) {
    case ">":
      return value > threshold;

    case "<":
      return value < threshold;

    case ">=":
      return value >= threshold;

    case "<=":
      return value <= threshold;

    default:
      return false;
  }
}

async function evaluateAutomationRules(telemetry) {
  const rules = await AutomationRule.find({
    enabled: true,
  });

  const triggeredRules = [];

  for (const rule of rules) {
    const sensorValue =
      rule.sensor === "Temperature"
        ? telemetry.temperature
        : telemetry.pressure;

    const matched = evaluateCondition(
      sensorValue,
      rule.operator,
      rule.threshold
    );

    if (matched) {
      const triggeredRule = serializeRule(rule);

      triggeredRules.push(triggeredRule);

      io.emit("rule:triggered", {
        rule: triggeredRule,

        telemetry: {
          temperature: telemetry.temperature,
          pressure: telemetry.pressure,
          timestamp: telemetry.timestamp,
        },
      });

      console.log(`Rule triggered: ${rule.name}`);

      if (
        rule.action === "Generate Alert" ||
        rule.action === "Send Notification"
      ) {
        io.emit("alert:new", {
          id: new mongoose.Types.ObjectId().toString(),
          title: rule.name,

          message:
            `${rule.sensor} ${rule.operator} ${rule.threshold}. ` +
            `Current value: ${sensorValue}`,

          severity: "Warning",
          timestamp: new Date(),
        });
      }
    }
  }

  return triggeredRules;
}

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
    } = req.body;

    if (
      !Number.isFinite(Number(temperature)) ||
      !Number.isFinite(Number(pressure))
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid temperature and pressure values are required.",
      });
    }

    const telemetryData = {
      timestamp: new Date(),

      metadata: {
        deviceId: deviceId || "TURBINE-001",
        machineName: machineName || "Turbine",
      },

      temperature: Number(temperature),
      pressure: Number(pressure),
      status: "Normal",
    };

    // Evaluate saved automation rules.

    const triggeredRules =
      await evaluateAutomationRules(telemetryData);

    // Execute telemetry through active visual workflows.

    for (const runtime of activeWorkflowRuntimes.values()) {
      runtime.execute(telemetryData);
    }

    const hasAlert = triggeredRules.some(
      (rule) =>
        rule.action === "Generate Alert" ||
        rule.action === "Send Notification"
    );

    telemetryData.status = hasAlert
      ? "Warning"
      : "Normal";

    // Insert telemetry into MongoDB Time-Series collection.

    const savedTelemetry =
      await Telemetry.create(telemetryData);

    const responseData = {
      _id: savedTelemetry._id,
      timestamp: savedTelemetry.timestamp,
      metadata: savedTelemetry.metadata,
      temperature: savedTelemetry.temperature,
      pressure: savedTelemetry.pressure,
      status: savedTelemetry.status,
    };

    // Send new telemetry to connected frontend clients.

    io.emit("telemetry:new", responseData);

    res.status(201).json({
      success: true,
      message: "Telemetry saved successfully!",
      data: responseData,
      triggeredRules,
    });
  } catch (error) {
    console.error("Telemetry ingestion error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to process telemetry.",
      error: error.message,
    });
  }
});

// =====================================================
// GET TELEMETRY HISTORY
// =====================================================

app.get("/api/telemetry", async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(
        Number.parseInt(req.query.limit, 10) || 50,
        1
      ),
      500
    );

    const telemetry = await Telemetry.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      count: telemetry.length,
      data: telemetry,
    });
  } catch (error) {
    console.error("Error fetching telemetry:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch telemetry history.",
    });
  }
});

// =====================================================
// START SERVER
// =====================================================

async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error(
        "MONGODB_URI is missing from the server .env file."
      );
    }

    await mongoose.connect(mongoUri);

    console.log("MongoDB connected successfully!");

    await setupDatabaseCollections();

    // Load and activate previously saved workflows.

    await refreshWorkflowRuntimes();

    httpServer.listen(PORT, () => {
      console.log(
        `NexusFlow server running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Failed to start NexusFlow server:",
      error
    );

    process.exit(1);
  }
}

startServer();
