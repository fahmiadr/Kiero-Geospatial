import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Komponen Error Boundary untuk menangkap JavaScript errors di child components
 * dan menampilkan fallback UI yang user-friendly.
 * @class ErrorBoundary
 * @extends {Component}
 */
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state untuk menampilkan fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log error ke console (bisa diganti dengan logging service)
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            // Fallback UI
            return (
                <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
                        {/* Error Icon */}
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>

                        <h1 className="text-xl font-bold text-gray-900 mb-2">
                            Terjadi Kesalahan
                        </h1>
                        <p className="text-gray-600 mb-6">
                            Maaf, terjadi kesalahan yang tidak terduga. Silakan muat ulang halaman atau kembali ke beranda.
                        </p>

                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                Muat Ulang
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                            >
                                Ke Beranda
                            </button>
                        </div>

                        {/* Error Details (only in development) */}
                        {import.meta.env.DEV && this.state.error && (
                            <details className="mt-6 text-left">
                                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                                    Detail Error (Development)
                                </summary>
                                <div className="mt-2 p-3 bg-gray-100 rounded-lg overflow-auto max-h-40">
                                    <pre className="text-xs text-red-600 whitespace-pre-wrap">
                                        {this.state.error.toString()}
                                        {this.state.errorInfo?.componentStack}
                                    </pre>
                                </div>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
