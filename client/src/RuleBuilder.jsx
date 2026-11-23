
import { useCallback } from 'react';

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

// =====================================================
// INITIAL WORKFLOW
// =====================================================

const initialNodes = [
  {
    id: 'sensor',
    type: 'sensor',
    position: { x: 80, y: 180 },
    data: {
      kind: 'sensor',
      sensor: 'Temperature',
    },
  },
  {
    id: 'condition',
    type: 'condition',
    position: { x: 390, y: 180 },
    data: {
      kind: 'condition',
      operator: '>',
      threshold: '77',
    },
  },
  {
    id: 'action',
    type: 'action',
    position: { x: 730, y: 180 },
    data: {
      kind: 'action',
      action: 'Generate Alert',
    },
  },
];

const initialEdges = [
  {
    id: 'sensor-condition',
    source: 'sensor',
    target: 'condition',
    animated: true,
  },
  {
    id: 'condition-action',
    source: 'condition',
    target: 'action',
    animated: true,
  },
];

// =====================================================
// NODE STYLES
// =====================================================

const nodeStyle = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '16px',
  minWidth: '210px',
  color: '#1e293b',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

const fieldStyle = {
  width: '100%',
  padding: '8px',
  marginTop: '8px',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  background: '#f8fafc',
  color: '#1e293b',
  fontSize: '13px',
};

// =====================================================
// CUSTOM CONFIGURABLE NODE
// =====================================================

function CustomNode({ id, data }) {
  const { updateNodeData } = useReactFlow();

  const updateField = (field, value) => {
    updateNodeData(id, {
      [field]: value,
    });
  };

  return (
    <div
      className="rule-flow-node"
      style={nodeStyle}
    >
      {data.kind !== 'sensor' && (
        <Handle
          type="target"
          position={Position.Left}
        />
      )}

      {data.kind === 'sensor' && (
        <>
          <strong>🌡️ Sensor Input</strong>

          <p>Choose the sensor source</p>

          <select
            className="nodrag"
            style={fieldStyle}
            value={data.sensor}
            onChange={(event) =>
              updateField('sensor', event.target.value)
            }
          >
            <option value="Temperature">Temperature</option>
            <option value="Pressure">Pressure</option>
          </select>
        </>
      )}

      {data.kind === 'condition' && (
        <>
          <strong>⚙️ Threshold Condition</strong>

          <p>Configure the comparison</p>

          <select
            className="nodrag"
            style={fieldStyle}
            value={data.operator}
            onChange={(event) =>
              updateField('operator', event.target.value)
            }
          >
            <option value=">">Greater than (&gt;)</option>
            <option value="<">Less than (&lt;)</option>
            <option value=">=">Greater than or equal (≥)</option>
            <option value="<=">Less than or equal (≤)</option>
          </select>

          <input
            className="nodrag"
            style={fieldStyle}
            type="number"
            value={data.threshold}
            onChange={(event) =>
              updateField('threshold', event.target.value)
            }
            placeholder="Enter threshold"
          />
        </>
      )}

      {data.kind === 'action' && (
        <>
          <strong>🚨 Action</strong>

          <p>Choose what happens when the condition matches</p>

          <select
            className="nodrag"
            style={fieldStyle}
            value={data.action}
            onChange={(event) =>
              updateField('action', event.target.value)
            }
          >
            <option value="Generate Alert">Generate Alert</option>
            <option value="Monitor Machine">Monitor Machine</option>
            <option value="Send Notification">Send Notification</option>
          </select>
        </>
      )}

      {data.kind !== 'action' && (
        <Handle
          type="source"
          position={Position.Right}
        />
      )}
    </div>
  );
}

// =====================================================
// NODE TYPES
// =====================================================

const nodeTypes = {
  sensor: CustomNode,
  condition: CustomNode,
  action: CustomNode,
};

// =====================================================
// MAIN RULE BUILDER
// =====================================================

export default function RuleBuilder() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState(initialNodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            animated: true,
          },
          currentEdges
        )
      );
    },
    [setEdges]
  );

  // =====================================================
  // ADD NEW NODES
  // =====================================================

  const addNode = (kind) => {
    const id = `${kind}-${Date.now()}`;

    const defaultData = {
      sensor: {
        kind: 'sensor',
        sensor: 'Temperature',
      },
      condition: {
        kind: 'condition',
        operator: '>',
        threshold: '77',
      },
      action: {
        kind: 'action',
        action: 'Generate Alert',
      },
    };

    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id,
        type: kind,
        position: {
          x: 150 + Math.random() * 350,
          y: 100 + Math.random() * 250,
        },
        data: defaultData[kind],
      },
    ]);
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="visual-rule-builder">

      <div className="visual-rule-header">
        <div>
          <h2>Visual Rule Builder</h2>
          <p>
            Configure sensors, conditions and automation actions.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '14px',
        }}
      >
        <button
          className="add-rule-node-btn"
          onClick={() => addNode('sensor')}
        >
          + Sensor
        </button>

        <button
          className="add-rule-node-btn"
          onClick={() => addNode('condition')}
        >
          + Condition
        </button>

        <button
          className="add-rule-node-btn"
          onClick={() => addNode('action')}
        >
          + Action
        </button>
      </div>

      <div className="rule-flow-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background />
          <MiniMap />
          <Controls />

          <Panel position="top-right">
            <div
              style={{
                background: '#ffffff',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#334155',
                border: '1px solid #e2e8f0',
              }}
            >
              {nodes.length} Nodes · {edges.length} Connections
            </div>
          </Panel>
        </ReactFlow>
      </div>

      <p className="rule-flow-hint">
        Drag nodes to reposition them. Connect the handles to
        create your workflow. Configure each node using its fields.
      </p>

    </div>
  );
}
