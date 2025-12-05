# 🎙️ Murfai - Kids Storyteller

An AI-powered storytelling application that transforms voice recordings into magical stories with text-to-speech narration. Built for kids to experience interactive storytelling through voice interaction.

## 🌟 Features

- **Voice Recording**: Record 4 seconds of speech through your browser
- **Speech-to-Text**: Automatic transcription using AssemblyAI
- **Smart Story Generation**: 
  - Keyword extraction from transcribed speech
  - Story search and matching based on extracted keywords
  - Dynamic story generation with context-aware narratives
  - Fallback to random magical stories
- **Text-to-Speech**: Professional voice narration using Murf AI
- **Real-time Processing**: Seamless workflow from recording to story playback
- **Kid-Friendly Interface**: Simple, colorful, and easy-to-use design

## 🏗️ Architecture

### Frontend
- **Framework**: React 19.2.1
- **Components**:
  - `Recorder`: Handles audio recording, transcription upload, and story playback
  - `App`: Main application wrapper with header and footer
- **Key Features**:
  - MediaRecorder API for audio capture
  - FormData for file uploads
  - Audio element for story playback

### Backend
- **Framework**: Express.js
- **APIs Integrated**:
  - **AssemblyAI**: Speech-to-text transcription
  - **Murf AI**: High-quality text-to-speech generation
  - **Short Stories API**: Story content sourcing
- **Key Features**:
  - File upload handling with Multer
  - Keyword extraction and story matching
  - Polling mechanism for transcription status
  - Audio streaming and delivery

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- API Keys for:
  - AssemblyAI
  - OpenAI (optional, for future enhancements)
  - Murf AI

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/sakshithorat13/Murfai.git
cd Murfai
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:
```env
PORT=3000
ASSEMBLYAI_KEY=your_assemblyai_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
MURF_API_KEY=your_murf_api_key_here
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

## 🎮 Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm start
# Or for development with auto-restart:
npm run dev
```
Backend will run on `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```
Frontend will run on `http://localhost:3001` (or next available port)

### Production Build

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Start the backend (it will serve the built frontend):
```bash
cd backend
npm start
```

Access the application at `http://localhost:3000`

## 🔧 Configuration

### Voice Settings (Backend)
Modify `server.js` to customize Murf AI voice settings:
```javascript
const murfPayload = {
  voiceId: "en-US-ken",  // Change voice ID
  rate: 0,               // Speech rate (-100 to 100)
  pitch: 0,              // Pitch adjustment (-100 to 100)
  sampleRate: 48000,     // Audio quality
  format: "MP3",         // Audio format
  channelType: "STEREO"  // Mono or Stereo
};
```

### Recording Duration (Frontend)
Adjust recording time in `Recorder.js`:
```javascript
// Change from 4 seconds to desired duration
await new Promise((res) => setTimeout(res, 4000));
```

## 📁 Project Structure

```
Murfai/
├── backend/
│   ├── server.js           # Express server with API routes
│   ├── package.json        # Backend dependencies
│   ├── .env               # Environment variables (create this)
│   └── uploads/           # Temporary audio file storage
│
├── frontend/
│   ├── public/
│   │   ├── index.html     # HTML template
│   │   ├── manifest.json  # PWA manifest
│   │   └── robots.txt     # SEO configuration
│   │
│   ├── src/
│   │   ├── App.js         # Main application component
│   │   ├── App.css        # Application styles
│   │   ├── index.js       # React entry point
│   │   ├── styles.css     # Global styles
│   │   └── components/
│   │       └── Recorder.js # Recording and playback component
│   │
│   └── package.json       # Frontend dependencies
│
└── README.md              # This file
```

## 🔌 API Endpoints

### POST `/api/upload`
Upload audio file for transcription.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Audio file (field name: `file`)

**Response:**
```json
{
  "transcript": "transcribed text here"
}
```

### POST `/api/generate`
Generate story and audio from transcribed text.

**Request:**
- Method: `POST`
- Content-Type: `application/json`
- Body:
```json
{
  "text": "transcribed text"
}
```

**Response:**
```json
{
  "story": "generated story text",
  "audioUrl": "https://audio-url.com/file.mp3"
}
```
Or:
```json
{
  "story": "generated story text",
  "base64_audio": "base64encodedaudiodata"
}
```

## 🎨 How It Works

1. **User Records**: Child speaks into microphone for 4 seconds
2. **Transcription**: Audio is uploaded to backend and transcribed by AssemblyAI
3. **Keyword Extraction**: Backend extracts meaningful keywords from transcript
4. **Story Matching**: System searches story database for related stories
5. **Story Generation**: If no match found, generates contextual story using keywords
6. **Voice Synthesis**: Story is converted to speech using Murf AI
7. **Playback**: Audio is streamed back to frontend and played automatically

## 🐛 Troubleshooting

### Backend Issues

**API Keys Not Working:**
- Verify all API keys are correctly set in `.env`
- Check if keys have necessary permissions and credits
- Restart backend after updating `.env`

**Upload Fails:**
- Check `uploads/` directory exists and has write permissions
- Verify audio format is supported by AssemblyAI

**Transcription Timeout:**
- Increase timeout in `server.js` (default 60 seconds)
- Check AssemblyAI service status

### Frontend Issues

**Microphone Access Denied:**
- Grant browser permission for microphone access
- Use HTTPS or localhost (required for MediaRecorder API)

**Audio Doesn't Play:**
- Check browser console for errors
- Verify audio format compatibility
- Try user interaction before playback (browser autoplay policies)

**CORS Errors:**
- Ensure backend CORS is enabled (already configured)
- Check proxy setting in `frontend/package.json`

## 🔐 Security Notes

- Never commit `.env` file to version control
- Keep API keys secure and rotate them regularly
- Uploaded files are automatically cleaned up after processing
- Consider implementing rate limiting for production use

## 🚀 Future Enhancements

- [ ] Multiple language support
- [ ] Story categories and themes
- [ ] User preferences for voice and story types
- [ ] Story history and favorites
- [ ] Longer recording durations
- [ ] Visual story illustrations
- [ ] Parent dashboard for monitoring
- [ ] Offline mode support

## 📄 License

This project was created for a college hackathon.

## 👥 Contributors

- [Sakshi Thorat](https://github.com/sakshithorat13)

## 🙏 Acknowledgments

- **AssemblyAI** for speech-to-text API
- **Murf AI** for text-to-speech synthesis
- **Short Stories API** for story content
- All open-source libraries used in this project

## 📞 Support

For questions or issues, please open an issue on GitHub or contact the maintainers.

---

Made with ❤️ for kids who love stories!
