
import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [activePage, setActivePage] = useState('overview')

  const [temperature, setTemperature] = useState(72.5)
  const [pressure, setPressure] = useState(34.8)
  const [machineStatus, setMachineStatus] = useState('Normal')

  const [history, setHistory] = useState([])
  const [alerts, setAlerts] = useState([
    { id: 1, message: 'Temperature monitoring active', type: 'success', time: 'System startup' },
    { id: 2, message: 'Telemetry stream initialized', type: 'info', time: 'System startup' },
    { id: 3, message: 'Rule engine ready', type: 'success', time: 'System startup' },
  ])

  const [rules, setRules] = useState([
    { id: 1, name: 'High Temperature Alert', sensor: 'Temperature', operator: '>', threshold: 77, action: 'Generate Alert', enabled: true },
    { id: 2, name: 'High Pressure Alert', sensor: 'Pressure', operator: '>', threshold: 38, action: 'Generate Alert', enabled: true },
    { id: 3, name: 'Machine Monitoring', sensor: 'Temperature', operator: '<', threshold: 80, action: 'Monitor Machine', enabled: true },
  ])

  const [ruleName, setRuleName] = useState('')
  const [ruleSensor, setRuleSensor] = useState('Temperature')
  const [ruleOperator, setRuleOperator] = useState('>')
  const [ruleThreshold, setRuleThreshold] = useState('75')
  const [ruleAction, setRuleAction] = useState('Generate Alert')

  useEffect(() => {
    const interval = setInterval(() => {
      setTemperature(value => {
        const next = Number((value + (Math.random() - 0.5) * 1.5).toFixed(1))
        return Math.max(68, Math.min(80, next))
      })

      setPressure(value => {
        const next = Number((value + (Math.random() - 0.5) * 0.8).toFixed(1))
        return Math.max(30, Math.min(40, next))
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setHistory(previous => [
      ...previous.slice(-9),
      {
        time: new Date().toLocaleTimeString(),
        temperature,
        pressure,
      },
    ])
  }, [temperature, pressure])

  useEffect(() => {
    if (temperature > 77 && machineStatus !== 'Warning') {
      setMachineStatus('Warning')
      setAlerts(previous => [
        {
          id: Date.now(),
          message: `High temperature detected: ${temperature}°C`,
          type: 'warning',
          time: new Date().toLocaleTimeString(),
        },
        ...previous,
      ])
    } else if (temperature <= 77 && machineStatus !== 'Normal') {
      setMachineStatus('Normal')
    }
  }, [temperature, machineStatus])

  const addRule = (event) => {
    event.preventDefault()

    if (!ruleName.trim() || ruleThreshold === '') return

    const newRule = {
      id: Date.now(),
      name: ruleName,
      sensor: ruleSensor,
      operator: ruleOperator,
      threshold: Number(ruleThreshold),
      action: ruleAction,
      enabled: true,
    }

    setRules(previous => [...previous, newRule])
    setRuleName('')
    setRuleThreshold('75')

    setAlerts(previous => [
      {
        id: Date.now() + 1,
        message: `New rule created: ${newRule.name}`,
        type: 'success',
        time: new Date().toLocaleTimeString(),
      },
      ...previous,
    ])
  }

  const toggleRule = (id) => {
    setRules(previous =>
      previous.map(rule =>
        rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
      )
    )
  }

  const deleteRule = (id) => {
    setRules(previous => previous.filter(rule => rule.id !== id))
  }

  const clearAlerts = () => setAlerts([])

  const navigation = [
    { id: 'overview', icon: '▦', label: 'Overview' },
    { id: 'telemetry', icon: '◉', label: 'Telemetry' },
    { id: 'rules', icon: '◇', label: 'Rule Builder' },
    { id: 'alerts', icon: '♧', label: 'Alerts' },
  ]

  const pageTitles = {
    overview: 'Dashboard Overview',
    telemetry: 'Telemetry Monitoring',
    rules: 'Automation Rule Builder',
    alerts: 'System Alerts',
  }

  const MetricCard = ({ title, value, note }) => (
    <article className="metric-card">
      <p>{title}</p>
      <h2>{value}</h2>
      <span className="metric-note">{note}</span>
    </article>
  )

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="brand">Nexus<span>Flow</span></h2>
        <p className="sidebar-label">WORKSPACE</p>

        <nav>
          {navigation.map(item => (
            <button
              key={item.id}
              className={activePage === item.id ? 'active nav-button' : 'nav-button'}
              onClick={() => setActivePage(item.id)}
            >
              {item.icon} {item.label}
              {item.id === 'alerts' && alerts.length > 0 && (
                <span className="nav-count">{alerts.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          IoT Monitoring Platform<br />
          Version 1.0.0
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">INDUSTRIAL MONITORING</p>
            <h1>{pageTitles[activePage]}</h1>
          </div>
          <div className="connection">
            <span></span> System Online
          </div>
        </header>

        {/* OVERVIEW PAGE */}
        {activePage === 'overview' && (
          <>
            <section className="welcome">
              <div>
                <p className="eyebrow">WELCOME TO NEXUSFLOW</p>
                <h2>Visual IoT Telemetry &amp; Rule Engine</h2>
                <p>Monitor machines, visualize sensor data and automate intelligent rules.</p>
              </div>
              <div className="welcome-icon">⌁</div>
            </section>

            <section className="metrics">
              <MetricCard title="Temperature" value={`${temperature}°C`} note="Live simulated reading" />
              <MetricCard title="Machine Pressure" value={`${pressure} bar`} note="Live simulated reading" />
              <MetricCard title="Machine Status" value={machineStatus} note="Based on temperature" />
              <MetricCard title="Active Rules" value={String(rules.filter(r => r.enabled).length).padStart(2, '0')} note="Configured rules" />
            </section>

            <section className="content-grid">
              <article className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">AUTOMATION</p>
                    <h3>Visual Rule Builder</h3>
                  </div>
                  <button className="tag" onClick={() => setActivePage('rules')}>Manage Rules</button>
                </div>
                <p className="panel-description">Your IoT processing pipeline</p>
                <div className="workflow">
                  <div className="node source">
                    <span>01 · SOURCE</span>
                    <strong>🌡 Turbine Sensor</strong>
                    <small>Temperature input</small>
                  </div>
                  <div className="connector">↓</div>
                  <div className="node filter">
                    <span>02 · PROCESS</span>
                    <strong>∿ Moving Average</strong>
                    <small>Noise reduction</small>
                  </div>
                  <div className="connector">↓</div>
                  <div className="node alert">
                    <span>03 · ACTION</span>
                    <strong>♧ Alert Trigger</strong>
                    <small>Notify when threshold is exceeded</small>
                  </div>
                </div>
              </article>

              <article className="panel">
                <p className="eyebrow">SYSTEM ACTIVITY</p>
                <h3>Recent Alerts</h3>
                {alerts.slice(0, 4).map(alert => (
                  <div className="activity" key={alert.id}>
                    <span className={`activity-dot ${alert.type === 'warning' ? 'warning-dot' : alert.type === 'info' ? 'blue' : ''}`}></span>
                    <div>
                      <strong>{alert.message}</strong>
                      <small>{alert.time}</small>
                    </div>
                  </div>
                ))}
                <button className="secondary-btn" onClick={() => setActivePage('alerts')}>
                  View All Alerts
                </button>
              </article>
            </section>
          </>
        )}

        {/* TELEMETRY PAGE */}
        {activePage === 'telemetry' && (
          <section className="page-section">
            <div className="page-heading">
              <div>
                <p className="eyebrow">SENSOR DATA</p>
                <h2>Live Telemetry Monitoring</h2>
                <p>Monitor real-time machine sensor readings.</p>
              </div>
              <span className="live-tag">● LIVE SIMULATION</span>
            </div>

            <section className="metrics">
              <MetricCard title="Temperature" value={`${temperature}°C`} note="Turbine Sensor T-001" />
              <MetricCard title="Pressure" value={`${pressure} bar`} note="Pressure Sensor P-001" />
              <MetricCard title="Machine Status" value={machineStatus} note="Current operating condition" />
            </section>

            <article className="panel full-panel">
              <p className="eyebrow">SENSOR HISTORY</p>
              <h3>Temperature Readings</h3>
              <div className="telemetry-chart">
                {history.map((item, index) => (
                  <div className="chart-column" key={index}>
                    <span>{item.temperature}°</span>
                    <div className="chart-track">
                      <div
                        className="chart-bar"
                        style={{ height: `${Math.max(5, ((item.temperature - 65) / 20) * 100)}%` }}
                      />
                    </div>
                    <small>{item.time}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel full-panel">
              <p className="eyebrow">LATEST READINGS</p>
              <h3>Telemetry Data Table</h3>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Temperature</th>
                      <th>Pressure</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map((item, index) => (
                      <tr key={index}>
                        <td>{item.time}</td>
                        <td>{item.temperature}°C</td>
                        <td>{item.pressure} bar</td>
                        <td>{item.temperature > 77 ? 'Warning' : 'Normal'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {/* RULE BUILDER PAGE */}
        {activePage === 'rules' && (
          <section className="page-section">
            <div className="page-heading">
              <div>
                <p className="eyebrow">AUTOMATION</p>
                <h2>Visual Rule Builder</h2>
                <p>Create and manage your machine automation rules.</p>
              </div>
              <span className="live-tag">{rules.filter(r => r.enabled).length} ACTIVE RULES</span>
            </div>

            <article className="panel full-panel">
              <p className="eyebrow">CREATE AUTOMATION</p>
              <h3>Create New Rule</h3>

              <form className="rule-form" onSubmit={addRule}>
                <label>
                  Rule Name
                  <input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="Enter rule name" required />
                </label>

                <label>
                  Sensor
                  <select value={ruleSensor} onChange={e => setRuleSensor(e.target.value)}>
                    <option>Temperature</option>
                    <option>Pressure</option>
                  </select>
                </label>

                <label>
                  Condition
                  <select value={ruleOperator} onChange={e => setRuleOperator(e.target.value)}>
                    <option value=">">Greater than (&gt;)</option>
                    <option value="<">Less than (&lt;)</option>
                    <option value=">=">Greater than or equal (≥)</option>
                    <option value="<=">Less than or equal (≤)</option>
                  </select>
                </label>

                <label>
                  Threshold
                  <input type="number" value={ruleThreshold} onChange={e => setRuleThreshold(e.target.value)} required />
                </label>

                <label>
                  Action
                  <select value={ruleAction} onChange={e => setRuleAction(e.target.value)}>
                    <option>Generate Alert</option>
                    <option>Monitor Machine</option>
                    <option>Send Notification</option>
                  </select>
                </label>

                <button type="submit" className="primary-btn">+ Create Rule</button>
              </form>
            </article>

            <article className="panel full-panel">
              <p className="eyebrow">CONFIGURATION</p>
              <h3>Configured Rules</h3>

              {rules.map(rule => (
                <div className="rule-row" key={rule.id}>
                  <div>
                    <strong>{rule.name}</strong>
                    <small>{rule.sensor} {rule.operator} {rule.threshold} → {rule.action}</small>
                  </div>
                  <div className="rule-actions">
                    <button className={rule.enabled ? 'toggle enabled' : 'toggle'} onClick={() => toggleRule(rule.id)}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button className="delete-btn" onClick={() => deleteRule(rule.id)}>Delete</button>
                  </div>
                </div>
              ))}
              {rules.length === 0 && <p>No rules configured. Create your first rule above.</p>}
            </article>
          </section>
        )}

        {/* ALERTS PAGE */}
        {activePage === 'alerts' && (
          <section className="page-section">
            <div className="page-heading">
              <div>
                <p className="eyebrow">SYSTEM NOTIFICATIONS</p>
                <h2>Alert Management</h2>
                <p>Monitor machine warnings and system activities.</p>
              </div>
              <button className="secondary-btn" onClick={clearAlerts}>Clear All Alerts</button>
            </div>

            <section className="metrics">
              <MetricCard title="Total Alerts" value={alerts.length} note="Recorded notifications" />
              <MetricCard title="Warnings" value={alerts.filter(a => a.type === 'warning').length} note="Temperature warnings" />
              <MetricCard title="System Events" value={alerts.filter(a => a.type !== 'warning').length} note="Information and activity" />
            </section>

            <article className="panel full-panel">
              <p className="eyebrow">NOTIFICATION HISTORY</p>
              <h3>All Alerts</h3>

              {alerts.map(alert => (
                <div className="alert-row" key={alert.id}>
                  <span className={`alert-indicator ${alert.type}`}></span>
                  <div>
                    <strong>{alert.message}</strong>
                    <small>{alert.time}</small>
                  </div>
                  <span className={`alert-label ${alert.type}`}>{alert.type}</span>
                </div>
              ))}

              {alerts.length === 0 && (
                <p className="empty-state">No alerts available. Your system is clear!</p>
              )}
            </article>
          </section>
        )}

        <footer>© 2026 NexusFlow · Visual IoT Telemetry &amp; Rule Engine</footer>
      </main>
    </div>
  )
}

export default App
