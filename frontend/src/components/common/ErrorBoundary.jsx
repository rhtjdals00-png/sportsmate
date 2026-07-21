import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '24px', textAlign: 'center', background: '#f8fafc', color: '#0f172a'
        }}>
          <AlertTriangle size={56} color="#ef4444" style={{ marginBottom: '20px' }} />
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px' }}>문제가 발생했습니다</h2>
          <p style={{ color: '#64748b', marginBottom: '28px', lineHeight: '1.6' }}>
            앱을 불러오는 중 예기치 않은 오류가 발생했습니다.<br />
            다시 시도하거나 홈으로 이동해주세요.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleReset}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px',
                background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px',
                fontWeight: 'bold', fontSize: '15px', cursor: 'pointer'
              }}
            >
              <RefreshCw size={18} />
              다시 시도
            </button>
            <button
              onClick={this.handleGoHome}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px',
                background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px',
                fontWeight: 'bold', fontSize: '15px', cursor: 'pointer'
              }}
            >
              <Home size={18} />
              홈으로 가기
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
