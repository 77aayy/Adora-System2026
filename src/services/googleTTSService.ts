/**
 * Google Cloud Text-to-Speech Service
 * High-quality Arabic voice synthesis
 * Adora Hotel Management System V2
 */

// API configuration
const TTS_API_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

// Get API key from environment (same key as Gemini works for Cloud TTS)
const getApiKey = (): string | null => {
    // Try TTS-specific key first, then fall back to Gemini key
    return (import.meta as any).env.VITE_GOOGLE_TTS_API_KEY ||
        (import.meta as any).env.VITE_GEMINI_API_KEY ||
        null;
};

// Voice configurations (Wavenet D qualities)
// Voice configurations (Wavenet D qualities)
const VOICE_CONFIGS: Record<string, any> = {
    'ar-EG': { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-A', ssmlGender: 'FEMALE' },
    'en-US': { languageCode: 'en-US', name: 'en-US-Wavenet-F', ssmlGender: 'FEMALE' },
    'hi-IN': { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-D', ssmlGender: 'FEMALE' },
    'bn-IN': { languageCode: 'bn-IN', name: 'bn-IN-Wavenet-A', ssmlGender: 'FEMALE' },
    // Fallback
    'default': { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-A', ssmlGender: 'FEMALE' }
};

// Audio configuration
const AUDIO_CONFIG = {
    audioEncoding: 'MP3',
    speakingRate: 1.15, // Slightly faster/energetic
    pitch: 3.0, // Higher pitch for "cheerful" (mrh) tone
    volumeGainDb: 0.0
};

interface SynthesizeResponse {
    audioContent: string; // Base64 encoded audio
}

/**
 * Synthesize text to speech using Google Cloud TTS
 * @param text Text to convert to speech
 * @param languageCode Optional language code (e.g., 'en-US', 'hi-IN'). Defaults to Arabic.
 * @returns Audio blob URL or null if failed
 */
export const synthesizeSpeech = async (text: string, languageCode: string = 'ar-EG'): Promise<string | null> => {
    const apiKey = getApiKey();

    if (!apiKey) {
        console.warn('🔇 Google TTS API key not configured, falling back to browser TTS');
        return null;
    }

    try {
        console.log(`🎙️ Using Google Cloud TTS (${languageCode}) for:`, text.substring(0, 50) + '...');

        // Select voice based on language
        const voiceConfig = VOICE_CONFIGS[languageCode] || VOICE_CONFIGS['default'];

        const response = await fetch(`${TTS_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: { text },
                voice: voiceConfig,
                audioConfig: AUDIO_CONFIG
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error('🔇 Google TTS error:', error);
            return null;
        }

        const data: SynthesizeResponse = await response.json();

        if (!data.audioContent) {
            console.error('🔇 No audio content in response');
            return null;
        }

        // Convert base64 to blob URL
        const audioBytes = atob(data.audioContent);
        const arrayBuffer = new ArrayBuffer(audioBytes.length);
        const uint8Array = new Uint8Array(arrayBuffer);

        for (let i = 0; i < audioBytes.length; i++) {
            uint8Array[i] = audioBytes.charCodeAt(i);
        }

        const audioBlob = new Blob([uint8Array], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);

        console.log('✅ Google TTS audio ready');
        return audioUrl;

    } catch (error) {
        console.error('🔇 Google TTS failed:', error);
        return null;
    }
};

/**
 * Play audio from URL with cleanup
 */
export const playAudioUrl = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const audio = new Audio(url);

        audio.onended = () => {
            URL.revokeObjectURL(url); // Clean up blob URL
            resolve();
        };

        audio.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };

        audio.play().catch(reject);
    });
};

/**
 * Check if Google TTS is available (API key configured)
 */
export const isGoogleTTSAvailable = (): boolean => {
    return !!getApiKey();
};
