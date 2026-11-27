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

