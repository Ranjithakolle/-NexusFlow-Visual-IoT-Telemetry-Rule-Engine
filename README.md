# \# NexusFlow – Visual IoT Telemetry \& Rule Engine

# 

# \*\*Individual Infotact Project\*\*

# 

# NexusFlow is a visual IoT telemetry and rule automation platform that allows users to create, manage, and execute workflows through a visual node-based interface.

# 

# The project aims to simplify IoT automation by allowing users to connect sensor inputs, mathematical operations, conditions, and action triggers without hardcoding every rule.

# 

# \## 🚀 Key Features

# 

# \- \*\*Visual Workflow Builder:\*\* Create workflows using a drag-and-drop node interface powered by React Flow.

# \- \*\*IoT Telemetry Ingestion:\*\* Receive temperature and pressure readings through REST APIs.

# \- \*\*MongoDB Time-Series Storage:\*\* Store and retrieve IoT telemetry data efficiently.

# \- \*\*Workflow Compiler:\*\* Compile saved workflow graphs into executable RxJS pipelines.

# \- \*\*Math Operations:\*\* Support Moving Average, Scale, and Add operations in workflow nodes.

# \- \*\*Condition Evaluation:\*\* Evaluate sensor values using comparison operators.

# \- \*\*Action Triggers:\*\* Support actions such as Generate Alert, Monitor Machine, and Send Notification.

# \- \*\*Real-Time Communication:\*\* Use Socket.IO for live telemetry and alert updates.

# \- \*\*Workflow Management:\*\* Save, load, and delete workflows.

# 

# \## 🛠️ Technology Stack

# 

# | Layer | Technologies |

# |---|---|

# | Frontend | React, Vite, React Flow |

# | Backend | Node.js, Express.js |

# | Database | MongoDB Atlas, Mongoose |

# | Stream Processing | RxJS |

# | Real-Time Communication | Socket.IO |

# | Version Control | Git, GitHub |

# 

# \## ⚙️ Workflow Architecture

# 

# ```text

# IoT Sensor

# &#x20;   ↓

# Math Operation

# &#x20;   ↓

# Condition Evaluation

# &#x20;   ↓

# Action Trigger

# ```

# 

# Example: A temperature sensor sends readings to a Moving Average node. The calculated average is checked against a threshold. If the condition is satisfied, the configured action is triggered.

# 

# \## 📁 Project Structure

# 

# ```text

# NexusFlow/

# ├── client/

# │   └── src/

# │       ├── App.jsx

# │       └── RuleBuilder.jsx

# │

# ├── server/

# │   └── src/

# │       ├── server.js

# │       └── services/

# │           └── workflowCompiler.js

# │

# └── README.md

# ```

# 

# \## ▶️ Getting Started

# 

# \### 1. Clone the repository

# 

# ```bash

# git clone https://github.com/Ranjithakolle/-NexusFlow-Visual-IoT-Telemetry-Rule-Engine.git

# ```

# 

# \### 2. Start the backend

# 

# ```bash

# cd server

# npm install

# npm run dev

# ```

# 

# Configure the MongoDB connection string in the server `.env` file.

# 

# \### 3. Start the frontend

# 

# Open a second terminal:

# 

# ```bash

# cd client

# npm install

# npm run dev

# ```

# 

# Open the local URL displayed by Vite in your browser.

# 

# \## 📡 Backend API

# 

# | Method | Endpoint | Purpose |

# |---|---|---|

# | GET | `/api/health` | Check backend and database status |

# | GET | `/api/telemetry` | Retrieve telemetry data |

# | POST | `/api/telemetry` | Ingest telemetry readings |

# | GET | `/api/rules` | Retrieve automation rules |

# | POST | `/api/rules` | Create an automation rule |

# | GET | `/api/workflows` | Retrieve saved workflows |

# | POST | `/api/workflows` | Save and activate a workflow |

# | DELETE | `/api/workflows/:id` | Delete a workflow |

# 

# \## 🎯 Project Objective

# 

# To build a scalable and flexible IoT automation platform where users can visually design workflows and execute real-time telemetry processing without manually coding every automation rule.

# 

# \## 👩‍💻 Project Information

# 

# \*\*Project:\*\* NexusFlow – Visual IoT Telemetry \& Rule Engine  

# \*\*Category:\*\* Individual Project  

# \*\*Organization:\*\* Infotact

