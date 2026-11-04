# OpenEyes 👁️

### A Voice-First AI Accessibility Assistant

OpenEyes is a voice-first accessibility application designed primarily for people who are blind or have low vision. It helps users find everyday objects and understand their surroundings through natural voice interaction and AI-powered visual understanding.

Instead of relying on visual navigation, users can simply speak to OpenEyes, ask what they are looking for, and receive spoken descriptions based on what the camera can see.

## 🎥 Demo

[Watch the OpenEyes Demo](https://youtube.com/shorts/AHopyU6knU8)

## ✨ Features

- **Voice Interaction:** Give instructions naturally using spoken commands.
- **Object Finding:** Ask OpenEyes to help locate everyday objects, such as phones and keys.
- **Visual Understanding:** Use the camera to analyse surroundings and identify visible objects.
- **Spoken Responses:** Receive natural-language descriptions through text-to-speech.
- **Accessibility-Focused Design:** Designed around voice-first interaction for people with visual impairments.

## 🛠️ Technology Stack

**Mobile Application**
- React Native
- Expo
- TypeScript
- Expo Router
- Expo Camera
- Expo Audio
- Expo Speech

**Backend**
- Node.js
- TypeScript
- WebSockets
- REST API

**AI**
- Meta Model API
- Meta real-time voice capabilities
- AI-powered image understanding

## 🧠 How It Works

1. The user opens OpenEyes and gives a spoken instruction.
2. The application receives the voice instruction through its real-time voice connection.
3. The user captures an image using the camera.
4. The backend sends the image for AI-powered analysis.
5. Meta's AI model interprets the scene and identifies the requested object when visible.
6. OpenEyes communicates the result through a spoken response.

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- Expo Go or a compatible Expo development environment
- A Meta Model API account with the required API access

### Installation

Clone the repository:

```bash
git clone https://github.com/deborahf2911/OpenEyes.git
cd OpenEyes
```

Install the mobile application dependencies:

```bash
npm install
```

Install the backend dependencies:

```bash
cd server
npm install
```

### Backend Configuration

Configure the required Meta API credentials in the backend environment file. Keep your credentials private and never commit your `.env` file.

Start the backend:

```bash
npm run dev
```

The backend runs on port 3000 by default.

### Mobile Application

In `src/app/camera.tsx`, configure the API and WebSocket URLs to use the network address of the computer running the backend.

Return to the project root and start Expo:

```bash
cd ..
npx expo start
```

Open the application using Expo Go on a compatible mobile device.

Make sure the mobile device and backend can communicate over the network.

## ♿ Accessibility and Safety

OpenEyes aims to make everyday interactions with the surrounding environment more accessible.

It is designed to avoid inventing visual details, communicate uncertainty when an object cannot be identified, and provide descriptions using relevant physical landmarks.

OpenEyes is an assistive tool and should not be treated as a replacement for a mobility aid, orientation and mobility training, or other established accessibility tools.

## 👩‍💻 Developer

**Deborah Fernando**

Built independently for the **Meta Global AI Developer Hackathon 2026**.