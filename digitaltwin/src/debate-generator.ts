import { voiceService } from './voice-service.js';

/**
 * Simple debate turn structure
 */
export interface DebateTurn {
  speaker: string;
  text: string;
}

export interface DebateResult {
  topic: string;
  turns: DebateTurn[];
  combinedText: string;
  // Optional concatenated MP3 buffer (if audio synthesis enabled)
  audioBuffer?: Buffer;
}

// Canonical digital twins used for debates (can be expanded)
const DEFAULT_SPEAKERS = [
  'Albert Einstein',
  'Steve Jobs'
];

// Very lightweight heuristic response scaffolding; in real system replace with LLM pipeline
function craftPerspective(speaker: string, topic: string, index: number): string {
  const base = topic.trim();
  switch (speaker) {
    case 'Albert Einstein':
      return `From a theoretical and systemic perspective, "${base}" demands that we examine fundamental assumptions, reduce them to first principles, then recompose them into models we can test. Practical progress emerges when abstraction meets empirical validation.`;
    case 'Steve Jobs':
      return `If we care about "${base}", we have to start with the user experience and work backwards to the technology. Focus. Eliminate the noise. What actually delights or liberates people here? Build that—relentlessly.`;
    default:
      return `${speaker} adds viewpoint #${index + 1} regarding "${base}" focusing on pragmatic trade‑offs and emergent possibilities.`;
  }
}

export interface GenerateDebateOptions {
  topic: string;
  speakers?: string[];
  includeAudio?: boolean; // synthesize MP3 using existing voiceService where possible
  maxTurnsPerSpeaker?: number; // simple limit
}

export async function generateDebate(options: GenerateDebateOptions): Promise<DebateResult> {
  const {
    topic,
    speakers = DEFAULT_SPEAKERS,
    includeAudio = false,
    maxTurnsPerSpeaker = 1
  } = options;

  const turns: DebateTurn[] = [];
  for (let round = 0; round < maxTurnsPerSpeaker; round++) {
    for (let i = 0; i < speakers.length; i++) {
      const speaker = speakers[i];
      turns.push({
        speaker,
        text: craftPerspective(speaker, topic, round * speakers.length + i)
      });
    }
  }

  let audioBuffer: Buffer | undefined;
  if (includeAudio) {
    const buffers: Buffer[] = [];
    for (const turn of turns) {
      try {
        const audio = await voiceService.synthesizeSpeech({ text: turn.text, persona: turn.speaker });
        if (Buffer.isBuffer(audio)) {
          buffers.push(audio);
        }
      } catch (err) {
        // Fail soft on audio for an individual turn
        // eslint-disable-next-line no-console
        console.error('Audio synthesis failed for', turn.speaker, err);
      }
    }
    if (buffers.length) {
      audioBuffer = Buffer.concat(buffers);
    }
  }

  const combinedText = turns.map(t => `*${t.speaker}:* ${t.text}`).join('\n');
  return { topic, turns, combinedText, audioBuffer };
}
