import React from 'react';
import Recorder from './components/Recorder';

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>Murfai — Kids Storyteller</h1>
        <p>Record ~4s of speech. We'll transcribe, generate a short story, and play it with Murf TTS.</p>
      </header>

      <main>
        <Recorder />
      </main>

      <footer>
        <small>Backend must be running at http://localhost:3000</small>
      </footer>
    </div>
  );
}
