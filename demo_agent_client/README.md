AI Sales Demo Agent
This project implements an innovative AI-powered sales demo agent designed to provide interactive, voice-guided demonstrations of SaaS websites directly within a web application. It combines real-time voice interaction, AI-driven conversational logic, and headless browser automation to simulate a live product walkthrough.

✨ Features
Voice-Activated Interaction: Users can speak naturally to the AI agent.

Real-time Transcription: Conversation (both user and AI) is transcribed and displayed in a chat view.

Live Web Demo: The agent navigates and interacts with a target SaaS website in real-time, displaying the live view to the user.

AI-Driven Automation: A Large Language Model (Gemini 1.5 Flash) interprets user requests and instructs a headless browser (Playwright) to perform actions (click, type, navigate, scroll, wait) on the demo website.

Minimalist UI: A clean, two-panel interface focusing on conversation and the live demo.

🏗️ Architecture
The application is split into two main parts:

Frontend (React.js):

Built with React and styled using Tailwind CSS.

Handles the user interface, voice input (SpeechRecognition), voice output (SpeechSynthesis), and displays the live demo screenshots streamed from the backend.

Communicates with the backend via REST API calls.

Backend (Python Flask):

Developed with Flask to serve API endpoints.

Integrates with the Gemini API for AI logic, processing user queries, generating responses, and determining web actions.

Uses Playwright for headless browser automation to interact with the target SaaS website and capture real-time screenshots.

Manages the Playwright browser session to maintain a continuous demo state.

🚀 Getting Started
Follow these steps to set up and run the AI Sales Demo Agent locally.

Prerequisites
Before you begin, ensure you have the following installed:

Node.js & npm: For the React frontend.

Download Node.js (includes npm).

Python 3.9+: For the Flask backend.

Download Python

Google AI Studio Account: To obtain your Gemini API Key.

Google AI Studio

1. Backend Setup (Python Flask)
Create Project Directory & Files:
Create a new directory for your backend, e.g., ai_sales_agent_backend.
Inside this directory, create two files: app.py and .env.

Copy Backend Code:
Copy the content of the ai-sales-demo-backend immersive artifact (the Python code) and paste it into your app.py file.

Configure .env file:
Open the .env file and add your Gemini API key. Replace "YOUR_GEMINI_API_KEY_HERE" with the actual key you obtained from Google AI Studio. The google-generativeai library expects the environment variable to be named GOOGLE_API_KEY.

# ai_sales_agent_backend/.env
GOOGLE_API_KEY="YOUR_GEMINI_API_KEY_HERE"

Create and Activate Virtual Environment:
Open your terminal or command prompt, navigate to the ai_sales_agent_backend directory, and run:

python -m venv venv
# On macOS/Linux:
source venv/bin/activate
# On Windows (Command Prompt):
.\venv\Scripts\activate
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1

Your terminal prompt should now show (venv) indicating the virtual environment is active.

Install Python Dependencies:
With the virtual environment active, install the required libraries:

pip install Flask Flask-CORS playwright google-generativeai python-dotenv

Install Playwright Browser Binaries:
This step downloads the actual browser engines (like Chromium) that Playwright uses.

playwright install

Run the Backend Server:
Finally, start the Flask application:

python app.py

You should see output indicating the Flask server is running, usually on http://127.0.0.1:5000 or http://localhost:5000.

2. Frontend Setup (React.js)
Create React App:
Open a new terminal window (keep the backend terminal running). Navigate to a directory where you want to create your frontend project and run:

npx create-react-app ai-sales-demo-agent --template typescript
cd ai-sales-demo-agent

Install Tailwind CSS:
Install Tailwind CSS and its peer dependencies:

npm install tailwindcss postcss autoprefixer
npx tailwindcss init -p

Configure tailwind.config.js:
Open tailwind.config.js in the root of your ai-sales-demo-agent project and ensure the content array includes paths to your React components:

// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Crucial for Tailwind to scan your components
    "./public/index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

Create index.css:
In your src/ directory, create a file named index.css and add the following Tailwind directives:

/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Optional: Custom font */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: 'Inter', sans-serif;
}

Import index.css in index.tsx (or index.js):
Ensure your main entry file (src/index.tsx or src/index.js) imports index.css:

// src/index.tsx (or src/index.js)
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Make sure this line exists
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

Copy Frontend Code:
Copy the content of the ai-sales-demo-frontend immersive artifact (the React code) and paste it into your src/App.tsx file, replacing its existing content.

Run the Frontend Development Server:
In your frontend terminal (where you cd'd into ai-sales-demo-agent), run:

npm start

This will open your React application in your default web browser, usually at http://localhost:3000.

💡 How to Use
Ensure both Backend and Frontend are Running:
Verify that both your Python Flask backend (python app.py) and React frontend (npm start) are running in separate terminal windows.

Open Frontend:
Access the frontend in your browser (e.g., http://localhost:3000).

Start Demo:
Click the "Start New Demo" button. The AI will greet you, and a live view of google.com (or your configured starting URL) will appear.

Interact with Voice/Text:

Voice: Click the microphone button to speak your requests. The AI will listen, respond verbally, and perform actions on the demo website.

Text: Type your commands into the input field and press Enter or click "Send."

Observe Demo:
Watch the right panel as the AI navigates and interacts with the website based on your instructions. The chat view on the left will show the transcription of the conversation.

End Demo:
Click the "Stop Demo" button when you are finished.

🔮 Future Enhancements
More Sophisticated Web Interaction:

Implement object detection (e.g., using a vision model or pre-trained models) to identify elements on the page more robustly, rather than relying solely on CSS selectors.

Handle more complex interactions like drag-and-drop, file uploads, or interacting with dynamic modals.

Allow the AI to "read" specific text content from the page to answer questions directly from the demo.

Improved LLM Prompting:

Dynamically generate a "tool schema" for the LLM based on the current webpage's interactive elements, giving it more precise control.

Implement a "thought process" for the LLM where it first analyzes the page, then decides on an action, and then executes.

Enhanced User Experience:

Add visual highlighting on the demo screen to show which element the AI is interacting with.

Implement a "loading" or "AI thinking" indicator.

Allow users to pause/resume the AI's actions.

Integrate a higher-quality Text-to-Speech (TTS) service (e.g., Google Cloud Text-to-Speech) for more natural-sounding AI voice.

Demo Customization:

Allow users to input a target SaaS website URL directly from the frontend.

Pre-define demo "scripts" or common pathways for different products.

Error Handling & Recovery:

More robust error handling in the backend to recover from failed Playwright actions (e.g., if a selector is not found).

The AI could be prompted to suggest alternative actions if a primary action fails.

Deployment:

Instructions for deploying the Flask backend to a cloud platform (e.g., Google Cloud Run, AWS EC2/ECS).

Instructions for deploying the React frontend to a static hosting service (e.g., Netlify, Vercel, Firebase Hosting).