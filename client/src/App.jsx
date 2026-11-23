
import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import './App.css'
import RuleBuilder from './RuleBuilder'

const API_URL = 'http://localhost:4000'

function formatReading(reading) {
  const timestamp =
    reading.timestamp || reading.createdAt || new Date().toISOString()

  return {
    id: reading._id || `${timestamp}-${reading.temperature}-${reading.pressure}`,
    timestamp,
    time: new Date(timestamp).toLocaleTimeString(),
    temperature: Number(reading.temperature),
    pressure: Number(reading.pressure),
    status:
      reading.status ||
      (Number(reading.temperature) > 77 ? 'Warning' : 'Normal'),
  }
}

function App() {
  const [activePage, setActivePage] = useState('overview')

  // =====================================================
  // TELEMETRY STATE
  // =====================================================

  const [temperature, setTemperature] = useState(null)
  const [pressure, setPressure] = useState(null)
  const [machineStatus, setMachineStatus] = useState('Waiting')
  const [connectionStatus, setConnectionStatus] = useState('Connecting...')
  const [history, setHistory] = useState([])

  const newestTimestamp = useRef(0)
  const previousMachineStatus = useRef('Waiting')

  // =====================================================
  // ALERT STATE
  // =====================================================

  const [alerts, setAlerts] = useState([
    {
      id: 1,
      message: 'Temperature monitoring active',
      type: 'success',
      time: 'System startup',
    },
    {
      id: 2,
      message: 'Telemetry stream initialized',
      type: 'info',
      time: 'System startup',
    },
    {
      id: 3,
      message: 'Rule engine ready',
      type: 'success',
      time: 'System startup',
    },
  ])

  // =====================================================
  // MONGODB RULE STATE
  // =====================================================

  const [rules, setRules] = useState([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [ruleError, setRuleError] = useState('')

  // =====================================================
  // CREATE RULE FORM STATE
  // =====================================================

  const [ruleName, setRuleName] = useState('')
  const [ruleSensor, setRuleSensor] = useState('Temperature')
  const [ruleOperator, setRuleOperator] = useState('>')
  const [ruleThreshold, setRuleThreshold] = useState('75')
  const [ruleAction, setRuleAction] = useState('Generate Alert')
  const [savingRule, setSavingRule] = useState(false)

  // =====================================================
  // LOAD TELEMETRY AND SOCKET.IO
  // =====================================================

  useEffect(() => {
    const socket = io(API_URL, {
      transports: ['websocket'],
    })

    const applyReading = (rawReading) => {
      const reading = formatReading(rawReading)
      const readingTime = new Date(reading.timestamp).getTime()

      setHistory(previous => {
        const withoutDuplicate = previous.filter(
          item => item.id !== reading.id
        )

        return [...withoutDuplicate, reading]
          .sort(
            (a, b) =>
              new Date(a.timestamp).getTime() -
              new Date(b.timestamp).getTime()
          )
          .slice(-20)
      })

      if (readingTime >= newestTimestamp.current) {
        newestTimestamp.current = readingTime

        setTemperature(reading.temperature)
        setPressure(reading.pressure)
        setMachineStatus(reading.status)
      }
    }

    // Socket connection events
    socket.on('connect', () => {
      setConnectionStatus('System Online')
    })

    socket.on('disconnect', () => {
      setConnectionStatus('Reconnecting...')
    })

    socket.on('connect_error', () => {
      setConnectionStatus('Backend Offline')
    })

    // New telemetry readings
    socket.on('telemetry:new', applyReading)

    // Automation rule alerts from backend
    const handleNewAlert = (data) => {
      setAlerts(previous => [
        {
          id: data.id || Date.now(),
          message: data.message || data.title || 'Automation alert triggered',
          type: 'warning',
          time: new Date(data.timestamp || Date.now()).toLocaleTimeString(),
        },
        ...previous,
      ])
    }

    socket.on('alert:new', handleNewAlert)

    // Load saved telemetry from MongoDB
    const loadSavedReadings = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/telemetry?limit=20`
        )

        if (!response.ok) {
          throw new Error('Could not load telemetry data')
        }

        const result = await response.json()

        if (!result.success || !Array.isArray(result.data)) {
          throw new Error(
            result.message || 'Unexpected telemetry response'
          )
        }

        const savedReadings = result.data
          .map(formatReading)
          .reverse()

        setHistory(previous => {
          const combined = [...savedReadings, ...previous]

          const unique = Array.from(
            new Map(
              combined.map(item => [item.id, item])
            ).values()
          )

          return unique
            .sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            )
            .slice(-20)
        })

        const latest = result.data[0]

        if (latest) {
          const latestReading = formatReading(latest)
          const latestTime = new Date(
            latestReading.timestamp
          ).getTime()

          if (latestTime >= newestTimestamp.current) {
            newestTimestamp.current = latestTime

            setTemperature(latestReading.temperature)
            setPressure(latestReading.pressure)
            setMachineStatus(latestReading.status)
          }
        }
      } catch (error) {
        console.error('Telemetry fetch failed:', error)
        setConnectionStatus('Backend Offline')
      }
    }

    loadSavedReadings()

    return () => {
      socket.off('telemetry:new', applyReading)
      socket.off('alert:new', handleNewAlert)
      socket.disconnect()
    }
  }, [])

  // =====================================================
  // LOAD AUTOMATION RULES FROM MONGODB
  // =====================================================

  useEffect(() => {
    const loadRules = async () => {
      try {
        setRulesLoading(true)
        setRuleError('')

        const response = await fetch(`${API_URL}/api/rules`)

        if (!response.ok) {
          throw new Error('Failed to load automation rules')
        }

        const result = await response.json()

        if (!result.success || !Array.isArray(result.rules)) {
          throw new Error(
            result.message || 'Invalid rules response'
          )
        }

        setRules(result.rules)
      } catch (error) {
        console.error('Rules loading failed:', error)
        setRuleError(error.message)

        setAlerts(previous => [
          {
            id: Date.now(),
            message: 'Could not load automation rules',
            type: 'warning',
            time: new Date().toLocaleTimeString(),
          },
          ...previous,
        ])
      } finally {
        setRulesLoading(false)
      }
    }

    loadRules()
  }, [])

  // =====================================================
  // MACHINE STATUS ALERT
  // =====================================================

  useEffect(() => {
    if (
      machineStatus === 'Warning' &&
      previousMachineStatus.current !== 'Warning'
    ) {
      setAlerts(previous => [
        {
          id: Date.now(),
          message: `Machine entered Warning status. Temperature: ${temperature}°C`,
          type: 'warning',
          time: new Date().toLocaleTimeString(),
        },
        ...previous,
      ])
    }

    previousMachineStatus.current = machineStatus
  }, [machineStatus, temperature])

  // =====================================================
  // CREATE RULE - SAVE TO MONGODB
  // =====================================================

  const addRule = async (event) => {
    event.preventDefault()

    if (!ruleName.trim() || ruleThreshold === '') {
      return
    }

    if (!Number.isFinite(Number(ruleThreshold))) {
      alert('Please enter a valid threshold value.')
      return
    }

    try {
      setSavingRule(true)

      const response = await fetch(`${API_URL}/api/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: ruleName.trim(),
          sensor: ruleSensor,
          operator: ruleOperator,
          threshold: Number(ruleThreshold),
          action: ruleAction,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Failed to create rule'
        )
      }

      // Add the MongoDB-created rule to the frontend.
      setRules(previous => [
        ...previous,
        result.rule,
      ])

      setRuleName('')
      setRuleThreshold('75')

      setAlerts(previous => [
        {
          id: Date.now(),
          message: `New rule saved: ${result.rule.name}`,
          type: 'success',
          time: new Date().toLocaleTimeString(),
        },
        ...previous,
      ])
    } catch (error) {
      console.error('Create rule error:', error)
      alert(error.message)
    } finally {
      setSavingRule(false)
    }
  }

  // =====================================================
  // ENABLE / DISABLE RULE - UPDATE MONGODB
  // =====================================================

  const toggleRule = async (id) => {
    const rule = rules.find(item => item.id === id)

    if (!rule) return

    try {
      const response = await fetch(
        `${API_URL}/api/rules/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            enabled: !rule.enabled,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Failed to update rule'
        )
      }

      setRules(previous =>
        previous.map(item =>
          item.id === id ? result.rule : item
        )
      )
    } catch (error) {
      console.error('Toggle rule error:', error)
      alert(error.message)
    }
  }

  // =====================================================
  // DELETE RULE - DELETE FROM MONGODB
  // =====================================================

  const deleteRule = async (id) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this rule?'
    )

    if (!confirmed) return

    try {
      const response = await fetch(
        `${API_URL}/api/rules/${id}`,
        {
          method: 'DELETE',
        }
      )

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Failed to delete rule'
        )
      }

      setRules(previous =>
        previous.filter(rule => rule.id !== id)
      )

      setAlerts(previous => [
        {
          id: Date.now(),
          message: `Rule deleted: ${ruleName || 'Automation rule'}`,
          type: 'info',
          time: new Date().toLocaleTimeString(),
        },
        ...previous,
      ])
    } catch (error) {
      console.error('Delete rule error:', error)
      alert(error.message)
    }
  }

  // =====================================================
  // CLEAR ALERTS
  // =====================================================

  const clearAlerts = () => setAlerts([])

  // =====================================================
  // NAVIGATION
  // =====================================================

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

  // =====================================================
  // METRIC CARD
  // =====================================================

  const MetricCard = ({ title, value, note }) => (
    <article className="metric-card">
      <p>{title}</p>
      <h2>{value}</h2>
      <span className="metric-note">{note}</span>
    </article>
  )

  const temperatureDisplay =
    temperature === null ? '--' : `${temperature}°C`

  const pressureDisplay =
    pressure === null ? '--' : `${pressure} bar`

  // =====================================================
  // MAIN UI
  // =====================================================

  return (
    <div className="app">

      {/* SIDEBAR */}

      <aside className="sidebar">
        <h2 className="brand">
          Nexus<span>Flow</span>
        </h2>

        <p className="sidebar-label">WORKSPACE</p>

        <nav>
          {navigation.map(item => (
            <button
              key={item.id}
              className={
                activePage === item.id
                  ? 'active nav-button'
                  : 'nav-button'
              }
              onClick={() => setActivePage(item.id)}
            >
              {item.icon} {item.label}

              {item.id === 'alerts' && alerts.length > 0 && (
                <span className="nav-count">
                  {alerts.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          IoT Monitoring Platform<br />
          Version 1.0.0
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="main-content">

        {/* TOPBAR */}

        <header className="topbar">
          <div>
            <p className="eyebrow">
              INDUSTRIAL MONITORING
            </p>

            <h1>{pageTitles[activePage]}</h1>
          </div>

          <div className="connection">
            <span></span> {connectionStatus}
          </div>
        </header>

        {/* =========================================
            OVERVIEW PAGE
        ========================================= */}

        {activePage === 'overview' && (
          <>
            <section className="welcome">
              <div>
                <p className="eyebrow">
                  WELCOME TO NEXUSFLOW
                </p>

                <h2>
                  Visual IoT Telemetry &amp; Rule Engine
                </h2>

                <p>
                  Monitor machines, visualize sensor data
                  and automate intelligent rules.
                </p>
              </div>

              <div className="welcome-icon">⌁</div>
            </section>

            <section className="metrics">
              <MetricCard
                title="Temperature"
                value={temperatureDisplay}
                note="Latest MongoDB reading"
              />

              <MetricCard
                title="Machine Pressure"
                value={pressureDisplay}
                note="Latest MongoDB reading"
              />

              <MetricCard
                title="Machine Status"
                value={machineStatus}
                note="Latest sensor status"
              />

              <MetricCard
                title="Active Rules"
                value={String(
                  rules.filter(rule => rule.enabled).length
                ).padStart(2, '0')}
                note="Configured rules"
              />
            </section>

            <section className="content-grid">

              <article className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">AUTOMATION</p>
                    <h3>Visual Rule Builder</h3>
                  </div>

                  <button
                    className="tag"
                    onClick={() => setActivePage('rules')}
                  >
                    Manage Rules
                  </button>
                </div>

                <p className="panel-description">
                  Your IoT processing pipeline
                </p>

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
                    <small>
                      Notify when threshold is exceeded
                    </small>
                  </div>
                </div>
              </article>

              <article className="panel">
                <p className="eyebrow">SYSTEM ACTIVITY</p>
                <h3>Recent Alerts</h3>

                {alerts.slice(0, 4).map(alert => (
                  <div className="activity" key={alert.id}>
                    <span
                      className={`activity-dot ${
                        alert.type === 'warning'
                          ? 'warning-dot'
                          : alert.type === 'info'
                            ? 'blue'
                            : ''
                      }`}
                    ></span>

                    <div>
                      <strong>{alert.message}</strong>
                      <small>{alert.time}</small>
                    </div>
                  </div>
                ))}

                <button
                  className="secondary-btn"
                  onClick={() => setActivePage('alerts')}
                >
                  View All Alerts
                </button>
              </article>

            </section>
          </>
        )}

        {/* =========================================
            TELEMETRY PAGE
        ========================================= */}

        {activePage === 'telemetry' && (
          <section className="page-section">

            <div className="page-heading">
              <div>
                <p className="eyebrow">SENSOR DATA</p>
                <h2>Live Telemetry Monitoring</h2>
                <p>
                  Monitor real-time machine sensor readings.
                </p>
              </div>

              <span className="live-tag">
                ● LIVE MONGODB DATA
              </span>
            </div>

            <section className="metrics">
              <MetricCard
                title="Temperature"
                value={temperatureDisplay}
                note="Turbine Sensor T-001"
              />

              <MetricCard
                title="Pressure"
                value={pressureDisplay}
                note="Pressure Sensor P-001"
              />

              <MetricCard
                title="Machine Status"
                value={machineStatus}
                note="Current operating condition"
              />
            </section>

            <article className="panel full-panel">
              <p className="eyebrow">SENSOR HISTORY</p>
              <h3>Temperature Readings</h3>

              {history.length === 0 ? (
                <p className="empty-state">
                  No telemetry readings found. Send a reading
                  to the backend to see it here.
                </p>
              ) : (
                <div className="telemetry-chart">
                  {history.map(item => (
                    <div className="chart-column" key={item.id}>
                      <span>{item.temperature}°</span>

                      <div className="chart-track">
                        <div
                          className="chart-bar"
                          style={{
                            height: `${
                              Math.max(
                                5,
                                ((item.temperature - 65) / 20) * 100
                              )
                            }%`,
                          }}
                        />
                      </div>

                      <small>{item.time}</small>
                    </div>
                  ))}
                </div>
              )}
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
                    {[...history].reverse().map(item => (
                      <tr key={item.id}>
                        <td>{item.time}</td>
                        <td>{item.temperature}°C</td>
                        <td>{item.pressure} bar</td>
                        <td>{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {history.length === 0 && (
                  <p className="empty-state">
                    No saved readings yet.
                  </p>
                )}
              </div>
            </article>

          </section>
        )}

        {/* =========================================
            RULE BUILDER PAGE
        ========================================= */}

        {activePage === 'rules' && (
          <section className="page-section">

            <div className="page-heading">
              <div>
                <p className="eyebrow">AUTOMATION</p>
                <h2>Visual Rule Builder</h2>
                <p>
                  Create and manage your machine automation rules.
                </p>
              </div>

              <span className="live-tag">
                {rules.filter(rule => rule.enabled).length} ACTIVE RULES
              </span>
            </div>

            {/* VISUAL REACT FLOW BUILDER */}

            <article className="panel full-panel visual-builder-panel">
              <p className="eyebrow">VISUAL WORKFLOW</p>
              <h3>Build Your Rule Workflow</h3>

              <p className="panel-description">
                Drag nodes onto the canvas and connect them
                to design your automation flow.
              </p>

              <RuleBuilder />
            </article>

            {/* CREATE NEW RULE */}

            <article className="panel full-panel">
              <p className="eyebrow">CREATE AUTOMATION</p>
              <h3>Create New Rule</h3>

              <form className="rule-form" onSubmit={addRule}>

                <label>
                  Rule Name

                  <input
                    value={ruleName}
                    onChange={event =>
                      setRuleName(event.target.value)
                    }
                    placeholder="Enter rule name"
                    required
                  />
                </label>

                <label>
                  Sensor

                  <select
                    value={ruleSensor}
                    onChange={event =>
                      setRuleSensor(event.target.value)
                    }
                  >
                    <option>Temperature</option>
                    <option>Pressure</option>
                  </select>
                </label>

                <label>
                  Condition

                  <select
                    value={ruleOperator}
                    onChange={event =>
                      setRuleOperator(event.target.value)
                    }
                  >
                    <option value=">">
                      Greater than (&gt;)
                    </option>

                    <option value="<">
                      Less than (&lt;)
                    </option>

                    <option value=">=">
                      Greater than or equal (≥)
                    </option>

                    <option value="<=">
                      Less than or equal (≤)
                    </option>
                  </select>
                </label>

                <label>
                  Threshold

                  <input
                    type="number"
                    value={ruleThreshold}
                    onChange={event =>
                      setRuleThreshold(event.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  Action

                  <select
                    value={ruleAction}
                    onChange={event =>
                      setRuleAction(event.target.value)
                    }
                  >
                    <option>Generate Alert</option>
                    <option>Monitor Machine</option>
                    <option>Send Notification</option>
                  </select>
                </label>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={savingRule}
                >
                  {savingRule ? 'Saving...' : '+ Create Rule'}
                </button>

              </form>
            </article>

            {/* CONFIGURED RULES */}

            <article className="panel full-panel">
              <p className="eyebrow">CONFIGURATION</p>
              <h3>Configured Rules</h3>

              {rulesLoading ? (
                <p className="empty-state">
                  Loading saved rules from MongoDB...
                </p>
              ) : ruleError ? (
                <div>
                  <p className="empty-state">
                    Could not load rules: {ruleError}
                  </p>

                  <button
                    className="secondary-btn"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </button>
                </div>
              ) : rules.length === 0 ? (
                <p className="empty-state">
                  No rules configured. Create your first rule above.
                </p>
              ) : (
                rules.map(rule => (
                  <div className="rule-row" key={rule.id}>
                    <div>
                      <strong>{rule.name}</strong>

                      <small>
                        {rule.sensor} {rule.operator} {rule.threshold}
                        {' → '}
                        {rule.action}
                      </small>
                    </div>

                    <div className="rule-actions">
                      <button
                        className={
                          rule.enabled
                            ? 'toggle enabled'
                            : 'toggle'
                        }
                        onClick={() => toggleRule(rule.id)}
                      >
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </button>

                      <button
                        className="delete-btn"
                        onClick={() => deleteRule(rule.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </article>

          </section>
        )}

        {/* =========================================
            ALERTS PAGE
        ========================================= */}

        {activePage === 'alerts' && (
          <section className="page-section">

            <div className="page-heading">
              <div>
                <p className="eyebrow">SYSTEM NOTIFICATIONS</p>
                <h2>Alert Management</h2>
                <p>
                  Monitor machine warnings and system activities.
                </p>
              </div>

              <button
                className="secondary-btn"
                onClick={clearAlerts}
              >
                Clear All Alerts
              </button>
            </div>

            <section className="metrics">
              <MetricCard
                title="Total Alerts"
                value={alerts.length}
                note="Recorded notifications"
              />

              <MetricCard
                title="Warnings"
                value={
                  alerts.filter(
                    alert => alert.type === 'warning'
                  ).length
                }
                note="Machine warnings"
              />

              <MetricCard
                title="System Events"
                value={
                  alerts.filter(
                    alert => alert.type !== 'warning'
                  ).length
                }
                note="Information and activity"
              />
            </section>

            <article className="panel full-panel">
              <p className="eyebrow">NOTIFICATION HISTORY</p>
              <h3>All Alerts</h3>

              {alerts.map(alert => (
                <div className="alert-row" key={alert.id}>
                  <span
                    className={`alert-indicator ${alert.type}`}
                  ></span>

                  <div>
                    <strong>{alert.message}</strong>
                    <small>{alert.time}</small>
                  </div>

                  <span
                    className={`alert-label ${alert.type}`}
                  >
                    {alert.type}
                  </span>
                </div>
              ))}

              {alerts.length === 0 && (
                <p className="empty-state">
                  No alerts available. Your system is clear!
                </p>
              )}
            </article>

          </section>
        )}

        {/* FOOTER */}

        <footer>
          © 2026 NexusFlow · Visual IoT Telemetry &amp; Rule Engine
        </footer>

      </main>
    </div>
  )
}

export default App
