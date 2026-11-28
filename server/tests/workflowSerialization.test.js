import test from "node:test";
import assert from "node:assert/strict";
import { compileWorkflow } from "../src/services/workflowCompiler.js";

const sampleWorkflow = {
  id: "serialization-test-001",
  name: "Temperature Moving Average Test",
  nodes: [
    {
      id: "sensor",
      type: "sensor",
      data: {
        kind: "sensor",
        sensor: "Temperature"
      }
    },
    {
      id: "math",
      type: "math",
      data: {
        kind: "math",
        operation: "movingAverage",
        windowSize: "3"
      }
    },
    {
      id: "condition",
      type: "condition",
      data: {
        kind: "condition",
        operator: ">",
        threshold: "81.5"
      }
    },
    {
      id: "action",
      type: "action",
      data: {
        kind: "action",
        action: "Generate Alert"
      }
    }
  ],
  edges: [
    { id: "edge-1", source: "sensor", target: "math" },
    { id: "edge-2", source: "math", target: "condition" },
    { id: "edge-3", source: "condition", target: "action" }
  ]
};

test("Workflow JSON serialization preserves all nodes, edges and configuration", () => {
  const serialized = JSON.stringify(sampleWorkflow);
  const restored = JSON.parse(serialized);

  assert.deepStrictEqual(restored, sampleWorkflow);
});

test("Restored workflow can be compiled and execute Moving Average", () => {
  const restored = JSON.parse(JSON.stringify(sampleWorkflow));
  const triggeredEvents = [];

  const runtime = compileWorkflow(restored, {
    onAction: (event) => triggeredEvents.push(event)
  });

  runtime.start();

  [80, 82, 84].forEach((temperature) => {
    runtime.execute({ temperature, pressure: 30 });
  });

  runtime.stop();

  assert.equal(triggeredEvents.length, 1);
  assert.equal(triggeredEvents[0].evaluatedValue, 82);
  assert.equal(triggeredEvents[0].action, "Generate Alert");
  assert.equal(triggeredEvents[0].workflowName, sampleWorkflow.name);
});

test("Restored workflow preserves Math node configuration", () => {
  const restored = JSON.parse(JSON.stringify(sampleWorkflow));

  const mathNode = restored.nodes.find(
    (node) => node.type === "math"
  );

  assert.equal(mathNode.data.operation, "movingAverage");
  assert.equal(mathNode.data.windowSize, "3");
});

function createMathWorkflow(operation, mathConfig, threshold) {
  return {
    id: `math-test-${operation}`,
    name: `${operation} Test`,
    nodes: [
      {
        id: "sensor",
        type: "sensor",
        data: {
          kind: "sensor",
          sensor: "Temperature",
        },
      },
      {
        id: "math",
        type: "math",
        data: {
          kind: "math",
          operation,
          ...mathConfig,
        },
      },
      {
        id: "condition",
        type: "condition",
        data: {
          kind: "condition",
          operator: ">",
          threshold,
        },
      },
      {
        id: "action",
        type: "action",
        data: {
          kind: "action",
          action: "Generate Alert",
        },
      },
    ],
    edges: [
      { id: "edge-1", source: "sensor", target: "math" },
      { id: "edge-2", source: "math", target: "condition" },
      { id: "edge-3", source: "condition", target: "action" },
    ],
  };
}

test("Scale Math operation multiplies sensor readings correctly", () => {
  const workflow = createMathWorkflow(
    "scale",
    { factor: 2 },
    15
  );

  const events = [];

  const runtime = compileWorkflow(workflow, {
    onAction: (event) => events.push(event),
  });

  runtime.start();
  runtime.execute({ temperature: 10 });
  runtime.stop();

  assert.equal(events.length, 1);
  assert.equal(events[0].evaluatedValue, 20);
  assert.equal(events[0].action, "Generate Alert");
});

test("Add Math operation adds an offset correctly", () => {
  const workflow = createMathWorkflow(
    "add",
    { amount: 5 },
    14
  );

  const events = [];

  const runtime = compileWorkflow(workflow, {
    onAction: (event) => events.push(event),
  });

  runtime.start();
  runtime.execute({ temperature: 10 });
  runtime.stop();

  assert.equal(events.length, 1);
  assert.equal(events[0].evaluatedValue, 15);
  assert.equal(events[0].action, "Generate Alert");
});

test("Condition operator > triggers only when value is greater", () => {
  const workflow = createMathWorkflow("scale", { factor: 1 }, 10);
  const events = [];

  const runtime = compileWorkflow(workflow, {
    onAction: (event) => events.push(event),
  });

  runtime.start();
  runtime.execute({ temperature: 12 });
  runtime.execute({ temperature: 10 });
  runtime.stop();

  assert.equal(events.length, 1);
  assert.equal(events[0].evaluatedValue, 12);
});

test("Condition operator < triggers only when value is smaller", () => {
  const workflow = createMathWorkflow("scale", { factor: 1 }, 10);
  workflow.nodes.find((node) => node.type === "condition").data.operator = "<";

  const events = [];
  const runtime = compileWorkflow(workflow, {
    onAction: (event) => events.push(event),
  });

  runtime.start();
  runtime.execute({ temperature: 8 });
  runtime.execute({ temperature: 10 });
  runtime.stop();

  assert.equal(events.length, 1);
  assert.equal(events[0].evaluatedValue, 8);
});

test("Condition operator >= includes equal values", () => {
  const workflow = createMathWorkflow("scale", { factor: 1 }, 10);
  workflow.nodes.find((node) => node.type === "condition").data.operator = ">=";

  const events = [];
  const runtime = compileWorkflow(workflow, {
    onAction: (event) => events.push(event),
  });

  runtime.start();
  runtime.execute({ temperature: 10 });
  runtime.stop();

  assert.equal(events.length, 1);
  assert.equal(events[0].evaluatedValue, 10);
});

test("Condition operator <= includes equal values", () => {
  const workflow = createMathWorkflow("scale", { factor: 1 }, 10);
  workflow.nodes.find((node) => node.type === "condition").data.operator = "<=";

  const events = [];
  const runtime = compileWorkflow(workflow, {
    onAction: (event) => events.push(event),
  });

  runtime.start();
  runtime.execute({ temperature: 10 });
  runtime.stop();

  assert.equal(events.length, 1);
  assert.equal(events[0].evaluatedValue, 10);
});

test("Workflow compiler supports all five sensor types", () => {
  const sensorCases = [
    { sensor: "Temperature", field: "temperature", value: 85 },
    { sensor: "Pressure", field: "pressure", value: 42 },
    { sensor: "Humidity", field: "humidity", value: 75 },
    { sensor: "Vibration", field: "vibration", value: 12 },
    { sensor: "Flow Rate", field: "flowRate", value: 120 },
  ];

  for (const sensorCase of sensorCases) {
    const workflow = createMathWorkflow(
      "scale",
      { factor: 1 },
      sensorCase.value - 1
    );

    workflow.nodes.find(
      (node) => node.type === "sensor"
    ).data.sensor = sensorCase.sensor;

    const events = [];

    const runtime = compileWorkflow(workflow, {
      onAction: (event) => events.push(event),
    });

    runtime.start();
    runtime.execute({
      [sensorCase.field]: sensorCase.value,
    });
    runtime.stop();

    assert.equal(
      events.length,
      1,
      `${sensorCase.sensor} should trigger the workflow`
    );

    assert.equal(events[0].evaluatedValue, sensorCase.value);
  }
});

test("Workflow compiler supports all three action types", () => {
  const actions = [
    "Generate Alert",
    "Monitor Machine",
    "Send Notification",
  ];

  for (const action of actions) {
    const workflow = createMathWorkflow(
      "scale",
      { factor: 1 },
      50
    );

    workflow.nodes.find(
      (node) => node.type === "action"
    ).data.action = action;

    const events = [];

    const runtime = compileWorkflow(workflow, {
      onAction: (event) => events.push(event),
    });

    runtime.start();
    runtime.execute({ temperature: 85 });
    runtime.stop();

    assert.equal(
      events.length,
      1,
      `${action} should execute`
    );

    assert.equal(events[0].action, action);
    assert.equal(events[0].evaluatedValue, 85);
  }
});

