
import { useCallback, useEffect, useState } from 'react';

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

const API_URL = 'http://localhost:4000';

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
    <div className="rule-flow-node" style={nodeStyle}>
      {data.kind !== 'sensor' && (
        <Handle type="target" position={Position.Left} />
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
        <Handle type="source" position={Position.Right} />
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

  const [workflowName, setWorkflowName] = useState('');
  const [savedWorkflows, setSavedWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState('');

  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // =====================================================
  // LOAD SAVED WORKFLOWS FROM MONGODB
  // =====================================================

  const fetchWorkflows = useCallback(async () => {
    setLoadingWorkflows(true);

    try {
      const response = await fetch(`${API_URL}/api/workflows`);

      if (!response.ok) {
        throw new Error('Could not fetch saved workflows.');
      }

      const result = await response.json();

      setSavedWorkflows(result.workflows || []);
    } catch (error) {
      console.error('Workflow loading error:', error);

      setMessage('Could not load saved workflows.');
      setMessageType('error');
    } finally {
      setLoadingWorkflows(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // =====================================================
  // CONNECT NODES
  // =====================================================

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
  // SAVE WORKFLOW TO MONGODB
  // =====================================================

  const saveWorkflow = async () => {
    const name = workflowName.trim();

    // 1. Validate workflow name
    if (!name) {
      setMessage('Please enter a workflow name.');
      setMessageType('error');
      return;
    }

    // 2. Find the required workflow nodes
    const sensorNode = nodes.find((node) => node.type === 'sensor');
    const conditionNode = nodes.find((node) => node.type === 'condition');
    const actionNode = nodes.find((node) => node.type === 'action');

    if (!sensorNode) {
      setMessage('Please add a Sensor node.');
      setMessageType('error');
      return;
    }

    if (!conditionNode) {
      setMessage('Please add a Condition node.');
      setMessageType('error');
      return;
    }

    if (!actionNode) {
      setMessage('Please add an Action node.');
      setMessageType('error');
      return;
    }

    // 3. Validate the condition threshold
    const thresholdValue = conditionNode.data?.threshold;
    const threshold = Number(thresholdValue);

    if (
      thresholdValue === undefined ||
      thresholdValue === null ||
      String(thresholdValue).trim() === '' ||
      !Number.isFinite(threshold)
    ) {
      setMessage('Please enter a valid numeric threshold.');
      setMessageType('error');
      return;
    }

    // 4. Validate Sensor -> Condition connection
    const sensorConnected = edges.some(
      (edge) =>
        edge.source === sensorNode.id &&
        edge.target === conditionNode.id
    );

    if (!sensorConnected) {
      setMessage('Connect the Sensor node to the Condition node.');
      setMessageType('error');
      return;
    }

    // 5. Validate Condition -> Action connection
    const actionConnected = edges.some(
      (edge) =>
        edge.source === conditionNode.id &&
        edge.target === actionNode.id
    );

    if (!actionConnected) {
      setMessage('Connect the Condition node to the Action node.');
      setMessageType('error');
      return;
    }

    // All validations passed. Save the workflow to MongoDB.
    setSavingWorkflow(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          nodes,
          edges,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Failed to save workflow.'
        );
      }

      setMessage(`Workflow "${name}" saved successfully!`);
      setMessageType('success');

      setSelectedWorkflow(
        result.workflow?._id || result.workflow?.id || ''
      );

      await fetchWorkflows();
    } catch (error) {
      console.error('Workflow saving error:', error);

      setMessage(error.message || 'Could not save workflow.');
      setMessageType('error');
    } finally {
      setSavingWorkflow(false);
    }
  };

  // =====================================================
  // LOAD SELECTED WORKFLOW
  // =====================================================

  const loadWorkflow = () => {
    if (!selectedWorkflow) {
      setMessage('Please select a saved workflow.');
      setMessageType('error');
      return;
    }

    const workflow = savedWorkflows.find(
      (item) =>
        String(item._id || item.id) === selectedWorkflow
    );

    if (!workflow) {
      setMessage('Selected workflow could not be found.');
      setMessageType('error');
      return;
    }

    setNodes(workflow.nodes || []);
    setEdges(workflow.edges || []);
    setWorkflowName(workflow.name || '');

    setMessage(`Workflow "${workflow.name}" loaded successfully!`);
    setMessageType('success');
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

      {/* ADD NODES */}

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

      {/* SAVE WORKFLOW */}

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '14px',
          marginBottom: '14px',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Save Your Workflow</h3>

        <input
          type="text"
          value={workflowName}
          onChange={(event) => setWorkflowName(event.target.value)}
          placeholder="Enter workflow name"
          maxLength={100}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            marginBottom: '10px',
            boxSizing: 'border-box',
          }}
        />

        <button
          className="add-rule-node-btn"
          onClick={saveWorkflow}
          disabled={savingWorkflow}
          style={{
            width: '100%',
            opacity: savingWorkflow ? 0.6 : 1,
          }}
        >
          {savingWorkflow ? 'Saving...' : 'Save Workflow'}
        </button>

        {message && (
          <p
            role="status"
            style={{
              marginBottom: 0,
              fontSize: '13px',
              color:
                messageType === 'success' ? '#15803d' : '#dc2626',
            }}
          >
            {message}
          </p>
        )}
      </div>

      {/* LOAD WORKFLOW */}

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '14px',
          marginBottom: '14px',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Saved Workflows</h3>

        <select
          value={selectedWorkflow}
          onChange={(event) => setSelectedWorkflow(event.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            marginBottom: '10px',
          }}
        >
          <option value="">Select a saved workflow</option>

          {savedWorkflows.map((workflow) => {
            const id = String(workflow._id || workflow.id);

            return (
              <option key={id} value={id}>
                {workflow.name}
              </option>
            );
          })}
        </select>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="add-rule-node-btn"
            onClick={loadWorkflow}
            disabled={!selectedWorkflow}
          >
            Load Workflow
          </button>

          <button
            className="add-rule-node-btn"
            onClick={fetchWorkflows}
            disabled={loadingWorkflows}
          >
            {loadingWorkflows ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>

        {savedWorkflows.length === 0 && !loadingWorkflows && (
          <p style={{ fontSize: '12px', color: '#64748b' }}>
            No saved workflows yet. Create and save your first workflow.
          </p>
        )}
      </div>

      {/* VISUAL CANVAS */}

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
