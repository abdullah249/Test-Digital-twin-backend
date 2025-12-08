import * as dotenv from 'dotenv';
dotenv.config();
import { z } from "zod";

export class VoiceService {
  private apiKey: string;
  private useElevenLabs: boolean = true;
  private lastCallTimestamp: number = 0;
  private rateLimitDelay: number = 1000; // 1 second between calls
  private isConversationActive = false;
  private startTime: number = 0;
  private CONVERSATION_DURATION = 60000; // 60 seconds
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ELEVENLABS_API_KEY not set, voice synthesis will use fallback');
    }
  console.log('[VoiceService] API key present:', !!this.apiKey);
  }

  async synthesizeSpeech({ text, persona, voiceId }: {
    text: string;
    persona?: string;
    voiceId?: string; // New parameter
  }): Promise<Buffer | { fallback: true, text: string, persona?: string }> {
    try {
      if (!this.apiKey) {
        console.log('[VoiceService] No API key: returning fallback');
        return { fallback: true, text, persona, reason: 'missing_api_key' } as any;
      }

      // Reduce text length to cut credit usage and improve success rate
      const maxChars = 600;
      const truncatedText = text.length > maxChars ? 
        text.substring(0, maxChars) + "..." : 
        text;

      const timeSinceLastCall = Date.now() - this.lastCallTimestamp;
      if (timeSinceLastCall < this.rateLimitDelay) {
        await new Promise(r => setTimeout(r, this.rateLimitDelay - timeSinceLastCall));
      }

      // Map personas to your trained voice IDs
      const personaVoiceMap: Record<string, string> = {
        "Leonardo da Vinci": "iLVmqjzCGGvqtMCk6vVQ", // Leonardo (professional)
        "Steve Jobs": "RScb7njQ3VwA2nyCsZX4", // Steve jobs (cloned)
        "Albert Einstein": "e2odxVHlmLJ5GY1yuWNl", // Albert E (professional)
        "Elon Musk": "3ltnAVoovAIVA7uE9Zbz", // Elon Musk (cloned)
        "Walt Disney": "1KmhFCCzy2hRrIDMEXFZ", // Walt Disney (cloned)
        "Emad Mostaque": "OXihjRbFbxh4LfP9Wt5H", // Emad mostaque (cloned)
        "Fei-Fei Li": "JL6vl3xyRi3Ly7WoywNO" // Fi Fi Lee (cloned)
      };

      // Fuzzy/alias mapping so slight name variations still map to the correct voice
      const personaAliases: Record<string, string[]> = {
        "Fei-Fei Li": [
          "fei fei li",
          "fei-fei li",
          "feifei li",
          "fi fi lee",
          "fei fei lee",
          "fei-fei lee",
          "fifi li",
          "fei fei le",
          "fei-fei le",
          "fe fe li",
          "fe fe le",
          "fi fi li",
        ],
      };

      const resolveVoiceIdForPersona = (name?: string): string | null => {
        if (!name) return null;
        if (personaVoiceMap[name]) return personaVoiceMap[name];
        const normalized = name.toLowerCase().trim();
        for (const key of Object.keys(personaVoiceMap)) {
          if (key.toLowerCase() === normalized) {
            return personaVoiceMap[key];
          }
        }
        for (const [canonical, aliases] of Object.entries(personaAliases)) {
          if (aliases.some(a => a === normalized)) {
            return personaVoiceMap[canonical];
          }
        }
        for (const key of Object.keys(personaVoiceMap)) {
          if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
            return personaVoiceMap[key];
          }
        }
        return null;
      };

      let selectedVoiceId = voiceId;
      if (!selectedVoiceId) {
        selectedVoiceId = resolveVoiceIdForPersona(persona) || undefined;
      }
      
      if (!selectedVoiceId) {
        // Fallback to default voices
        const isLeonardo = persona?.toLowerCase().includes('leonardo');
        selectedVoiceId = isLeonardo
          ? "iLVmqjzCGGvqtMCk6vVQ"  // Leonardo's voice
          : "RScb7njQ3VwA2nyCsZX4"; // Jobs' voice
      }

      console.log(`Using voice ID: ${selectedVoiceId} for persona: ${persona}`);

      const voiceSettings = {
        stability: 0.8, // Standardized
        similarity_boost: 0.8,
        style: 0.5,
        use_speaker_boost: true
      };

      const makeRequest = async (payloadText: string) => {
        const requestPayload = {
          text: payloadText,
          model_id: "eleven_monolingual_v1",
          voice_settings: voiceSettings
        };
        return fetch(`${this.baseUrl}/text-to-speech/${selectedVoiceId}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          },
          body: JSON.stringify(requestPayload)
        });
      };

      console.log('Making voice synthesis request:', {
        persona,
        voiceId: selectedVoiceId,
        textLength: truncatedText.length
      });

      let response = await makeRequest(truncatedText);

      // If quota exceeded, attempt to retry with very short text once
      if (!response.ok) {
        const errorBody = await response.text();
        if (errorBody.includes('quota_exceeded')) {
          const shortText = text.slice(0, 120);
          response = await makeRequest(shortText);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        });
        return { fallback: true, text, persona, reason: `api_error_${response.status}` } as any;
      }

      this.lastCallTimestamp = Date.now();
      const arrayBuffer = await response.arrayBuffer();
      console.log('Voice synthesis successful:', {
        persona,
        audioSize: arrayBuffer.byteLength
      });
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Speech synthesis failed (exception):', error);
      return { fallback: true, text, persona, reason: 'exception' } as any;
    }
  }

  async getVoices() {
    if (!this.useElevenLabs) {
      console.log('Using fallback voices');
      return [
        { voice_id: "iLVmqjzCGGvqtMCk6vVQ", name: "Leonardo da Vinci (Fallback)" },
        { voice_id: "RScb7njQ3VwA2nyCsZX4", name: "Steve Jobs (Fallback)" }
      ];
    }

    try {
      console.log('Fetching voices from ElevenLabs API...');

      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'Accept': 'application/json',
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching voices:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        });
        return [
          { voice_id: "iLVmqjzCGGvqtMCk6vVQ", name: "Leonardo da Vinci (Fallback)" },
          { voice_id: "RScb7njQ3VwA2nyCsZX4", name: "Steve Jobs (Fallback)" }
        ];
      }

      const data = await response.json();
      return data.voices.map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name
      }));
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [
        { voice_id: "iLVmqjzCGGvqtMCk6vVQ", name: "Leonardo da Vinci (Fallback)" },
        { voice_id: "RScb7njQ3VwA2nyCsZX4", name: "Steve Jobs (Fallback)" }
      ];
    }
  }

  // Add method to get all available voices
  async getAllVoices(): Promise<any[]> {
    try {
      if (!this.apiKey) {
        console.warn('Cannot fetch voices: ELEVENLABS_API_KEY not set');
        return [];
      }

      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Available ElevenLabs voices:', data.voices?.map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category
      })));
      
      return data.voices || [];
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }

  private async generateConversation() {
    const speakers = ["Leonardo da Vinci", "Steve Jobs"];
    let currentSpeakerIndex = 0;

    const conversationScript = [
      "Design thinking is about understanding human needs and solving problems creatively.",
      "Innovation comes from saying no to 1,000 things to make sure we don't get on the wrong track.",
      "The beauty of design lies in its harmony with nature's principles.",
      "Design is not just what it looks like. Design is how it works.",
      "Every great design begins with an even better story.",
      "Simplicity is the ultimate sophistication in design."
    ];

    for (const line of conversationScript) {
      if (!this.isConversationActive) break;

      await this.synthesizeSpeech({
        text: line,
        persona: speakers[currentSpeakerIndex]
      });

      currentSpeakerIndex = (currentSpeakerIndex + 1) % speakers.length;

      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  async startConversation() {
    this.isConversationActive = true;
    this.startTime = Date.now();
    await this.generateConversation();
    this.isConversationActive = false;
  }

  async stopConversation() {
    this.isConversationActive = false;
  }
}

export const voiceService = new VoiceService();
