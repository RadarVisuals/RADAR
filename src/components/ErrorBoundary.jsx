// src/components/ErrorBoundary.jsx
import React from "react";
import PropTypes from "prop-types";

/**
 * ErrorBoundary: A React component that catches JavaScript errors anywhere
 * in its child component tree, logs those errors, and displays a fallback UI
 * instead of the crashed component tree.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to the console (or send to an error reporting service)
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // Render a user-friendly fallback UI
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            width: "100vw",
            padding: "20px",
            boxSizing: "border-box",
            backgroundColor: "#1a1a2e", // Match background
            color: "#ff5555", // Error color
            fontFamily: "Arial, sans-serif",
            textAlign: "center",
            border: "2px solid #ff5555",
          }}
        >
          <h1 style={{ color: "#ff5555", marginBottom: "15px" }}>
            Application Error
          </h1>
          <p style={{ color: "rgba(255,255,255,0.8)", marginBottom: "20px" }}>
            Sorry, something went wrong while rendering the application. Please
            try refreshing the page.
          </p>
          {/* Optionally show error details in development environments */}
          {import.meta.env.DEV && this.state.error && (
            <details
              style={{
                marginTop: "20px",
                padding: "15px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "5px",
                border: "1px solid #555",
                color: "rgba(255,255,255,0.7)",
                maxWidth: "80%",
                overflow: "auto",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: "bold",
                  color: "#ffa500",
                }}
              >
                Error Details (Development Mode)
              </summary>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  marginTop: "10px",
                  textAlign: "left",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                }}
              >
                {this.state.error.toString()}
                {this.state.errorInfo &&
                  this.state.errorInfo.componentStack &&
                  `\n\nComponent Stack:\n${this.state.errorInfo.componentStack}`}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;