/// <reference types="jasmine" />
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CoachService } from './coach.service';
import { CoachVoiceService } from './coach-voice.service';
import { PcmVadStreamService } from './pcm-vad-stream.service';

describe('CoachVoiceService (Continuous Hands-Free & Push-to-Talk)', () => {
  let service: CoachVoiceService;
  let vadSpy: jasmine.SpyObj<PcmVadStreamService>;
  let coachSpy: jasmine.SpyObj<CoachService>;

  beforeEach(() => {
    vadSpy = jasmine.createSpyObj<PcmVadStreamService>(
      'PcmVadStreamService',
      [
        'start',
        'stop',
        'setAiSpeaking',
        'setPlaybackLock',
        'extendSilenceWindow',
        'toggleMute',
        'setPaused',
        'isSpeechActive',
      ],
      {
        micLevel: (() => 0) as unknown as PcmVadStreamService['micLevel'],
        isMuted: (() => false) as unknown as PcmVadStreamService['isMuted'],
        isPaused: (() => false) as unknown as PcmVadStreamService['isPaused'],
      }
    );
    vadSpy.start.and.resolveTo();
    vadSpy.toggleMute.and.returnValue(true);
    vadSpy.isSpeechActive.and.returnValue(false);

    coachSpy = jasmine.createSpyObj<CoachService>('CoachService', ['getWsTicket']);
    coachSpy.getWsTicket.and.returnValue(of({ ticket: 'ticket-123', expiresIn: 30 }));

    TestBed.configureTestingModule({
      providers: [
        CoachVoiceService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PcmVadStreamService, useValue: vadSpy },
        { provide: CoachService, useValue: coachSpy },
      ],
    });
    service = TestBed.inject(CoachVoiceService);
  });

  afterEach(() => {
    service.cleanup();
  });

  it('defaults to ready state without any dev mock mode flag', () => {
    expect(service.uxState()).toBe('ready');
    expect((service as unknown as Record<string, unknown>)['isMockMode']).toBeUndefined();
  });

  it('forwards continuous mute and pause controls directly to PcmVadStreamService', () => {
    expect(service.toggleMute()).toBeTrue();
    expect(vadSpy.toggleMute).toHaveBeenCalled();

    service.togglePause();
    expect(vadSpy.setPaused).toHaveBeenCalledWith(true);
  });

  it('auto-speaks opening AI transcript.final and formats ai.message timestamps accurately', () => {
    const internal = service as unknown as {
      activeSessionId: string | null;
      handleControlMessage: (msg: Record<string, unknown>) => void;
      speakAiResponse: (text: string, segId?: string, audioB64?: string) => Promise<void>;
    };
    internal.activeSessionId = 'sess-1';
    const speakSpy = spyOn(internal, 'speakAiResponse').and.resolveTo();

    internal.handleControlMessage({
      type: 'session.state',
      interactionMode: 'continuous',
    });
    expect(speakSpy).not.toHaveBeenCalled();

    internal.handleControlMessage({
      type: 'transcript.final',
      speaker: 'AI',
      segmentId: 'ai-open',
      text: 'Hello! I am Alex.',
      seq: 1,
      startMs: 0,
      endMs: 2500,
      audioB64: 'SUQz',
    });
    expect(speakSpy).toHaveBeenCalledWith('Hello! I am Alex.', 'ai-open', 'SUQz');

    internal.handleControlMessage({
      type: 'ai.message',
      segmentId: 'ai-turn-2',
      text: 'Nice to meet you!',
      seq: 3,
      startMs: 15000,
      endMs: 17000,
      audioB64: 'SUQzMg==',
    });
    const items = service.liveTranscripts();
    expect(items.length).toBe(2);
    expect(items[1].time).toBe('00:15');
    expect(speakSpy).toHaveBeenCalledWith('Nice to meet you!', 'ai-turn-2', 'SUQzMg==');
  });

  it('updates live user partial transcripts and ignores stale partials after final', () => {
    const internal = service as unknown as {
      handleControlMessage: (msg: Record<string, unknown>) => void;
    };
    internal.handleControlMessage({
      type: 'transcript.partial',
      speaker: 'USER',
      segmentId: 'u-1',
      text: 'Hello Alex',
      startMs: 3000,
    });
    expect(service.liveTranscripts().length).toBe(1);
    expect(service.liveTranscripts()[0].isPartial).toBeTrue();
    expect(service.liveTranscripts()[0].time).toBe('00:03');

    internal.handleControlMessage({
      type: 'transcript.final',
      speaker: 'USER',
      segmentId: 'u-1',
      text: 'Hello Alex, how are you?',
      seq: 2,
      startMs: 3000,
      endMs: 5000,
    });
    expect(service.liveTranscripts()[0].isPartial).toBeFalse();

    internal.handleControlMessage({
      type: 'transcript.partial',
      speaker: 'USER',
      segmentId: 'u-1',
      text: 'Hello Alex old snapshot',
      startMs: 3000,
    });
    expect(service.liveTranscripts()[0].text).toBe('Hello Alex, how are you?');
    expect(service.liveTranscripts()[0].isPartial).toBeFalse();
  });
});
