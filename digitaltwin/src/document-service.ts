import { promises as fs } from 'fs';
import mammoth from 'mammoth';
import { storage } from './storage.js';
import type { InsertDigitalTwin } from './schema.js';

export class DocumentService {
  async processWordDocument(file: Express.Multer.File): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      console.log('Processing document:', file.originalname);
      console.log('Extracted content preview:', result.value.substring(0, 200));
      return result.value;
    } catch (error) {
      console.error('Error processing Word document:', error);
      throw new Error('Failed to process Word document');
    }
  }

  async createDigitalTwin(content: string, name: string): Promise<void> {
    console.log(`Creating digital twin for ${name}`);
    const { description, fullContent } = this.extractContent(content);
    console.log('Extracted description:', description);

    const capabilities = this.extractCapabilities(content);
    console.log('Extracted capabilities:', capabilities);

    // Configure voice settings based on persona
    const voiceSettings = this.getVoiceSettingsForPersona(name);

    const twin: InsertDigitalTwin = {
      name,
      description,
      type: "Historical Figure",
      status: "active",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      capabilities,
      configuration: {
        personality: this.determinePersonality(content),
        ...voiceSettings
      }
    };

    await storage.createDigitalTwin(twin);
    console.log(`Digital twin created successfully for ${name}`);
  }

  private determinePersonality(content: string): string {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('innovative') || lowerContent.includes('creative')) {
      return 'innovative';
    } else if (lowerContent.includes('analytical') || lowerContent.includes('logical')) {
      return 'analytical';
    } else if (lowerContent.includes('visionary') || lowerContent.includes('leader')) {
      return 'visionary';
    }
    return 'balanced';
  }

  private getVoiceSettingsForPersona(name: string) {
    const lowerName = name.toLowerCase();
    const settings = {
      voice_id: "21m00Tcm4TlvDq8ikWAM",
      voice_settings: {
        stability: 0.75,
        similarityBoost: 0.75,
        style: 0.5,
        speakerBoost: true
      }
    };

    // Customize voice settings based on persona
    if (lowerName.includes('leonardo')) {
      settings.voice_id = "ThT5KcBeYPX3keUQqHPh"; // Deep, thoughtful voice
      settings.voice_settings.stability = 0.8;
      settings.voice_settings.similarityBoost = 0.7;
      settings.voice_settings.style = 0.4;
    } else if (lowerName.includes('jobs')) {
      settings.voice_id = "AZnzlk1XvdvUeBnXmlld"; // Dynamic, passionate voice
      settings.voice_settings.stability = 0.6;
      settings.voice_settings.similarityBoost = 0.8;
      settings.voice_settings.style = 0.6;
    } else if (lowerName.includes('einstein')) {
      settings.voice_id = "VR6AewLTigWG4xSOukaG"; // Wise, measured voice
      settings.voice_settings.stability = 0.85;
      settings.voice_settings.similarityBoost = 0.7;
      settings.voice_settings.style = 0.3;
    }

    return settings;
  }

  private extractContent(content: string): { description: string; fullContent: string } {
    // Split content into Q&A pairs
    const qaPattern = /Q\d+:\s*([\s\S]*?)\s*(?:A\d+:\s*([\s\S]*?))?\s*(?=Q\d+:|$)/g;
    const matches = Array.from(content.matchAll(qaPattern));

    let description = '';
    let fullContent = '';

    if (matches && matches.length > 0) {
      // Use the first Q&A pair for the description
      const firstQA = matches[0];
      if (firstQA[1] && firstQA[2]) {
        description = `${firstQA[1].trim()}\n${firstQA[2].trim()}`;
      }

      // Combine all Q&A pairs for the full content
      fullContent = matches.map(match => {
        const question = match[1]?.trim() || '';
        const answer = match[2]?.trim() || '';
        return `Q: ${question}\nA: ${answer}`;
      }).join('\n\n');
    }

    // Fallback to first substantial paragraph if no Q&A format
    if (!description) {
      const paragraphs = content.split(/\n\n+/);
      description = paragraphs.find(p => p.trim().length > 100) || paragraphs[0];
      fullContent = content;
    }

    return {
      description: description.replace(/\s+/g, ' ').trim().substring(0, 500), // Limit description length
      fullContent: fullContent.trim()
    };
  }

  private extractCapabilities(content: string): string[] {
    const capabilities = new Set<string>();

    // Enhanced persona-specific capability mappings
    const personaCapabilities: Record<string, string[]> = {
      "walt disney": ["Creativity", "Innovation", "Storytelling", "Leadership", "Entertainment"],
      "leonardo da vinci": ["Innovation", "Art", "Engineering", "Research", "Design", "Design Thinking"],
      "steve jobs": ["Innovation", "Product Development", "Design", "Leadership", "Strategic Thinking"],
      "emad mostaque": ["Artificial Intelligence", "Technical Vision", "Leadership", "Innovation", "Strategic Thinking"],
      "einstein": ["Innovation", "Research", "Problem Solving", "Technical Vision", "Physics"],
      "elon musk": ["Innovation", "Strategic Thinking", "Product Development", "Technical Vision", "Entrepreneurship"],
      "fei-fei li": ["Artificial Intelligence", "Research", "Technical Vision", "Innovation", "Computer Vision"],
      "tim brown": ["Design Thinking", "Creativity", "Innovation", "Design", "User-Centered Design", "Prototyping"],
      "ideo": ["Design Thinking", "Innovation", "Creativity", "User-Centered Design", "Prototyping"]
    };

    // Add capabilities based on persona name and content
    const lowerContent = content.toLowerCase();
    Object.entries(personaCapabilities).forEach(([persona, caps]) => {
      if (lowerContent.includes(persona)) {
        caps.forEach(cap => capabilities.add(cap));
      }
    });

    // Enhanced keyword-based capability detection
    const keywordCapabilities: Record<string, string[]> = {
      "research": ["Research", "Innovation"],
      "leadership": ["Leadership", "Strategic Thinking"],
      "innovation": ["Innovation", "Problem Solving", "Design Thinking"],
      "technology": ["Technical Vision", "Innovation"],
      "artificial intelligence": ["Artificial Intelligence", "Technical Vision"],
      "ai": ["Artificial Intelligence", "Technical Vision"],
      "design": ["Design", "Innovation", "Design Thinking", "Creativity"],
      "creativity": ["Creativity", "Innovation", "Design Thinking"],
      "engineering": ["Engineering", "Technical Vision", "Innovation"],
      "product": ["Product Development", "Innovation", "Design Thinking"],
      "entrepreneur": ["Entrepreneurship", "Strategic Thinking", "Innovation"],
      "vision": ["Technical Vision", "Strategic Thinking", "Creativity"],
      "art": ["Art", "Creativity", "Innovation", "Design Thinking"],
      "science": ["Research", "Technical Vision", "Innovation"],
      "brainstorming": ["Creativity", "Innovation", "Design Thinking"],
      "prototype": ["Design Thinking", "Innovation", "Product Development"],
      "user experience": ["Design", "Design Thinking", "Innovation"],
      "user centered": ["Design Thinking", "Innovation", "Design"],
      "iteration": ["Design Thinking", "Innovation", "Product Development"],
      "ideation": ["Creativity", "Innovation", "Design Thinking"]
    };

    Object.entries(keywordCapabilities).forEach(([keyword, caps]) => {
      if (lowerContent.includes(keyword)) {
        caps.forEach(cap => capabilities.add(cap));
      }
    });

    return Array.from(capabilities);
  }
}

export const documentService = new DocumentService();
