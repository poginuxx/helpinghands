import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(err, info) {
    console.error('[ErrorBoundary]', err, info);
  }

  handleReset() {
    this.setState({ hasError: false, message: '' });
    window.location.href = '/dashboard';
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-500 text-sm mb-6">{this.state.message}</p>
          <button
            onClick={() => this.handleReset()}
            className="px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm active:bg-teal-700 transition-colors min-h-[44px]"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
}
