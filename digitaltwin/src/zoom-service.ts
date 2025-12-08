import * as dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ZoomService {
  private apiKey: string;
  private apiSecret: string;
  private sdkKey: string;
  private sdkSecret: string;

  constructor() {
    this.apiKey = process.env.ZOOM_API_KEY || '';
    this.apiSecret = process.env.ZOOM_API_SECRET || '';
    this.sdkKey = process.env.ZOOM_SDK_KEY || '';
    this.sdkSecret = process.env.ZOOM_SDK_SECRET || '';

    if (!this.sdkKey || !this.sdkSecret) {
      console.warn('ZOOM_SDK_KEY or ZOOM_SDK_SECRET not set. Zoom functionality will be limited.');
    }
  }

  /**
   * Generate a signature for Zoom SDK authentication
   * @param meetingNumber - The Zoom meeting number
   * @param role - 0 for participant, 1 for host
   * @returns JWT signature for Zoom SDK
   */
  generateSDKSignature(meetingNumber: string, role: number = 0): string {
    if (!this.sdkKey || !this.sdkSecret) {
      throw new Error('Zoom SDK credentials not configured');
    }

    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2; // 2 hours

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const payload = {
      iss: this.sdkKey,
      exp,
      iat,
      aud: 'zoom',
      appKey: this.sdkKey,
      tokenExp: exp,
      sdkKey: this.sdkKey,
      mn: meetingNumber,
      role,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signature = crypto
      .createHmac('sha256', this.sdkSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Generate a JWT token for Zoom API calls
   * @returns JWT token
   */
  generateAPIToken(): string {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Zoom API credentials not configured');
    }

    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60; // 1 hour

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const payload = {
      iss: this.apiKey,
      exp,
      iat,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Create a new Zoom meeting
   * @param topic - Meeting topic
   * @param startTime - Optional start time (ISO string)
   * @returns Meeting details
   */
  async createMeeting(topic: string, startTime?: string): Promise<any> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Zoom API credentials not configured');
    }

    const token = this.generateAPIToken();
    const userId = process.env.ZOOM_USER_ID || 'me';

    const meetingData: any = {
      topic,
      type: 2, // Scheduled meeting
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: false,
        waiting_room: false,
      },
    };

    if (startTime) {
      meetingData.start_time = startTime;
    }

    try {
      const response = await fetch(
        `https://api.zoom.us/v2/users/${userId}/meetings`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(meetingData),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Zoom API error: ${response.status} ${error}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error creating Zoom meeting:', error);
      throw error;
    }
  }
}

export const zoomService = new ZoomService();

