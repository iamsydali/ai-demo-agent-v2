from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from playwright.sync_api import sync_playwright
import base64
import io
import json
import os
import time
import google.generativeai as genai
from google.generativeai import GenerativeModel, GenerationConfig
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# --- Configuration ---
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
if not GOOGLE_API_KEY:
    print("WARNING: GOOGLE_API_KEY not set. Please set it in your environment variables or a .env file.")

if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

model = GenerativeModel(model_name="gemini-1.5-flash")

generation_config = GenerationConfig(
    response_mime_type="application/json",
    response_schema={
        "type": "OBJECT",
        "properties": {
            "ai_response": {"type": "STRING"},
            "web_action": {
                "type": "OBJECT",
                "properties": {
                    "action": {"type": "STRING", "enum": ["click", "type", "navigate", "scroll", "wait", "wait_for_selector"]},
                    "selector": {"type": "STRING"},
                    "value": {"type": "STRING"},
                    "url": {"type": "STRING"},
                    "direction": {"type": "STRING", "enum": ["up", "down"]},
                    "duration": {"type": "INTEGER"},
                    "timeout": {"type": "INTEGER"}
                },
                "required": ["action"]
            },
            "proposed_feature": {"type": "STRING"} # New field for proposed feature
        },
        "required": ["ai_response"]
    }
)

# Global Playwright context variables
playwright_instance = None
browser = None
page = None
current_url = "about:blank"
current_demo_features = []
last_proposed_feature = None # To keep track of what AI proposed last

# Directory where demo configuration JSON files are stored
DEMO_CONFIGS_DIR = os.path.join(os.path.dirname(__file__), 'demo_configs')

def load_demo_config(demo_tag: str):
    """Loads demo configuration from a JSON file."""
    config_path = os.path.join(DEMO_CONFIGS_DIR, f"{demo_tag}.json")
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Demo configuration file not found: {config_path}")
    
    with open(config_path, 'r') as f:
        return json.load(f)

def initialize_browser():
    """Initializes a new Playwright browser instance and page."""
    global playwright_instance, browser, page, current_url
    if page is None:
        try:
            playwright_instance = sync_playwright().start()
            browser = playwright_instance.chromium.launch(headless=True) # Keep headless=False for visibility
            page = browser.new_page()
            page.set_viewport_size({"width": 1280, "height": 800})
            current_url = "about:blank"
            print("Playwright browser initialized successfully.")
        except Exception as e:
            print(f"Error initializing Playwright browser: {e}")
            if browser:
                browser.close()
            if playwright_instance:
                playwright_instance.stop()
            playwright_instance = None
            browser = None
            page = None
            raise

def close_browser():
    """Closes the Playwright browser instance."""
    global playwright_instance, browser, page, current_url, current_demo_features, last_proposed_feature
    if browser:
        try:
            browser.close()
            playwright_instance.stop()
            print("Playwright browser closed.")
        except Exception as e:
            print(f"Error closing Playwright browser: {e}")
        finally:
            playwright_instance = None
            browser = None
            page = None
            current_url = "about:blank"
            current_demo_features = []
            last_proposed_feature = None

def retry_action(action_func, *args, retries=3, delay=0.5, **kwargs):
    """Retries a Playwright action multiple times."""
    for i in range(retries):
        try:
            action_func(*args, **kwargs)
            return True
        except Exception as e:
            print(f"Attempt {i+1} failed: {e}")
            if i < retries - 1:
                time.sleep(delay)
            else:
                raise # Re-raise if all retries fail
    return False

@app.route('/start_demo', methods=['POST'])
def start_demo():
    """
    Initializes the browser and navigates to the starting demo URL based on a demo_tag.
    Performs predefined actions and returns an initial AI greeting and the first screenshot.
    """
    global current_url, page, current_demo_features, last_proposed_feature
    demo_tag = request.json.get('demo_tag', 'twitter')

    try:
        demo_config = load_demo_config(demo_tag)
        start_url = demo_config.get('start_url')
        predefined_actions = demo_config.get('predefined_actions', [])
        demo_name = demo_config.get('name', demo_tag.capitalize())
        initial_greeting = demo_config.get(
            'initial_greeting',
            f"Hello! Welcome to the demo of {demo_name}. I'm performing the initial setup steps. What would you like to explore first?"
        )
        current_demo_features = demo_config.get('product_features', [])
        last_proposed_feature = None # Reset on new demo start

        if not start_url:
            return jsonify({"error": "Demo configuration missing 'start_url'."}), 400
        
        if not start_url.startswith(('http://', 'https://')):
            return jsonify({"error": "Invalid URL format in demo config. Please provide a URL starting with http:// or https://."}), 400

        close_browser()
        initialize_browser()
        
        print(f"Navigating to initial URL: {start_url}")
        page.goto(start_url, wait_until='load', timeout=30000)
        current_url = page.url

        for action_data in predefined_actions:
            action_type = action_data.get("action")
            selector = action_data.get("selector")
            value = action_data.get("value")
            url = action_data.get("url")
            direction = action_data.get("direction")
            duration = action_data.get("duration")
            timeout = action_data.get("timeout")

            try:
                print(f"Executing predefined action: {action_type} - Selector: {selector} - Value: {value} - Timeout: {timeout}")
                if action_type == "click" and selector:
                    retry_action(page.click, selector, timeout=10000)
                    page.wait_for_load_state('networkidle', timeout=10000)
                elif action_type == "type" and selector and value is not None:
                    retry_action(page.fill, selector, value, timeout=10000)
                elif action_type == "navigate" and url:
                    if not url.startswith(('http://', 'https://')):
                        print(f"Warning: Invalid URL in predefined action: {url}")
                        continue
                    page.goto(url, wait_until='networkidle', timeout=15000)
                    current_url = page.url
                elif action_type == "scroll" and direction:
                    if direction == "down":
                        page.evaluate("window.scrollBy(0, window.innerHeight * 0.8)")
                    elif direction == "up":
                        page.evaluate("window.scrollBy(0, -window.innerHeight * 0.8)")
                elif action_type == "wait" and duration is not None:
                    page.wait_for_timeout(duration)
                elif action_type == "wait_for_selector" and selector:
                    page.wait_for_selector(selector, timeout=timeout)
                else:
                    print(f"Warning: Unrecognized predefined action type: {action_type}")
            except Exception as action_err:
                print(f"Error during predefined action '{action_type}' on '{selector or url}': {action_err}")
                initial_greeting += f" I encountered an issue during setup: {str(action_err)}. I'll proceed, but please be aware."

        screenshot_bytes = page.screenshot(type="jpeg", quality=85)
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode('utf-8')

        return jsonify({
            "ai_response": initial_greeting,
            "current_screenshot": screenshot_base64
        })
    except FileNotFoundError as e:
        print(f"Configuration error: {e}")
        close_browser()
        return jsonify({"error": f"Demo configuration not found for tag '{demo_tag}'. {e}"}), 404
    except Exception as e:
        print(f"Failed to start demo: {e}")
        close_browser()
        return jsonify({"error": f"Could not start the demo: {e}"}), 500

@app.route('/interact', methods=['POST'])
def interact():
    """
    Processes user messages, interacts with the LLM to determine actions,
    executes web automation, and returns AI response and updated screenshot.
    """
    global page, current_url, current_demo_features, last_proposed_feature
    if page is None:
        return jsonify({"error": "Demo not started. Please call /start_demo first."}), 400

    user_message = request.json.get('message', '')
    received_chat_history = request.json.get('chat_history', [])
    
    llm_chat_history = []
    for msg in received_chat_history:
        role = msg['role']
        if role == 'assistant':
            role = 'model'
        elif role != 'user':
            continue  # Skip any message with an invalid role
        llm_chat_history.append({"role": role, "parts": [{"text": msg['text']}]})
    
    # Always append the current user message as 'user'
    llm_chat_history.append({"role": "user", "parts": [{"text": user_message}]})

    try:
        screenshot_bytes = page.screenshot(type="jpeg", quality=85)
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode('utf-8')
        image_part = {
            "inline_data": {
                "mime_type": "image/jpeg",
                "data": screenshot_base64
            }
        }
    except Exception as e:
        print(f"Error capturing screenshot for LLM: {e}")
        image_part = None

    features_list = "\n".join([f"- {feature}" for feature in current_demo_features])
    
    # Logic to handle proposed features
    # If the user's message confirms the last proposed feature, clear the proposal
    if last_proposed_feature and any(keyword in user_message.lower() for keyword in ["yes", "show me", "sure", "ok"]):
        user_message = f"User confirmed to see: {last_proposed_feature}. Now, please demonstrate this feature."
        last_proposed_feature = None # Clear it after confirmation
    elif last_proposed_feature and any(keyword in user_message.lower() for keyword in ["no", "not now", "later", "something else"]):
        user_message = f"User declined to see: {last_proposed_feature}. User now asks: {user_message}. Please suggest another feature or ask what they want."
        last_proposed_feature = None # Clear it after decline
    
    llm_prompt_parts = [
        {"text": f"""
        You are an AI sales demo agent. Your goal is to guide a user through a live demo of a web application.
        You should act like a helpful, proactive, and engaging sales agent.
        
        Here's the current context:
        - Current URL: {current_url}
        - User's request: "{user_message}"
        - Current webpage state: (screenshot provided)
        
        Here are some key features of the product you are demonstrating. Try to weave these into your conversation naturally, especially at the beginning of the demo or when the user asks about capabilities.
        If the user's intent is general or unclear, proactively suggest demonstrating one of these features.
        
        Product Features:
        {features_list if features_list else "No specific features provided for this demo."}

        Based on the user's request and the current webpage, decide on a conversational response and, if necessary, a single web automation action.
        
        Available actions and their parameters:
        - "click": {{ "action": "click", "selector": "CSS_SELECTOR_OF_ELEMENT" }}
            (Use robust CSS selectors. Prioritize visible text, `data-testid`, `id`, or unique class names. Example: `button:has-text('Sign Up')`, `#submitBtn`, `[data-testid='login-button']`)
        - "type": {{ "action": "type", "selector": "CSS_SELECTOR_OF_INPUT", "value": "TEXT_TO_TYPE" }}
            (Use robust CSS selectors for input fields. Example: `input[type='email']`, `textarea#comment-box`)
        - "navigate": {{ "action": "navigate", "url": "FULL_URL_TO_GO_TO" }}
            (Ensure the URL is valid and starts with http:// or https://.)
        - "scroll": {{ "action": "scroll", "direction": "up" | "down" }}
        - "wait": {{ "action": "wait", "duration": INTEGER_MILLISECONDS }}
        - "wait_for_selector": {{ "action": "wait_for_selector", "selector": "CSS_SELECTOR_OF_ELEMENT", "timeout": INTEGER_MILLISECONDS }}
            (Always use this before interacting with an element that might not be immediately present.)

        If you are proposing a feature demonstration and waiting for user confirmation, set the "web_action" to `null` and include a `proposed_feature` field in your JSON output with the name of the feature you are proposing to demonstrate. The `ai_response` should be a question asking for confirmation.

        If no web action is needed for the current turn, omit the "web_action" key.
        Always provide a friendly, informative, and proactive "ai_response". Try to anticipate user needs and guide them through the product's benefits.

        Respond in the following JSON format. Ensure the JSON is valid and strictly follows the schema.
        {{
            "ai_response": "Your conversational reply here.",
            "web_action": {{ "action": "...", "selector": "...", "value": "...", "url": "...", "direction": "...", "duration": "...", "timeout": "..." }},
            "proposed_feature": "Name of the feature you are proposing to demo (if any)"
        }}
        
        Think step-by-step.
        1. What is the user's explicit request?
        2. If the request is general or vague, what is the next logical feature to demonstrate from the 'Product Features' list?
        3. Should I propose a feature demo and wait for confirmation, or directly perform an action?
        4. What is the most robust CSS selector for the target element?
        5. What is the most appropriate single action for this turn?
        """}
    ]
    
    if image_part:
        llm_prompt_parts.append(image_part)

    try:
        response = model.generate_content(
            contents=llm_chat_history[:-1] + [{"role": "user", "parts": llm_prompt_parts}],
            generation_config=generation_config
        )
        
        llm_output = json.loads(response.text)
        ai_response_text = llm_output.get("ai_response", "I'm not sure how to respond to that.")
        web_action = llm_output.get("web_action")
        proposed_feature = llm_output.get("proposed_feature")

        # Update last_proposed_feature state
        if proposed_feature:
            last_proposed_feature = proposed_feature
        else:
            last_proposed_feature = None # Clear if no feature was proposed this turn

        if web_action:
            action_type = web_action.get("action")
            selector = web_action.get("selector")
            value = web_action.get("value")
            url = web_action.get("url")
            direction = web_action.get("direction")
            duration = web_action.get("duration")
            timeout = web_action.get("timeout")

            try:
                print(f"Attempting web action: {action_type} - Selector: {selector} - Value: {value} - URL: {url} - Direction: {direction} - Duration: {duration} - Timeout: {timeout}")
                if action_type == "click" and selector:
                    if not retry_action(page.click, selector, timeout=5000):
                        raise Exception(f"Failed to click selector '{selector}' after retries.")
                    page.wait_for_load_state('networkidle', timeout=10000)
                elif action_type == "type" and selector and value is not None:
                    if not retry_action(page.fill, selector, value, timeout=5000):
                        raise Exception(f"Failed to type into selector '{selector}' after retries.")
                elif action_type == "navigate" and url:
                    if not url.startswith(('http://', 'https://')):
                        ai_response_text += " I received an invalid URL for navigation. Please provide a full URL starting with http:// or https://."
                    else:
                        page.goto(url, wait_until='networkidle', timeout=15000)
                        current_url = page.url
                elif action_type == "scroll" and direction:
                    if direction == "down":
                        page.evaluate("window.scrollBy(0, window.innerHeight * 0.8)")
                    elif direction == "up":
                        page.evaluate("window.scrollBy(0, -window.innerHeight * 0.8)")
                elif action_type == "wait" and duration is not None:
                    page.wait_for_timeout(duration)
                elif action_type == "wait_for_selector" and selector:
                    page.wait_for_selector(selector, timeout=timeout)
                else:
                    ai_response_text += " I received an unrecognized web action from the AI."
                print(f"Executed web action: {action_type}")

            except Exception as web_err:
                print(f"Error executing web action '{action_type}' on '{selector or url}': {web_err}")
                ai_response_text += f" I tried to perform an action on the website but encountered an issue: {str(web_err)}. Let's try something else."

        screenshot_bytes = page.screenshot(type="jpeg", quality=85)
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode('utf-8')

        return jsonify({
            "ai_response": ai_response_text,
            "current_screenshot": screenshot_base64
        })

    except Exception as e:
        print(f"Error in LLM interaction or overall process: {e}")
        return jsonify({"error": f"An internal error occurred: {e}"}), 500

@app.route('/stop_demo', methods=['POST'])
def stop_demo():
    """Closes the Playwright browser session."""
    try:
        close_browser()
        return jsonify({"message": "Demo stopped and browser closed."})
    except Exception as e:
        print(f"Failed to stop demo: {e}")
        return jsonify({"error": f"Could not stop the demo: {e}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=False)
