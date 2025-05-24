import React from 'react';
import PropTypes from 'prop-types';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../../context/ToastContext'; // Adjust path if necessary
import ToastContainer from './ToastContainer';
// Toast component is implicitly tested as it's rendered by ToastContainer

// Helper component to add toasts for testing purposes
const ToastTrigger = ({ id, content, type, duration }) => {
  const { addToast } = useToast();

  // Use a button to trigger adding a toast so we can control when it happens in tests
  return (
    <button
      data-testid={`add-toast-${id}`}
      onClick={() => addToast(content, type, duration)}
    >
      Add Toast {id}
    </button>
  );
};

// PropTypes for the helper component
ToastTrigger.propTypes = {
  id: PropTypes.string.isRequired,
  content: PropTypes.node.isRequired,
  type: PropTypes.string,
  duration: PropTypes.number,
};


describe('ToastContainer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render nothing if there are no toasts', () => {
    render(
      <ToastProvider>
        <ToastContainer />
      </ToastProvider>
    );
    // The container itself should not be in the document if no toasts
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('alert').length).toBe(0); // No individual toast alerts
  });

  it('should render a single toast when one is added', () => {
    render(
      <ToastProvider>
        <ToastTrigger id="t1" content="Single Toast Message" />
        <ToastContainer />
      </ToastProvider>
    );

    // Click the button to add the toast
    const addButton = screen.getByTestId('add-toast-t1');
    fireEvent.click(addButton);

    // Advance timers for the Toast component's internal fadeIn
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(screen.getByText('Single Toast Message')).toBeInTheDocument();
    expect(screen.getAllByRole('alert').length).toBe(1);
    expect(screen.getByRole('alert')).toHaveClass('toast-info'); // Default type
  });

  it('should render multiple toasts when multiple are added', () => {
    render(
      <ToastProvider>
        <ToastTrigger id="t1" content="First Toast" type="success" />
        <ToastTrigger id="t2" content="Second Toast" type="error" />
        <ToastContainer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('add-toast-t1'));
    fireEvent.click(screen.getByTestId('add-toast-t2'));

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(screen.getByText('First Toast')).toBeInTheDocument();
    expect(screen.getByText('Second Toast')).toBeInTheDocument();
    expect(screen.getAllByRole('alert').length).toBe(2);

    const firstToastElement = screen.getByText('First Toast').closest('.toast');
    const secondToastElement = screen.getByText('Second Toast').closest('.toast');

    expect(firstToastElement).toHaveClass('toast-success');
    expect(secondToastElement).toHaveClass('toast-error');
  });

  it('should remove a toast when its dismiss button is clicked', () => {
    render(
      <ToastProvider>
        <ToastTrigger id="t1" content="Toast to dismiss" />
        <ToastContainer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('add-toast-t1'));
    act(() => { vi.advanceTimersByTime(50); }); // For fade-in

    let toastElement = screen.getByText('Toast to dismiss');
    expect(toastElement).toBeInTheDocument();

    const dismissButton = screen.getByRole('button', { name: /Dismiss notification/i });
    fireEvent.click(dismissButton);

    // Advance timers for the Toast component's internal onDismiss setTimeout
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Toast to dismiss')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('alert').length).toBe(0);
  });

  it('should remove a toast automatically after its duration', () => {
    const shortDuration = 500;
    render(
      <ToastProvider>
        <ToastTrigger id="t1" content="Auto-dismissing toast" duration={shortDuration} />
        <ToastContainer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('add-toast-t1'));
    act(() => { vi.advanceTimersByTime(50); }); // For fade-in

    expect(screen.getByText('Auto-dismissing toast')).toBeInTheDocument();

    // Advance timers past the toast's duration
    act(() => {
      vi.advanceTimersByTime(shortDuration + 100); // Add a small buffer
    });

    expect(screen.queryByText('Auto-dismissing toast')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('alert').length).toBe(0);
  });

  it('should render toasts in the order they are added (newest on top/bottom depending on CSS)', () => {
    // This test assumes newest toasts appear first in the DOM if prepended,
    // or last if appended. Your CSS determines visual order (top/bottom).
    // We'll check the order in the DOM.
    render(
      <ToastProvider>
        <ToastTrigger id="t1" content="Oldest Toast" />
        <ToastTrigger id="t2" content="Middle Toast" />
        <ToastTrigger id="t3" content="Newest Toast" />
        <ToastContainer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('add-toast-t1'));
    fireEvent.click(screen.getByTestId('add-toast-t2'));
    fireEvent.click(screen.getByTestId('add-toast-t3'));

    act(() => { vi.advanceTimersByTime(50); });

    const allToasts = screen.getAllByRole('alert');
    expect(allToasts.length).toBe(3);

    // Your ToastProvider appends new toasts, so "Oldest Toast" is first in the DOM list.
    expect(allToasts[0]).toHaveTextContent('Oldest Toast');
    expect(allToasts[1]).toHaveTextContent('Middle Toast');
    expect(allToasts[2]).toHaveTextContent('Newest Toast');
  });
});