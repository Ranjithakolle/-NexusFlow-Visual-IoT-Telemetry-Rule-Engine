import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

const initialNodes = [
  {
    id: 'sensor',
    type: 'input',
    position: { x: 80, y: 180 },
    data: { label: '🌡️ Sensor Input\nTemperature / Pressure' },
  },
  {
    id: 'condition',
    position: { x: 370, y: 180 },
    data: { label: '⚙️ Threshold Condition\nTemperature > 77°C' },
  },
  {
    id: 'action',
    type: 'output',
    position: { x: 680, y: 180 },
    data: { label: '🚨 Generate Alert\nHigh Temperature Warning' },
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

function CustomNode({ data }) {
  return (
    <div className="rule-flow-node">
      <Handle type="target" position={Position.Left} />
      <div className="rule-flow-node-label">
        {data.label.split('\n').map((line, index) => (
          <div key={index}>{line}</div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  default: CustomNode,
  input: CustomNode,
  output: CustomNode,
};

export default function RuleBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection) => {
      setEdges((currentEdges) =>
        addEdge(
          { ...connection, animated: true },
          currentEdges
        )
      );
    },
    [setEdges]
  );

  const addNode = () => {
    const id = `node-${Date.now()}`;

    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id,
        position: {
          x: 150 + Math.random() * 350,
          y: 100 + Math.random() * 250,
        },
        data: {
          label: '➕ New Rule Node\nConfigure this node',
        },
      },
    ]);
  };

  return (
    <div className="visual-rule-builder">
      <div className="visual-rule-header">
        <div>
          <h2>Visual Rule Builder</h2>
          <p>Connect sensor inputs, conditions and actions.</p>
        </div>

        <button onClick={addNode} className="add-rule-node-btn">
          + Add Node
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
        </ReactFlow>
      </div>

      <p className="rule-flow-hint">
        Drag nodes to reposition them. Connect the handles to create a rule
        workflow.
      </p>
    </div>
  );
}