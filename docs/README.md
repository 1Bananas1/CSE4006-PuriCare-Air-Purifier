# PuriCare – AI-Driven Smart Air Purifier System

 

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black)](https://nextjs.org/)

[![Node.js](https://img.shields.io/badge/Node.js-Express-green)](https://expressjs.com/)

[![Python](https://img.shields.io/badge/Python-3.x-blue)](https://www.python.org/)

 

An intelligent IoT air purification system that leverages AI-powered cough detection and real-time air quality monitoring to create healthier indoor environments.

 

**Course Project:** CSE4006 – Software Engineering · Group 07

**Institution:** Hanyang University (Fall 2025)

 

## 📖 Documentation

 

Visit our [project documentation site](https://1bananas1.github.io/CSE4006-PuriCare-Air-Purifier/) for detailed information about the system architecture, features, and team.

 

## 🌟 Features

 

- **AI-Powered Cough Detection**: Real-time audio analysis to detect cough sounds and trigger purification

- **Smart Air Quality Monitoring**: Integration with external AQI APIs and sensor data

- **Real-Time Updates**: WebSocket-based live sensor data streaming

- **Interactive Dashboard**: Responsive web interface with real-time air quality visualization

- **Geolocation Support**: Map-based air quality monitoring with Leaflet integration

- **User Authentication**: Secure Google OAuth integration via Firebase

- **Hardware Simulation**: Development tools for testing without physical devices

- **Time-Zone Aware**: Automated routines based on geographic location

 

## 🏗️ Architecture

 

The system consists of three main components:

 

### Frontend (`/client`)

- **Framework**: Next.js 16 with React 19

- **Styling**: TailwindCSS 4

- **State Management**: SWR for data fetching

- **Maps**: React Leaflet for geolocation visualization

- **Authentication**: Firebase Authentication

- **Internationalization**: next-intl for multi-language support

 

### Backend (`/server`)

- **Runtime**: Node.js with Express 5

- **Database**: PostgreSQL with TimescaleDB for time-series data

- **Real-Time Communication**: Socket.IO for WebSocket connections

- **Authentication**: Firebase Admin SDK + Google OAuth

- **External APIs**: AQICN for air quality data

- **Security**: Helmet, CORS, rate limiting

- **Scheduling**: Node-cron for automated tasks

 

### Hardware (`/hardware`)

- **Language**: Python 3.x

- **AI/ML**: Custom cough detection model

- **Audio Processing**: Real-time audio analysis

- **Device Control**: CLI and WebSocket-based control interface

- **Simulation**: Virtual device simulator for development

 

## 🚀 Quick Start

 

### Prerequisites

 

- Docker & Docker Compose

- Node.js 20+

- Python 3.x (for hardware components)

- Firebase project (for authentication)

- AQICN API token (for air quality data)

 

### Installation

 

1. **Clone the repository**

   ```bash

   git clone https://github.com/1Bananas1/CSE4006-PuriCare-Air-Purifier.git

   cd CSE4006-PuriCare-Air-Purifier

   ```

 

2. **Set up environment variables**

   ```bash

   cp .env.example .env

   # Edit .env with your credentials

   ```

 

   Required environment variables:

   - `POSTGRES_PASSWORD`: Database password

   - `FIREBASE_PROJECT_ID`: Firebase project ID

   - `FIREBASE_CLIENT_EMAIL`: Firebase service account email

   - `FIREBASE_PRIVATE_KEY`: Firebase private key

   - `GOOGLE_CLIENT_ID`: Google OAuth client ID

   - `AQICN_TOKEN`: Air quality API token

 

3. **Start with Docker Compose**

   ```bash

   docker-compose up

   ```

 

   This will start:

   - PostgreSQL database (port 5432)

   - Backend API (port 3020)

   - Frontend app (port 3000)

 

4. **Access the application**

   - Frontend: http://localhost:3000

   - Backend API: http://localhost:3020

 

### Manual Setup (Development)

 

#### Frontend

```bash

cd client

npm install

npm run dev

```

 

#### Backend

```bash

cd server/src/api

npm install

npm run dev

```

 

#### Hardware Simulator

```bash

cd hardware

pip install -r requirements.txt

python run_simulator.py

```

 

## 📁 Project Structure

 

```

CSE4006-PuriCare-Air-Purifier/

├── client/                 # Next.js frontend application

│   ├── src/               # Source code

│   └── package.json       # Frontend dependencies

├── server/                # Node.js backend API

│   ├── src/api/          # API implementation

│   └── package.json      # Backend dependencies

├── hardware/             # Python-based hardware control

│   ├── AI/              # Machine learning models

│   ├── simulator/       # Device simulator

│   ├── audio_analyzer/  # Audio processing

│   └── requirements.txt # Python dependencies

├── docs/                # Project documentation & GitHub Pages

├── docker-compose.yml   # Docker orchestration

└── firestore.rules      # Firebase security rules

```

 

## 🔧 Available Scripts

 

### Frontend

- `npm run dev` - Start development server

- `npm run build` - Build for production

- `npm start` - Start production server

- `npm run lint` - Run ESLint

 

### Backend

- `npm run dev` - Start with nodemon (auto-reload)

- `npm start` - Start production server

- `npm run midnight` - Run midnight routine script

- `npm run test:setup` - Setup test data

 

### Hardware

- `python run_simulator.py` - Start device simulator

- `python cli_controller.py` - CLI device controller

- `python simulator_websocket.py` - WebSocket-enabled simulator

 

## 🧪 Testing

 

```bash

# Backend test setup

cd server/src/api

npm run test:setup

 

# Test device registration

npm run test:register

 

# Test timezone system

npm run test-timezones

```

 

## 🔒 Security

 

- Firebase Authentication for user management

- Google OAuth 2.0 integration

- Rate limiting on API endpoints

- Helmet.js for security headers

- CORS configuration

- Firestore security rules

- Environment-based credential management

 

## 🌍 Environment Variables

 

See `.env.example` for all required environment variables. Never commit sensitive credentials to the repository.

 

## 👥 Team

 

| Name                | Role                                  |

| ------------------- | ------------------------------------- |


| **Jimmy MacDonald** | ML Engineer / Backend / QA            |


| **Soobeen Yim**     | Frontend / UX Design / Documentation  |

 

## 📄 License

 

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

 

## 🙏 Acknowledgments

 

- Hanyang University Department of Computer Science

- Course: CSE4006 – Software Engineering (Fall 2025)

- AQICN for air quality data API

 

## 📮 Contact

 

For questions or feedback, please open an issue on GitHub.

 

---

 

**Last Updated:** 2025-12-10

© 2025 Hanyang University – Department of Computer Science
