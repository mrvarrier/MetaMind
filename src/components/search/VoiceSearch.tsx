import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../common/Button";

interface VoiceSearchProps {
  onTranscript: (transcript: string) => void;
  onSearch: (query: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceSearch({ onTranscript, onSearch, isOpen, onClose }: VoiceSearchProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [volume, setVolume] = useState(0);

  const recognitionRef = useRef<any>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Check if speech recognition is supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setupAudioVisualization();
    };

    recognition.onend = () => {
      setIsListening(false);
      cleanupAudioVisualization();
    };

    recognition.onerror = (event: any) => {
      setError(getErrorMessage(event.error));
      setIsListening(false);
      cleanupAudioVisualization();
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          setConfidence(result[0].confidence);
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
        onTranscript(transcript + finalTranscript);
      }
      setInterimTranscript(interimTranscript);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognition) {
        recognition.stop();
      }
      cleanupAudioVisualization();
    };
  }, [isSupported, transcript, onTranscript]);

  const setupAudioVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      microphone.connect(analyser);
      analyserRef.current = analyser;

      const updateVolume = () => {
        if (!analyserRef.current) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        setVolume(Math.min(average / 128, 1));

        animationRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (error) {
      console.error('Error setting up audio visualization:', error);
      setError('Microphone access denied');
    }
  };

  const cleanupAudioVisualization = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    analyserRef.current = null;
    setVolume(0);
  };

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'no-speech':
        return 'No speech detected. Please try again.';
      case 'audio-capture':
        return 'Audio capture failed. Check your microphone.';
      case 'not-allowed':
        return 'Microphone access denied. Please grant permission.';
      case 'network':
        return 'Network error. Please check your connection.';
      case 'aborted':
        return 'Speech recognition aborted.';
      default:
        return `Speech recognition error: ${error}`;
    }
  };

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    
    setTranscript("");
    setInterimTranscript("");
    setError(null);
    recognitionRef.current.start();
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    recognitionRef.current.stop();
  }, [isListening]);

  const handleSearch = () => {
    const query = transcript.trim();
    if (query) {
      onSearch(query);
      onClose();
    }
  };

  const clearTranscript = () => {
    setTranscript("");
    setInterimTranscript("");
    setConfidence(0);
  };

  if (!isSupported) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={onClose}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-apple p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Voice Search Not Supported
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your browser doesn't support speech recognition. Please use a modern browser like Chrome, Edge, or Safari.
              </p>
              <Button onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white dark:bg-gray-900 rounded-apple p-8 max-w-lg w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                🎤 Voice Search
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Microphone Visualization */}
            <div className="flex flex-col items-center mb-8">
              <motion.div
                className={`relative w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-colors ${
                  isListening 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
                animate={{
                  scale: isListening ? 1 + (volume * 0.3) : 1,
                }}
                transition={{ duration: 0.1 }}
              >
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1c-1.66 0-3 1.34-3 3v8c0 1.66 1.34 3 3 3s3-1.34 3-3V4c0-1.66-1.34-3-3-3zm0 18c-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.93V23h2v-2.07c3.39-.5 6-3.4 6-6.93h-2c0 2.76-2.24 5-5 5z"/>
                </svg>

                {/* Volume Rings */}
                {isListening && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary-300"
                      animate={{
                        scale: [1, 1.5],
                        opacity: [0.8, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeOut",
                      }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary-300"
                      animate={{
                        scale: [1, 1.8],
                        opacity: [0.6, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeOut",
                        delay: 0.5,
                      }}
                    />
                  </>
                )}
              </motion.div>

              <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
                {isListening 
                  ? "Listening... Speak your search query" 
                  : "Click the microphone to start voice search"
                }
              </p>

              {confidence > 0 && (
                <div className="mt-2 flex items-center space-x-2">
                  <span className="text-xs text-gray-500">Confidence:</span>
                  <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-green-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${confidence * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{Math.round(confidence * 100)}%</span>
                </div>
              )}
            </div>

            {/* Transcript Display */}
            <div className="mb-6">
              <div className="min-h-[80px] p-4 bg-gray-50 dark:bg-gray-800 rounded-apple border border-gray-200 dark:border-gray-700">
                {transcript || interimTranscript ? (
                  <div className="text-gray-900 dark:text-white">
                    <span className="font-medium">{transcript}</span>
                    {interimTranscript && (
                      <span className="text-gray-500 dark:text-gray-400 italic">
                        {transcript && " "}{interimTranscript}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    Your speech will appear here...
                  </p>
                )}
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-apple"
                >
                  <p className="text-red-700 dark:text-red-400 text-sm flex items-center">
                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {error}
                  </p>
                </motion.div>
              )}
            </div>

            {/* Control Buttons */}
            <div className="flex flex-col space-y-3">
              <div className="flex space-x-3">
                <Button
                  onClick={isListening ? stopListening : startListening}
                  className={`flex-1 ${isListening ? 'bg-red-500 hover:bg-red-600' : ''}`}
                  disabled={!!error}
                >
                  {isListening ? (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 6h12v12H6z"/>
                      </svg>
                      Stop Listening
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 1c-1.66 0-3 1.34-3 3v8c0 1.66 1.34 3 3 3s3-1.34 3-3V4c0-1.66-1.34-3-3-3z"/>
                      </svg>
                      Start Listening
                    </>
                  )}
                </Button>

                {transcript && (
                  <Button
                    variant="secondary"
                    onClick={clearTranscript}
                    className="px-4"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </Button>
                )}
              </div>

              {transcript && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex space-x-3"
                >
                  <Button
                    onClick={handleSearch}
                    className="flex-1"
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                    Search
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Voice Tips */}
            {!isListening && !transcript && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-apple border border-blue-200 dark:border-blue-800"
              >
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                  💡 Voice Search Tips
                </h4>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <li>• Speak clearly and at a normal pace</li>
                  <li>• Try phrases like "find documents about AI" or "show me images from last week"</li>
                  <li>• Use natural language - no need for special keywords</li>
                  <li>• Reduce background noise for better recognition</li>
                </ul>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}