# AI Sales Agent Backend

This is a Python backend for an AI-powered sales demo agent. It uses Flask for the API, Playwright for browser automation, and Google Gemini (Generative AI) for conversational intelligence. The backend automates a browser session, interacts with a SaaS/web app, and streams screenshots and AI responses to a frontend (e.g., React).

## Features
- Live browser automation with Playwright (headless Chromium)
- Conversational AI using Google Gemini (Generative AI)
- Configurable demo flows via JSON files
- Screenshot streaming to frontend for a "virtual browser" experience
- CORS enabled for local frontend development

## Requirements
- Python 3.8+
- [Playwright](https://playwright.dev/python/)
- Flask
- Flask-CORS
- python-dotenv
- google-generativeai

## Setup
1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd demo_agent_server
   ```
2. **Create and activate a virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   playwright install chromium
   ```
4. **Set up environment variables:**
   - Create a `.env` file in the project root:
     ```env
     GOOGLE_API_KEY=your_google_gemini_api_key
     ```

## Running the Server
```bash
python app.py
```
- The server will run on [http://localhost:5000](http://localhost:5000)
- Endpoints:
  - `POST /start_demo` — Start a new demo session
  - `POST /interact` — Send a user message and receive AI response + screenshot
  - `POST /stop_demo` — Stop the demo and close the browser

## Demo Configuration
- Demo flows are configured via JSON files in the `demo_configs/` directory.
- Each config can specify:
  - `start_url`: The initial URL to open
  - `initial_greeting`: Custom greeting for the demo
  - `predefined_actions`: List of actions to perform on start
  - `product_features`: List of features to suggest/demo

**Example `demo_configs/twitter.json`:**
```json
{
  "name": "Twitter",
  "start_url": "https://twitter.com",
  "initial_greeting": "Welcome to the Twitter demo! How can I assist you today?",
  "predefined_actions": [
    {"action": "wait_for_selector", "selector": "input[name='session[username_or_email]']", "timeout": 10000}
  ],
  "product_features": [
    "Real-time tweet streaming",
    "Advanced search",
    "Direct messaging"
  ]
}
```

## Notes
- The backend runs Playwright in headless mode (no visible browser window).
- All browser automation happens on the server; the frontend displays screenshots.
- For production, use a WSGI server like Gunicorn.

## Security
- **Never commit your `.env` file or API keys to version control.**
- The `.gitignore` is set up to exclude sensitive and environment files.

## License
MIT 