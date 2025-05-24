import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioControlPanel from './AudioControlPanel';

vi.mock('../Panels/Panel', () => ({
  __esModule: true,
  default: ({ title, onClose, className, children }) => (
    <div data-testid="mock-panel" className={className}>
      <h2 data-testid="panel-title">{title}</h2>
      <button data-testid="panel-close-button" onClick={onClose}>Close Panel</button>
      {children}
    </div>
  ),
}));

const mockEnumerateDevices = vi.fn();
vi.stubGlobal('navigator', {
  mediaDevices: {
    enumerateDevices: mockEnumerateDevices,
  },
});

describe('AudioControlPanel', () => {
  let mockOnClose;
  let mockSetIsAudioActive;
  let mockSetAudioSettings;
  let baseProps; // Renamed from defaultProps to avoid confusion with component's defaultProps

  const mockAudioDevicesList = [ // Renamed for clarity
    { deviceId: 'dev1', label: 'Microphone 1', kind: 'audioinput' },
    { deviceId: 'dev2', label: 'Microphone 2', kind: 'audioinput' },
    { deviceId: 'dev3', label: 'Webcam Mic', kind: 'audioinput' },
    { deviceId: 'video1', label: 'Webcam Video', kind: 'videoinput' },
  ];

  beforeEach(() => {
    mockOnClose = vi.fn();
    mockSetIsAudioActive = vi.fn();
    mockSetAudioSettings = vi.fn();
    mockEnumerateDevices.mockClear();

    baseProps = {
      onClose: mockOnClose,
      isAudioActive: false,
      setIsAudioActive: mockSetIsAudioActive,
      // For tests checking defaults, audioSettings & analyzerData will be omitted
      // For other tests, they will be spread in or overridden
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const getFullProps = (overrides = {}) => ({
    ...baseProps,
    audioSettings: {
      bassIntensity: 1.0,
      midIntensity: 1.2,
      trebleIntensity: 0.8,
      smoothingFactor: 0.6,
      ...(overrides.audioSettings || {}),
    },
    setAudioSettings: mockSetAudioSettings,
    analyzerData: {
      level: 0,
      frequencyBands: { bass: 0, mid: 0, treble: 0 },
      ...(overrides.analyzerData || {}),
    },
    ...overrides, // General overrides for isAudioActive, etc.
  });


  test('renders correctly when audio is inactive', () => {
    render(<AudioControlPanel {...getFullProps({ isAudioActive: false })} />);
    // ... assertions remain the same
    expect(screen.getByTestId('panel-title')).toHaveTextContent('AUDIO VISUALIZER');
    expect(screen.getByRole('heading', { name: /Audio Responsive Layers/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Toggle Audio Reactivity/i })).not.toBeChecked();
    expect(screen.getByText('OFF')).toBeInTheDocument();
    expect(screen.getByText(/Enable "Audio Responsive Layers" to make your visual configuration respond/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Detected Audio Inputs:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Listening to Audio/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: /Audio Reactivity Settings/i})).not.toBeInTheDocument();
  });

  test('calls onClose when panel close button is clicked', () => {
    render(<AudioControlPanel {...getFullProps()} />);
    fireEvent.click(screen.getByTestId('panel-close-button'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('toggles audio active state when switch is clicked', () => {
    render(<AudioControlPanel {...getFullProps()} />);
    const toggle = screen.getByRole('checkbox', { name: /Toggle Audio Reactivity/i });
    fireEvent.click(toggle);
    expect(mockSetIsAudioActive).toHaveBeenCalledTimes(1);
  });

  describe('when audio is active', () => {
    beforeEach(() => {
      mockEnumerateDevices.mockResolvedValue(mockAudioDevicesList);
    });

    test('renders correctly and fetches devices', async () => {
      render(<AudioControlPanel {...getFullProps({ isAudioActive: true })} />);
      expect(screen.getByRole('checkbox', { name: /Toggle Audio Reactivity/i })).toBeChecked();
      expect(screen.getByText('ON')).toBeInTheDocument();
      expect(screen.getByLabelText(/Detected Audio Inputs:/i)).toBeInTheDocument();
      expect(screen.getByText(/Listening to Audio/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: /Audio Reactivity Settings/i})).toBeInTheDocument();
      expect(screen.queryByText(/Enable "Audio Responsive Layers" to make your visual configuration respond/i)).not.toBeInTheDocument();
      expect(mockEnumerateDevices).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole('option', { name: /Microphone 1/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Microphone 2/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Webcam Mic/i })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Webcam Video/i })).not.toBeInTheDocument();
    });

    test('handles error during device enumeration', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockEnumerateDevices.mockRejectedValueOnce(new Error('Device enumeration failed'));
      render(<AudioControlPanel {...getFullProps({ isAudioActive: true })} />);
      await waitFor(() => expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[AudioControlPanel] Error enumerating audio devices:"),
        expect.any(Error)
      ));
      expect(screen.getByLabelText(/Detected Audio Inputs:/i).querySelectorAll('option').length).toBe(1);
      consoleWarnSpy.mockRestore();
    });

    test('clears devices when audio is toggled off', async () => {
        const { rerender } = render(<AudioControlPanel {...getFullProps({ isAudioActive: true })} />);
        expect(await screen.findByRole('option', { name: /Microphone 1/i })).toBeInTheDocument();
        rerender(<AudioControlPanel {...getFullProps({ isAudioActive: false })} />);
        expect(screen.queryByLabelText(/Detected Audio Inputs:/i)).not.toBeInTheDocument();
    });

    test('displays audio meters based on analyzerData', () => {
      const testAnalyzerData = {
        level: 0.5,
        frequencyBands: { bass: 0.8, mid: 0.4, treble: 0.3 },
      };
      render(<AudioControlPanel {...getFullProps({ isAudioActive: true, analyzerData: testAnalyzerData })} />);
      const levelMeter = screen.getAllByRole('meter').find(m => m.classList.contains('level'));
      const bassMeter = screen.getAllByRole('meter').find(m => m.classList.contains('bass'));
      const midMeter = screen.getAllByRole('meter').find(m => m.classList.contains('mid'));
      const trebleMeter = screen.getAllByRole('meter').find(m => m.classList.contains('treble'));
      expect(levelMeter).toHaveStyle('width: 90%');
      expect(bassMeter).toHaveStyle('width: 80%');
      expect(midMeter).toHaveStyle('width: 40%');
      expect(trebleMeter).toHaveStyle('width: 75%');
    });

    test('updates settings when sliders are changed', async () => {
      const initialSettings = {
        bassIntensity: 1.0, midIntensity: 1.2, trebleIntensity: 0.8, smoothingFactor: 0.6,
      };
      render(<AudioControlPanel {...getFullProps({ isAudioActive: true, audioSettings: initialSettings })} />);
      const bassSlider = screen.getByRole('slider', { name: /Bass impact intensity/i });
      const smoothingSlider = screen.getByRole('slider', { name: /Audio response smoothing factor/i });
      fireEvent.change(bassSlider, { target: { value: '2.5' } });
      expect(mockSetAudioSettings).toHaveBeenCalledWith(expect.any(Function));
      let lastCallUpdater = mockSetAudioSettings.mock.calls.pop()[0];
      expect(lastCallUpdater(initialSettings)).toEqual({ ...initialSettings, bassIntensity: 2.5 });

      fireEvent.change(smoothingSlider, { target: { value: '0.25' } });
      expect(mockSetAudioSettings).toHaveBeenCalledWith(expect.any(Function));
      lastCallUpdater = mockSetAudioSettings.mock.calls.pop()[0];
      expect(lastCallUpdater(initialSettings)).toEqual({ ...initialSettings, smoothingFactor: 0.25 });
    });
    
    test('calls setIsAudioActive(false) when "Stop Listening" button is clicked', () => {
        render(<AudioControlPanel {...getFullProps({ isAudioActive: true })} />);
        const stopButton = screen.getByRole('button', { name: /Stop listening to audio/i });
        fireEvent.click(stopButton);
        expect(mockSetIsAudioActive).toHaveBeenCalledWith(false);
    });
  });

  test('uses default smoothingFactor if not in audioSettings provided as prop', () => {
    // Simulating audioSettings prop being passed but without smoothingFactor
    const partialAudioSettings = { bassIntensity: 1.5 };
    render(<AudioControlPanel {...getFullProps({ isAudioActive: true, audioSettings: partialAudioSettings })} />);
    const smoothingSlider = screen.getByRole('slider', { name: /Audio response smoothing factor/i });
    // The component's default for smoothingFactor (0.6) should merge with provided partialAudioSettings
    expect(smoothingSlider.value).toBe("0.6"); 
    expect(screen.getByText("0.60")).toBeInTheDocument();
  });

  test('handles missing audioSettings and analyzerData gracefully with JS defaults', () => {
    // Here, audioSettings and analyzerData props are NOT passed to AudioControlPanel
    // So, it should use its internal JS default parameters
    render(
      <AudioControlPanel
        onClose={mockOnClose}
        isAudioActive={true} // Activate to show settings and meters
        setIsAudioActive={mockSetIsAudioActive}
        // audioSettings prop is omitted
        // setAudioSettings prop is omitted (will use default function from component)
        // analyzerData prop is omitted
      />
    );
    const bassSlider = screen.getByRole('slider', { name: /Bass impact intensity/i });
    expect(bassSlider.value).toBe("1"); // Corrected: 1.0 becomes "1"

    const levelMeter = screen.getAllByRole('meter').find(m => m.classList.contains('level'));
    expect(levelMeter).toHaveStyle('width: 0%');
  });
});