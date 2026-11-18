
import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [temperature, setTemperature] = useState(72.5)
  const [pressure, setPressure] = useState(34.8)
  const [machineStatus, setMachineStatus] = useState('Normal')

  useEffect(() => {
    const interval = setInterval(() => {
      setTemperature((value) => {
        const next = Number((value + (Math.random() - 0.5) * 1.5).toFixed(1))
        return Math.max(68, Math.min(80, next))
      })

      setPressure((value) => {
        const next = Number((value + (Math.random() - 0.5) * 0.8).toFixed(1))
        return Math.max(30, Math.min(40, next))
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setMachineStatus(temperature > 77 ? 'Warning' : 'Normal')
  }, [temperature])

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="brand">Nexus<span>Flow</span></h2>
        <p className="sidebar-label">WORKSPACE</p>
        <nav>
          <a className="active" href="#overview">▦ Overview</a>
          <a href="#telemetry">◉ Telemetry</a>
          <a href="#workflows">◇ Rule Builder</a>
          <a href="#alerts">♧ Alerts</a>
        </nav>
        <div className="sidebar-bottom">IoT Monitoring Platform<br />Version 1.0.0</div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div>
            <p className="eyebrow">INDUSTRIAL MONITORING</p>
            <h1>Dashboard Overview</h1>
          </div>
          <div className="connection"><span></span> System Online</div>
        </header>

        <section className="welcome">
          <div>
            <p className="eyebrow">WELCOME TO NEXUSFLOW</p>
            <h2>Visual IoT Telemetry &amp; Rule Engine</h2>
            <p>Monitor machines, visualize sensor data and automate intelligent rules.</p>
          </div>
          <div className="welcome-icon">⌁</div>
        </section>

        <section className="metrics" id="telemetry">
          <article className="metric-card">
            <p>Temperature</p>
            <h2>{temperature}°C</h2>
            <span className="metric-note">Live simulated reading</span>
          </article>
          <article className="metric-card">
            <p>Machine Pressure</p>
            <h2>{pressure} <small>bar</small></h2>
            <span className="metric-note">Live simulated reading</span>
          </article>
          <article className="metric-card">
            <p>Machine Status</p>
            <h2 className={machineStatus === 'Normal' ? 'normal' : 'warning'}>
              {machineStatus}
            </h2>
            <span className="metric-note">Based on temperature</span>
          </article>
          <article className="metric-card">
            <p>Active Rules</p>
            <h2>03</h2>
            <span className="metric-note">Configured rules</span>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel" id="workflows">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">AUTOMATION</p>
                <h3>Visual Rule Builder</h3>
              </div>
              <span className="tag">Preview</span>
            </div>
            <p className="panel-description">A sample IoT processing pipeline</p>
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

          <article className="panel" id="alerts">
            <p className="eyebrow">SYSTEM ACTIVITY</p>
            <h3>Recent Alerts</h3>
            <div className="activity">
              <span className="activity-dot"></span>
              <div><strong>Temperature monitoring active</strong><small>Sensor T-001 · Monitoring</small></div>
            </div>
            <div className="activity">
              <span className="activity-dot blue"></span>
              <div><strong>Telemetry stream initialized</strong><small>Data source · Connected</small></div>
            </div>
            <div className="activity">
              <span className="activity-dot"></span>
              <div><strong>Rule engine ready</strong><small>Automation · Waiting for rules</small></div>
            </div>
          </article>
        </section>

        <footer>© 2026 NexusFlow · Visual IoT Telemetry &amp; Rule Engine</footer>
      </main>
    </div>
  )
}

export default App
