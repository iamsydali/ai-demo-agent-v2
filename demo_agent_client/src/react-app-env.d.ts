/// <reference types="react-scripts" />

// Web Speech API minimal types for TypeScript
// You can expand these as needed for more type safety

declare class SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: any) => any) | null;
  onresult: ((this: SpeechRecognition, ev: any) => any) | null;
  onend: ((this: SpeechRecognition, ev: any) => any) | null;
  onerror: ((this: SpeechRecognition, ev: any) => any) | null;
  start(): void;
  stop(): void;
  constructor(): void;
}

type SpeechRecognitionEvent = any;

declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition | undefined;
    SpeechRecognition: typeof SpeechRecognition | undefined;
  }
}
