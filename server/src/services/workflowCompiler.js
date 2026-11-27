
import { Subject } from "rxjs";
import { filter, map, scan, tap } from "rxjs/operators";

const SUPPORTED_SENSORS = new Set([
  "Temperature",
  "Pressure",
  "Humidity",
  "Vibration",
  "Flow Rate",
]);

const SENSOR_FIELDS = {
  Temperature: "temperature",
  Pressure: "pressure",
  Humidity: "humidity",
  Vibration: "vibration",
  "Flow Rate": "flowRate",
};

const SUPPORTED_OPERATORS = new Set([">", "<", ">=", "<="]);

const SUPPORTED_ACTIONS = new Set([
  "Generate Alert",
  "Monitor Machine",
  "Send Notification",
]);

function nodeKind(node) {
  return String(node?.data?.kind || node?.type || "").trim().toLowerCase();
}

function nodeData(node) {
  return node?.data && typeof node.data === "object" ? node.data : {};
}

function compare(value, operator, threshold) {
  switch (operator) {
    case ">": return value > threshold;
    case "<": return value < threshold;
    case ">=": return value >= threshold;
    case "<=": return value <= threshold;
    default: return false;
  }
}

function orderLinearWorkflow(nodes, edges) {
  if (!Array.isArray(nodes) || nodes.length < 3) {
    throw new Error("A workflow must contain at least a Sensor, Condition, and Action node.");
  }

  if (!Array.isArray(edges) || edges.length !== nodes.length - 1) {
    throw new Error("The compiler currently supports one connected, linear workflow.");
  }

  const nodeById = new Map(nodes.map((node) => [String(node.id), node]));

  if (nodeById.size !== nodes.length || nodes.some((node) => !node?.id)) {
    throw new Error("Every workflow node must have a unique id.");
  }

  const outgoing = new Map();
  const incomingCount = new Map(nodes.map((node) => [String(node.id), 0]));

  for (const edge of edges) {
    const source = String(edge?.source ?? "");
    const target = String(edge?.target ?? "");

    if (!nodeById.has(source) || !nodeById.has(target)) {
      throw new Error("A connection refers to a node that does not exist.");
    }

    if (outgoing.has(source)) {
      throw new Error("Branching workflows are not supported yet.");
    }

    outgoing.set(source, target);
    incomingCount.set(target, (incomingCount.get(target) || 0) + 1);
  }

  const starts = nodes.filter(
    (node) => incomingCount.get(String(node.id)) === 0
  );

  if (starts.length !== 1) {
    throw new Error("The workflow must have exactly one starting Sensor node.");
  }

  const ordered = [];
  const visited = new Set();
  let current = starts[0];

  while (current) {
    const id = String(current.id);

    if (visited.has(id)) {
      throw new Error("Workflow cycles are not supported.");
    }

    visited.add(id);
    ordered.push(current);

    const nextId = outgoing.get(id);
    current = nextId ? nodeById.get(nextId) : null;
  }

  if (ordered.length !== nodes.length) {
    throw new Error("Every node must belong to the same connected path.");
  }

  return ordered;
}

/**
 * Compiles a React Flow graph into a running RxJS pipeline.
 * Supported shape: Sensor -> zero or more Math nodes -> Condition -> Action.
 * Math operations: movingAverage, scale/multiply, add/offset.
 */
export function compileWorkflow(workflow, { onAction = () => {} } = {}) {
  const ordered = orderLinearWorkflow(workflow?.nodes, workflow?.edges);
  const kinds = ordered.map(nodeKind);

  if (kinds[0] !== "sensor" || kinds[kinds.length - 1] !== "action") {
    throw new Error("Workflow must start with a Sensor and end with an Action.");
  }

  const conditionIndexes = kinds
    .map((kind, index) => kind === "condition" ? index : -1)
    .filter((index) => index >= 0);

  if (conditionIndexes.length !== 1) {
    throw new Error("A workflow must contain exactly one Condition node.");
  }

  const conditionIndex = conditionIndexes[0];

  const sensorNodes = ordered.filter(
    (node) => nodeKind(node) === "sensor"
  );

  const actionNodes = ordered.filter(
    (node) => nodeKind(node) === "action"
  );

  if (sensorNodes.length !== 1 || actionNodes.length !== 1) {
    throw new Error("A workflow must contain exactly one Sensor and one Action node.");
  }

  const sensor = nodeData(sensorNodes[0]).sensor;

  if (!SUPPORTED_SENSORS.has(sensor)) {
    throw new Error(`Sensor "${sensor}" is not supported.`);
  }

  const sensorField = SENSOR_FIELDS[sensor];

  const condition = nodeData(ordered[conditionIndex]);
  const operator = condition.operator;
  const threshold = Number(condition.threshold);

  if (!SUPPORTED_OPERATORS.has(operator) || !Number.isFinite(threshold)) {
    throw new Error("Condition needs a supported operator and a finite numeric threshold.");
  }

  const action = nodeData(actionNodes[0]).action;

  if (!SUPPORTED_ACTIONS.has(action)) {
    throw new Error(`Action "${action}" is not supported.`);
  }

  const mathNodes = ordered.slice(1, conditionIndex);

  if (mathNodes.some((node) => nodeKind(node) !== "math")) {
    throw new Error("Only Math nodes can appear between the Sensor and Condition nodes.");
  }

  const input$ = new Subject();

  let pipeline$ = input$.pipe(
    map((telemetry) => {
      const value = Number(telemetry?.[sensorField]);

      if (!Number.isFinite(value)) {
        throw new Error(
          `Telemetry is missing a valid ${sensorField} value.`
        );
      }

      return { telemetry, value, sensor };
    })
  );

  for (const mathNode of mathNodes) {
    const data = nodeData(mathNode);

    const operation = String(
      data.operation || data.mathOperation || "movingAverage"
    )
      .trim()
      .toLowerCase();

    if (
      operation === "movingaverage" ||
      operation === "moving_average"
    ) {
      const windowSize = Number(data.windowSize ?? data.period ?? 3);

      if (
        !Number.isInteger(windowSize) ||
        windowSize < 1 ||
        windowSize > 1000
      ) {
        throw new Error(
          `Math node "${mathNode.id}" needs a windowSize between 1 and 1000.`
        );
      }

      pipeline$ = pipeline$.pipe(
        scan((state, context) => {
          const values = [...state.values, context.value].slice(-windowSize);

          const average =
            values.reduce((sum, value) => sum + value, 0) / values.length;

          return {
            values,
            context: {
              ...context,
              value: average,
            },
          };
        }, { values: [], context: null }),

        map((state) => state.context)
      );

    } else if (
      operation === "scale" ||
      operation === "multiply"
    ) {
      const factor = Number(data.factor ?? data.value);

      if (!Number.isFinite(factor)) {
        throw new Error(
          `Math node "${mathNode.id}" needs a valid numeric factor.`
        );
      }

      pipeline$ = pipeline$.pipe(
        map((context) => ({
          ...context,
          value: context.value * factor,
        }))
      );

    } else if (
      operation === "add" ||
      operation === "offset"
    ) {
      const amount = Number(data.amount ?? data.value);

      if (!Number.isFinite(amount)) {
        throw new Error(
          `Math node "${mathNode.id}" needs a valid numeric amount.`
        );
      }

      pipeline$ = pipeline$.pipe(
        map((context) => ({
          ...context,
          value: context.value + amount,
        }))
      );

    } else {
      throw new Error(
        `Math operation "${operation}" is not supported.`
      );
    }
  }

  const inputEvents$ = pipeline$.pipe(
    filter((context) =>
      compare(context.value, operator, threshold)
    ),

    map((context) => ({
      workflowId:
        workflow.id || workflow._id?.toString?.() || null,
      workflowName: workflow.name || "Untitled Workflow",
      nodeId: actionNodes[0].id,
      sensor,
      operator,
      threshold,
      evaluatedValue: context.value,
      action,
      telemetry: context.telemetry,
      triggeredAt: new Date(),
    })),

    tap((event) => onAction(event))
  );

  let subscription = null;

  return {
    start() {
      if (!subscription || subscription.closed) {
        subscription = inputEvents$.subscribe({
          error: (error) => {
            console.error(
              `Workflow "${workflow.name || workflow.id}" execution error:`,
              error
            );
          },
        });
      }

      return this;
    },

    execute(telemetry) {
      input$.next(telemetry);
    },

    stop() {
      subscription?.unsubscribe();
      subscription = null;
      input$.complete();
    },
  };
}
