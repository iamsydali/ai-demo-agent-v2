import React, { useState, useEffect, useRef } from 'react';
// Assume Tailwind CSS is configured in index.css or similar
// For Lucide icons, you might install 'lucide-react' and import specific icons
// For simplicity, using inline SVGs for mic icons.


interface Message {
  role: 'user' | 'ai';
  text: string;
}

function App() {
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [currentScreenshot, setCurrentScreenshot] = useState<string>(''); // Base64 image data
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [inputText, setInputText] = useState<string>(''); // For manual text input
  
  // Define available demos. The 'tag' should match the JSON file name in demo_configs.
  const availableDemos = [
    { tag: 'twitter', name: 'Twitter Demo' },
    { tag: 'google_maps', name: 'Google Maps Demo' },
    // Add more demos here as you create their JSON config files in the backend:
    // { tag: 'my_client_app', name: 'My Client App Demo' },
  ];
  const [selectedDemoTag, setSelectedDemoTag] = useState<string>(availableDemos[1].tag); // Default to the first demo

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isSpeakingRef = useRef(false); // To track if AI is speaking

  // Replace with your backend URL (e.g., 'http://localhost:5000' during development)
  const backendUrl = 'http://localhost:5000';

  // Initialize Web Speech API for voice input
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      if (recognitionRef.current) {
        recognitionRef.current.continuous = true; // Enable continuous listening
        recognitionRef.current.interimResults = false; // Only final results will be processed
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          setIsRecordingVoice(true);
          console.log('Voice recognition started.');
        };

        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => { // Type event here
          // Process only final results to send to backend
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              const transcript = event.results[i][0].transcript;
              console.log('User said (final):', transcript);
              handleSendMessage(transcript);
            }
          }
        };

        recognitionRef.current.onend = () => {
          setIsRecordingVoice(false);
          console.log('Voice recognition ended.');
          // If AI is not speaking, restart recognition to maintain continuous listening
          if (!isSpeakingRef.current && isDemoRunning) {
            // Add a small delay before restarting to prevent immediate re-triggering
            setTimeout(() => {
              if (recognitionRef.current && !isSpeakingRef.current) {
                recognitionRef.current.start();
              }
            }, 500); // 500ms delay
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsRecordingVoice(false);
          // If AI is not speaking, attempt to restart recognition after an error
          if (!isSpeakingRef.current && isDemoRunning) {
            setTimeout(() => {
              if (recognitionRef.current && !isSpeakingRef.current) {
                recognitionRef.current.start();
              }
            }, 1000); // Longer delay after error
          }
          setChatHistory((prev) => [...prev, { role: 'ai', text: 'Sorry, I had trouble understanding that. Could you please try again?' }]);
        };
      }
    } else {
      console.warn('Web Speech API not fully supported in this browser. Voice input will be disabled.');
      setChatHistory((prev) => [...prev, { role: 'ai', text: 'Your browser does not fully support voice input. Please type your messages.' }]);
    }
  }, [isDemoRunning]); // Re-run effect if demo state changes to manage recognition lifecycle

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Play AI voice response using Web Speech Synthesis API
  const playAiVoice = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        // Stop recognition while AI is speaking
        if (recognitionRef.current && isRecordingVoice) {
          recognitionRef.current.stop();
        }
      };

      utterance.onend = () => {
        isSpeakingRef.current = false;
        // Restart recognition after AI finishes speaking
        if (recognitionRef.current && isDemoRunning) {
          recognitionRef.current.start();
        }
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        isSpeakingRef.current = false;
        if (recognitionRef.current && isDemoRunning) {
          recognitionRef.current.start();
        }
      };

      window.speechSynthesis.speak(utterance);
    } else {
      console.warn('Web Speech Synthesis API not supported.');
    }
  };

  // Handles sending messages (from voice or text input) to the backend
  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    const newUserMessage: Message = { role: 'user', text: message };
    setChatHistory((prev) => [...prev, newUserMessage]);
    setInputText(''); // Clear text input field

    // Temporarily stop recognition while waiting for AI response
    if (recognitionRef.current && isRecordingVoice) {
      recognitionRef.current.stop();
    }

    try {
      // Send the current chat history for better context for the LLM
      const response = await fetch(`${backendUrl}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, chat_history: chatHistory }),
      });
      const data = await response.json();

      if (data.error) {
        console.error('Backend error:', data.error);
        const errorMessage: Message = { role: 'ai', text: `Error: ${data.error}. Please try again.` };
        setChatHistory((prev) => [...prev, errorMessage]);
        playAiVoice(errorMessage.text); // Play error message
      } else {
        const aiResponse: Message = { role: 'ai', text: data.ai_response };
        setChatHistory((prev) => [...prev, aiResponse]);
        playAiVoice(data.ai_response); // Play AI's response
        // Update screenshot if provided
        if (data.current_screenshot) {
          setCurrentScreenshot(`data:image/png;base64,${data.current_screenshot}`);
        }
      }
    } catch (error) {
      console.error('Failed to communicate with backend:', error);
      const networkError: Message = { role: 'ai', text: 'Sorry, I could not connect to the demo agent. Please ensure the backend server is running and accessible at ' + backendUrl };
      setChatHistory((prev) => [...prev, networkError]);
      playAiVoice(networkError.text); // Play network error message
    }
  };

  // Toggles voice recording (primarily for initial start/manual stop)
  const toggleVoiceRecording = () => {
    if (recognitionRef.current) {
      if (isRecordingVoice) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
    } else {
      // Replace with custom modal if needed, as per instructions
      alert('Speech Recognition is not supported in your browser.');
    }
  };

  // Starts the web demo by initializing the Playwright browser on the backend
  const startDemo = async () => {
    setChatHistory([]); // Clear previous chat
    setCurrentScreenshot(''); // Clear previous screenshot
    setIsDemoRunning(false); // Set to false temporarily while starting
    if (recognitionRef.current && isRecordingVoice) {
      recognitionRef.current.stop(); // Stop any ongoing recognition
    }

    try {
      const response = await fetch(`${backendUrl}/start_demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo_tag: selectedDemoTag }), // Send the selected demo tag
      });
      const data = await response.json();
      if (data.error) {
        console.error('Error starting demo:', data.error);
        const errorMessage: Message = { role: 'ai', text: `Error starting demo: ${data.error}` };
        setChatHistory([errorMessage]);
        playAiVoice(errorMessage.text);
      } else {
        const initialAiResponse: Message = { role: 'ai', text: data.ai_response };
        setChatHistory([initialAiResponse]);
        playAiVoice(initialAiResponse.text); // Play initial response after user click
        if (data.current_screenshot) {
          setCurrentScreenshot(`data:image/png;base64,${data.current_screenshot}`);
        }
        setIsDemoRunning(true);
        // Start recognition after demo is confirmed to be running and AI has spoken
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      }
    } catch (error) {
      console.error('Failed to start demo:', error);
      const networkError: Message = { role: 'ai', text: 'Could not start the demo. Is the backend running and accessible at ' + backendUrl + '?' };
      setChatHistory([networkError]);
      playAiVoice(networkError.text);
    }
  };

  // Stops the web demo by closing the Playwright browser on the backend
  const stopDemo = async () => {
    if (recognitionRef.current && isRecordingVoice) {
      recognitionRef.current.stop(); // Stop recognition when stopping demo
    }
    try {
      await fetch(`${backendUrl}/stop_demo`, { method: 'POST' });
      setIsDemoRunning(false);
      setChatHistory((prev) => [...prev, { role: 'ai', text: 'Demo ended. Thank you for your time!' }]);
      playAiVoice('Demo ended. Thank you for your time!');
      setCurrentScreenshot(''); // Clear screenshot
    } catch (error) {
      console.error('Failed to stop demo:', error);
      setChatHistory((prev) => [...prev, { role: 'ai', text: 'There was an issue stopping the demo, but you can try starting a new one.' }]);
    }
  };

  // Removed automatic startDemo on component mount to fix 'not-allowed' error
  // User must click "Start New Demo" button to begin
  useEffect(() => {
    // Initial message to prompt user to start demo
    setChatHistory([{ role: 'ai', text: 'Welcome! Please select a demo from the dropdown and click "Start New Demo" to begin your interactive product tour.' }]);
    // Cleanup function to stop demo when component unmounts (e.g., page refresh/close)
    return () => {
      stopDemo();
    };
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-800">
      {/* Left Panel: Chat Transcription */}
      <div className="w-1/3 bg-white p-6 flex flex-col rounded-l-xl shadow-2xl m-4">
        <h2 className="text-3xl font-extrabold mb-6 text-indigo-700">AI Demo Agent</h2>
        <div ref={chatContainerRef} className="flex-grow overflow-y-auto space-y-4 mb-6 pr-2">
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-100 self-end text-right ml-auto'
                  : 'bg-gray-100 self-start mr-auto'
              } max-w-[90%]`}
            >
              <p className={`font-semibold text-sm ${msg.role === 'user' ? 'text-indigo-800' : 'text-gray-700'}`}>
                {msg.role === 'user' ? 'You:' : 'AI:'}
              </p>
              <p className="text-base">{msg.text}</p>
            </div>
          ))}
        </div>

        {/* Demo Selection Dropdown */}
        <div className="mb-4">
          <label htmlFor="demoSelect" className="block text-sm font-medium text-gray-700 mb-1">
            Select Demo:
          </label>
          <select
            id="demoSelect"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow duration-200"
            value={selectedDemoTag}
            onChange={(e) => setSelectedDemoTag(e.target.value)}
            disabled={isDemoRunning}
          >
            {availableDemos.map((demo) => (
              <option key={demo.tag} value={demo.tag}>
                {demo.name}
              </option>
            ))}
          </select>
        </div>

        {/* Voice & Text Input Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleVoiceRecording}
            // Disable manual toggle if AI is speaking or demo not running
            disabled={isSpeakingRef.current || !isDemoRunning}
            className={`p-4 rounded-full shadow-lg transition-all duration-300 ease-in-out
              ${isRecordingVoice ? 'bg-red-600 hover:bg-red-700' : 'bg-green-500 hover:bg-green-600'}
              text-white focus:outline-none focus:ring-4 focus:ring-opacity-50
              ${isRecordingVoice ? 'focus:ring-red-300' : 'focus:ring-green-300'}
              ${(isSpeakingRef.current || !isDemoRunning) ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            title={isRecordingVoice ? 'Stop Recording' : 'Start Recording'}
          >
            {isRecordingVoice ? (
              // Mic Off icon (or a "listening" indicator if you prefer)
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic-off"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10 9v3a2 2 0 0 0 4 0V9"/><path d="M19 10v2a7 7 0 0 1-13.38 2.33"/><path d="M9.42 5.61A4 4 0 0 1 12 2a4 4 0 0 1 7.96 1"/><path d="M17 19v-2"/><path d="M12 19v-2"/></svg>
            ) : (
              // Mic On icon
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            )}
          </button>
          <input
            type="text"
            placeholder="Type your message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage(inputText);
              }
            }}
            disabled={isSpeakingRef.current || !isDemoRunning} // Disable text input while AI is speaking
            className={`flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow duration-200
            ${(isSpeakingRef.current || !isDemoRunning) ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <button
            onClick={() => handleSendMessage(inputText)}
            disabled={isSpeakingRef.current || !isDemoRunning || !inputText.trim()} // Disable send button
            className={`bg-indigo-500 hover:bg-indigo-600 text-white p-3 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-300
            ${(isSpeakingRef.current || !isDemoRunning || !inputText.trim()) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Send
          </button>
        </div>

        {/* Demo Control Buttons */}
        <div className="mt-6 flex justify-between space-x-2">
          <button
            onClick={startDemo}
            disabled={isDemoRunning}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-purple-300"
          >
            Start New Demo
          </button>
          <button
            onClick={stopDemo}
            disabled={!isDemoRunning}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-red-300"
          >
            Stop Demo
          </button>
        </div>
      </div>

      {/* Right Panel: Web Demo Display */}
      <div className="w-2/3 bg-gray-900 flex items-center justify-center rounded-r-xl shadow-2xl m-4 relative overflow-hidden">
        <h2 className="absolute top-6 left-6 text-3xl font-extrabold text-white z-10">Live Product Demo</h2>
        {currentScreenshot ? (
          <img
            src={currentScreenshot}
            alt="Live Web Demo"
            className="w-full h-full object-contain rounded-r-xl"
            style={{ filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))' }} // Subtle shadow for the image
          />
        ) : (
          <div className="text-white text-xl font-medium animate-pulse text-center p-4">
            {isDemoRunning ? 'Loading demo...' : 'Select a demo from the dropdown and click "Start New Demo" to begin your interactive product tour.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
