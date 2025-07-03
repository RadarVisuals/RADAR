import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import AudioAnalyzer from './AudioAnalyzer'; // Adjust path as necessary

// --- Mocks ---
const mockGetByteFrequencyData = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockStop = vi.fn();
const mockResume = vi.fn();
const mockSuspend = vi.fn();
const mockClose = vi.fn();

const mockAnalyserNode = {
  connect: mockConnect,
  disconnect: mockDisconnect,
  getByteFrequencyData: mockGetByteFrequencyData,
  smoothingTimeConstant: 0.8,
  fftSize: 2048,
  minDecibels: -100,
  maxDecibels: -30,
  frequencyBinCount: 1024, 
};

const mockAudioSourceNode = {
  connect: mockConnect,
  disconnect: mockDisconnect,
};

const mockAudioContextInstance = {
  createAnalyser: vi.fn(() => mockAnalyserNode),
  createMediaStreamSource: vi.fn(() => mockAudioSourceNode),
  resume: mockResume,
  suspend: mockSuspend,
  close: mockClose,
  state: 'suspended', 
  sampleRate: 48000,
};

const mockMediaStream = {
  getTracks: vi.fn(() => [{ stop: mockStop, label: 'mockAudioTrack' }]),
};

vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContextInstance));
vi.stubGlobal('webkitAudioContext', vi.fn(() => mockAudioContextInstance));

vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: vi.fn(),
  },
});

let rafCallback = null;
vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
  rafCallback = cb;
  return Date.now(); 
}));
vi.stubGlobal('cancelAnimationFrame', vi.fn());

const mockSetAudioFrequencyFactor = vi.fn();
const mockTriggerBeatPulse = vi.fn();
const mockResetAudioModifications = vi.fn();

const mockManagerInstancesRef = {
  current: {
    '1': {
      setAudioFrequencyFactor: mockSetAudioFrequencyFactor,
      triggerBeatPulse: mockTriggerBeatPulse,
      resetAudioModifications: mockResetAudioModifications,
    },
    '2': {
      setAudioFrequencyFactor: mockSetAudioFrequencyFactor,
      triggerBeatPulse: mockTriggerBeatPulse,
      resetAudioModifications: mockResetAudioModifications,
    },
    '3': {
      setAudioFrequencyFactor: mockSetAudioFrequencyFactor,
      triggerBeatPulse: mockTriggerBeatPulse,
      resetAudioModifications: mockResetAudioModifications,
    },
  },
};

const advanceRAF = () => {
  if (rafCallback) {
    const currentCb = rafCallback;
    rafCallback = null;
    act(() => {
      currentCb(performance.now());
    });
  }
};

describe('AudioAnalyzer', () => {
  let onAudioDataMock;

  beforeEach(() => {
    vi.useFakeTimers();
    onAudioDataMock = vi.fn();
    mockAudioContextInstance.state = 'suspended'; 

    mockGetByteFrequencyData.mockClear();
    mockGetByteFrequencyData.mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = (i % 2 === 0) ? 128 : 64;
      }
    });
    mockConnect.mockClear();
    mockDisconnect.mockClear();
    mockStop.mockClear();

    mockResume.mockClear();
    mockResume.mockImplementation(async () => {
        mockAudioContextInstance.state = 'running';
    });

    mockSuspend.mockClear().mockResolvedValue(undefined);
    mockClose.mockClear().mockResolvedValue(undefined);

    mockAudioContextInstance.createAnalyser.mockClear();
    mockAudioContextInstance.createMediaStreamSource.mockClear();
    
    global.navigator.mediaDevices.getUserMedia.mockClear().mockResolvedValue(mockMediaStream);

    rafCallback = null;
    global.requestAnimationFrame.mockClear();
    global.cancelAnimationFrame.mockClear();

    mockSetAudioFrequencyFactor.mockClear();
    mockTriggerBeatPulse.mockClear();
    mockResetAudioModifications.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders null', () => {
    const { container } = render(
      <AudioAnalyzer managerInstancesRef={mockManagerInstancesRef} />
    );
    expect(container.firstChild).toBeNull();
  });

  describe('Activation and Deactivation', () => {
    it('requests microphone access and sets up audio when isActive becomes true', async () => {
      const { rerender } = render(
        <AudioAnalyzer
          isActive={false}
          managerInstancesRef={mockManagerInstancesRef}
          onAudioData={onAudioDataMock}
        />
      );
      expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
      rerender(
        <AudioAnalyzer
          isActive={true}
          managerInstancesRef={mockManagerInstancesRef}
          onAudioData={onAudioDataMock}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      expect(mockAudioContextInstance.createAnalyser).toHaveBeenCalled();
      expect(mockAudioContextInstance.createMediaStreamSource).toHaveBeenCalledWith(mockMediaStream);
      expect(mockAudioSourceNode.connect).toHaveBeenCalledWith(mockAnalyserNode);
      expect(mockResume).toHaveBeenCalled();
      expect(requestAnimationFrame).toHaveBeenCalled();
      advanceRAF();
      expect(mockGetByteFrequencyData).toHaveBeenCalled();
      expect(onAudioDataMock).toHaveBeenCalled();
    });

    it('cleans up audio when isActive becomes false', async () => {
      const { rerender } = render(
        <AudioAnalyzer
          isActive={true}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      await act(async () => {
        await Promise.resolve(); 
      });
      expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
      rerender(
        <AudioAnalyzer
          isActive={false}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(cancelAnimationFrame).toHaveBeenCalled();
      expect(mockStop).toHaveBeenCalled();
      expect(mockAudioSourceNode.disconnect).toHaveBeenCalled();
      expect(mockSuspend).toHaveBeenCalled();
      expect(mockResetAudioModifications).toHaveBeenCalledTimes(3);
    });

    it('cleans up fully on unmount', async () => {
      const { unmount } = render(
        <AudioAnalyzer
          isActive={true}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });
      unmount();
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(cancelAnimationFrame).toHaveBeenCalled();
      expect(mockStop).toHaveBeenCalled();
      expect(mockAudioSourceNode.disconnect).toHaveBeenCalled();
      expect(mockSuspend).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
      expect(mockResetAudioModifications).toHaveBeenCalledTimes(3);
    });

    it('handles getUserMedia failure gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
      render(
        <AudioAnalyzer
          isActive={true}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      expect(mockAudioContextInstance.createAnalyser).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[AudioAnalyzer requestMicrophoneAccess] Error accessing microphone:"),
        "Error",
        "Permission denied"
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Audio Processing and Callbacks', () => {
    it('calls onAudioData with processed data and applies to layers', async () => {
      const audioSettings = {
        smoothingFactor: 0.5,
        bassIntensity: 1.2,
        midIntensity: 1.0,
        trebleIntensity: 0.8,
      };
      render(
        <AudioAnalyzer
          isActive={true}
          onAudioData={onAudioDataMock}
          audioSettings={audioSettings}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockAnalyserNode.smoothingTimeConstant).toBe(0.5);
      advanceRAF();
      expect(mockGetByteFrequencyData).toHaveBeenCalled();
      expect(onAudioDataMock).toHaveBeenCalledTimes(1);
      const { level, frequencyBands, timestamp } = onAudioDataMock.mock.calls[0][0];
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
      expect(frequencyBands).toEqual(
        expect.objectContaining({
          bass: expect.closeTo(0.3780, 4), 
          mid: expect.any(Number),
          treble: expect.any(Number),
        })
      );
      expect(timestamp).toBeCloseTo(Date.now(), -2);
      expect(mockSetAudioFrequencyFactor).toHaveBeenCalledTimes(3);
      expect(mockSetAudioFrequencyFactor).toHaveBeenNthCalledWith(1, expect.closeTo(1.3629, 4));

      mockGetByteFrequencyData.mockImplementationOnce((array) => {
         for (let i = 0; i < array.length; i++) { array[i] = 200; }
      });
      advanceRAF();
      expect(mockTriggerBeatPulse).toHaveBeenCalled();
    });
  });

  describe('Prop Changes', () => {
    it('updates AnalyserNode smoothingTimeConstant when audioSettings prop changes', async () => {
      const initialAudioSettings = { smoothingFactor: 0.6 };
      const { rerender } = render(
        <AudioAnalyzer
          isActive={true}
          audioSettings={initialAudioSettings}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockAnalyserNode.smoothingTimeConstant).toBe(0.6);
      const newAudioSettings = { smoothingFactor: 0.3 };
      rerender(
        <AudioAnalyzer
          isActive={true}
          audioSettings={newAudioSettings}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      expect(mockAnalyserNode.smoothingTimeConstant).toBe(0.3);
    });

    // --- REMOVED: Test for transition logic on configLoadNonce change ---
  });
});