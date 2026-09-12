import { Component, type ReactNode } from 'react';

/** A failed optional room chunk must not take away financial navigation. */
export class PlayBoundary extends Component<{ children: ReactNode; onExit: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section role="alert"><h2>Hercules’s room could not open</h2><p>Your saved looks and household displays are still kept. Reload to try the room again.</p><button onClick={() => window.location.reload()}>Reload</button><button onClick={this.props.onExit}>Return to Together</button></section>;
    return this.props.children;
  }
}
