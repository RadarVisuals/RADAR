import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Toast from './Toast'; // Adjust path if necessary

describe('Toast Component', () => {
  // Setup fake timers before each test to control setTimeout
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // Restore real timers after each test
  afterEach(() => {
    vi.restoreAllMocks(); // This also clears all timers
  });

  it('should render the toast content correctly', () => {
    const testContent = "This is a test toast message.";
    render(<Toast id="toast1" content={testContent} onDismiss={() => {}} />);
    expect(screen.getByText(testContent)).toBeInTheDocument();
  });

  it('should apply the default "info" class if no type is provided', () => {
    render(<Toast id="toast2" content="Info toast" onDismiss={() => {}} />);
    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveClass('toast-info');
  });

  it('should apply the correct class based on the "type" prop (e.g., "error")', () => {
    render(<Toast id="toast3" content="Error toast" type="error" onDismiss={() => {}} />);
    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveClass('toast-error');
  });

  it('should apply the "success" class for type "success"', () => {
    render(<Toast id="toast-success" content="Success!" type="success" onDismiss={() => {}} />);
    expect(screen.getByRole('alert')).toHaveClass('toast-success');
  });

  it('should apply the "warning" class for type "warning"', () => {
    render(<Toast id="toast-warning" content="Warning!" type="warning" onDismiss={() => {}} />);
    expect(screen.getByRole('alert')).toHaveClass('toast-warning');
  });

  it('should call onDismiss with the correct id when the dismiss button is clicked', () => {
    const mockOnDismiss = vi.fn();
    const toastId = "toast4";
    render(<Toast id={toastId} content="Dismiss me" onDismiss={mockOnDismiss} />);

    const dismissButton = screen.getByRole('button', { name: /Dismiss notification/i });
    fireEvent.click(dismissButton);

    // The Toast component has a 300ms setTimeout before calling onDismiss
    // We need to advance the timers for that setTimeout to execute
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    expect(mockOnDismiss).toHaveBeenCalledWith(toastId);
  });

  it('should call onDismiss after the specified duration if duration is positive', () => {
    const mockOnDismiss = vi.fn();
    const toastId = "toast5";
    const duration = 1500; // 1.5 seconds
    render(<Toast id={toastId} content="Auto dismiss" duration={duration} onDismiss={mockOnDismiss} />);

    // Check it hasn't been called immediately
    expect(mockOnDismiss).not.toHaveBeenCalled();

    // Advance timers by the full duration
    act(() => {
      vi.advanceTimersByTime(duration);
    });

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    expect(mockOnDismiss).toHaveBeenCalledWith(toastId);
  });

  it('should NOT call onDismiss automatically if duration is null', () => {
    const mockOnDismiss = vi.fn();
    render(<Toast id="toast6" content="Manual dismiss (duration null)" duration={null} onDismiss={mockOnDismiss} />);

    // Advance timers by a long time, it shouldn't be called
    act(() => {
      vi.advanceTimersByTime(10000); // 10 seconds
    });

    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('should NOT call onDismiss automatically if duration is 0', () => {
    const mockOnDismiss = vi.fn();
    render(<Toast id="toast7" content="Manual dismiss (duration 0)" duration={0} onDismiss={mockOnDismiss} />);

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('should apply "visible" class after a short delay for fade-in animation', () => {
    render(<Toast id="toast8" content="Fade in test" onDismiss={() => {}} />);
    const toastElement = screen.getByRole('alert');

    // Initially, it might not have 'visible' immediately due to the 10ms setTimeout in Toast.jsx
    // Depending on how fast the test runs, it might already be visible.
    // A more robust check is to advance time slightly.
    expect(toastElement).not.toHaveClass('visible'); // Or check opacity if styles are set up for it

    act(() => {
      vi.advanceTimersByTime(20); // Advance past the 10ms fadeInTimer
    });

    expect(toastElement).toHaveClass('visible');
  });

  it('should remove "visible" class when dismiss button is clicked (for fade-out animation)', () => {
    render(<Toast id="toast9" content="Fade out test" onDismiss={() => {}} />);
    const toastElement = screen.getByRole('alert');

    // Make it visible first
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(toastElement).toHaveClass('visible');

    // Click dismiss
    const dismissButton = screen.getByRole('button', { name: /Dismiss notification/i });
    fireEvent.click(dismissButton);

    // The 'visible' class should be removed immediately to start the fade-out CSS transition
    expect(toastElement).not.toHaveClass('visible');
    expect(toastElement).toHaveClass('hidden'); // Assuming 'hidden' is the opposite of 'visible'
  });

  it('should remove "visible" class when auto-dismissing (for fade-out animation)', () => {
    const duration = 500;
    render(<Toast id="toast10" content="Auto fade out" duration={duration} onDismiss={() => {}} />);
    const toastElement = screen.getByRole('alert');

    // Make it visible
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(toastElement).toHaveClass('visible');

    // Advance time to just before full duration (when fade-out starts)
    // fadeOutStartTime = Math.max(0, duration - 300); -> 500 - 300 = 200ms
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(toastElement).not.toHaveClass('visible');
    expect(toastElement).toHaveClass('hidden');
  });
});