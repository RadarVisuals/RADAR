import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AudioStatusIcon from './AudioStatusIcon'; // Adjust path if necessary

describe('AudioStatusIcon', () => {
  it('should not render when isActive is false (default behavior)', () => {
    // Arrange: Render with default isActive (which is false)
    render(<AudioStatusIcon />);

    // Act & Assert
    // queryBy* returns null if not found, good for asserting absence
    const button = screen.queryByRole('button', { name: /Audio Visualizer Active/i });
    expect(button).not.toBeInTheDocument();
  });

  it('should not render when isActive is explicitly false', () => {
    // Arrange: Render with isActive explicitly false
    render(<AudioStatusIcon isActive={false} />);

    // Act & Assert
    const button = screen.queryByRole('button', { name: /Audio Visualizer Active/i });
    expect(button).not.toBeInTheDocument();
  });

  it('should render when isActive is true', () => {
    // Arrange: Render with isActive true
    render(<AudioStatusIcon isActive={true} />);

    // Act & Assert
    // getBy* throws an error if not found, good for asserting presence
    const button = screen.getByRole('button', { name: /Audio Visualizer Active/i });
    expect(button).toBeInTheDocument();
  });

  it('should have the "active" class when isActive is true', () => {
    // Arrange
    render(<AudioStatusIcon isActive={true} />);
    const button = screen.getByRole('button', { name: /Audio Visualizer Active/i });

    // Assert
    expect(button).toHaveClass('active');
  });

  it('should call onClick prop when clicked if isActive is true', () => {
    // Arrange
    const handleClickMock = vi.fn(); // Vitest's mock function
    render(<AudioStatusIcon isActive={true} onClick={handleClickMock} />);
    const button = screen.getByRole('button', { name: /Audio Visualizer Active/i });

    // Act
    fireEvent.click(button);

    // Assert
    expect(handleClickMock).toHaveBeenCalledTimes(1);
  });

  it('should have correct ARIA label and title when rendered', () => {
    // Arrange
    render(<AudioStatusIcon isActive={true} />);
    const button = screen.getByRole('button', { name: /Audio Visualizer Active/i });

    // Assert
    expect(button).toHaveAttribute('aria-label', 'Audio Visualizer Active');
    expect(button).toHaveAttribute('title', 'Audio Visualizer is Active - Click to open settings');
  });

  it('should render the inner wave elements when active', () => {
    // Arrange
    render(<AudioStatusIcon isActive={true} />);
    const button = screen.getByRole('button', { name: /Audio Visualizer Active/i });

    // Act
    const waveContainer = button.querySelector('.wave-container');
    const waves = button.querySelectorAll('.audio-wave');

    // Assert
    expect(waveContainer).toBeInTheDocument();
    expect(waves.length).toBe(3); // Assuming 3 wave spans as per your CSS
  });

  it('should use default onClick prop (no-op) if none is provided and not throw error', () => {
    // Arrange
    render(<AudioStatusIcon isActive={true} />); // No onClick prop passed
    const button = screen.getByRole('button', { name: /Audio Visualizer Active/i });

    // Act & Assert
    // We expect no error to be thrown when clicking
    expect(() => fireEvent.click(button)).not.toThrow();
  });
});