import React, { useState, useRef } from 'react';

export default function Recorder() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('—');
  const [story, setStory] = useState('—');
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  const recordAndSend = async () => {
    setRecording(true);
    setTranscript('Listening...');
    setStory('—');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.start();

      // record for 4 seconds
      await new Promise((res) => setTimeout(res, 4000));
      mediaRecorder.stop();

      await new Promise((res) => (mediaRecorder.onstop = res));

      const blob = new Blob(chunks, { type: 'audio/webm' });

      // upload to backend /api/upload (backend proxies to AssemblyAI)
      setTranscript('Uploading for transcription...');
      const fd = new FormData();
      fd.append('file', blob, 'clip.webm');

      const uploadResp = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });

      const uploadJson = await uploadResp.json();
      if (uploadJson.error) throw new Error(uploadJson.detail || uploadJson.error || 'Upload failed');
      const text = uploadJson.transcript || '';
      setTranscript(text || '(no transcript)');

      // generate story
      setLoading(true);
      setStory('Generating story...');
      const genResp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const contentType = genResp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const genJson = await genResp.json();
        setStory(genJson.story || '(no story returned)');

        if (genJson.audioUrl) {
          // play audioUrl
          if (audioRef.current) {
            audioRef.current.src = genJson.audioUrl;
            await audioRef.current.play().catch(() => {});
          }
        } else if (genJson.base64_audio) {
          // if server returned base64
          const blob2 = base64ToBlob(genJson.base64_audio, 'audio/mpeg');
          if (audioRef.current) {
            audioRef.current.src = URL.createObjectURL(blob2);
            await audioRef.current.play().catch(() => {});
          }
        }
      } else if (contentType.includes('audio/')) {
        // binary audio returned
        const arrayBuffer = await genResp.arrayBuffer();
        const audioBlob = new Blob([arrayBuffer], { type: contentType });
        if (audioRef.current) {
          audioRef.current.src = URL.createObjectURL(audioBlob);
          await audioRef.current.play().catch(() => {});
        }
        setStory('(audio returned and playing)');
      } else {
        const textResp = await genResp.text();
        setStory(textResp);
      }
    } catch (err) {
      console.error(err);
      setTranscript('Error: ' + String(err));
      setStory('—');
    } finally {
      setLoading(false);
      setRecording(false);
    }
  };

  return (
    <div className="recorder-card">
      <div className="controls">
        <button onClick={recordAndSend} disabled={recording || loading} className="primary">
          {recording ? 'Recording...' : '🎤 Record (4s)'}
        </button>
      </div>

      <div className="info">
        <div><strong>Transcript:</strong> <span className="mono">{transcript}</span></div>
        <div style={{ marginTop: 12 }}><strong>Story:</strong></div>
        <div className="story-box">{story}</div>
      </div>

      <audio ref={audioRef} controls style={{ marginTop: 12, width: '100%' }} />

      <style>{`
        .recorder-card { background: #fff; padding: 18px; border-radius: 8px; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
        .controls { margin-bottom: 12px; }
        button.primary { padding: 10px 14px; font-size: 16px; cursor: pointer; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace; }
        .story-box { white-space: pre-wrap; background:#f7f7fb; padding: 12px; border-radius:6px; margin-top:6px; }
      `}</style>
    </div>
  );
}

function base64ToBlob(base64, mime) {
  const binary = atob(base64);
  const len = binary.length;
  const buffer = new Uint8Array(len);
  for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i);
  return new Blob([buffer], { type: mime });
}
