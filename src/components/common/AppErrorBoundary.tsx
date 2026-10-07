import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('S-TRAINER render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-[#101012] text-[#F5F4F0] flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#CFFF5C] font-extrabold">
            S
          </div>
          <h1 className="text-xl font-bold">No pudimos mostrar esta pantalla</h1>
          <p className="max-w-md text-sm text-[#A6A6AD]">
            Recarga S-TRAINER para intentarlo de nuevo. Si estabas guardando algo, comprueba primero si se guardó.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-[#CFFF5C] px-4 py-2 font-semibold text-[#101012]"
          >
            Recargar
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
