// server.js - Murfai backend (copy-paste)
require('dotenv').config();
const express = require('express');
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// serve static frontend (development -> ../frontend, production build -> ../frontend/build)
const frontendPathDev = path.join(__dirname, '../frontend');
const frontendBuild = path.join(__dirname, '../frontend/build');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  console.log('Serving frontend from build folder.');
} else {
  app.use(express.static(frontendPathDev));
  console.log('Serving frontend from dev folder.');
}

const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// ENV variables
const PORT = process.env.PORT || 3000;
const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MURF_KEY = process.env.MURF_API_KEY;

// Basic sanity check for keys
if (!ASSEMBLYAI_KEY) console.warn('Warning: ASSEMBLYAI_KEY is not set in .env');
if (!OPENAI_API_KEY) console.warn('Warning: OPENAI_API_KEY is not set in .env');
if (!MURF_KEY) console.warn('Warning: MURF_API_KEY is not set in .env');

/**
 * POST /api/upload
 * Accepts multipart/form-data file field "file"
 * Uploads to AssemblyAI, creates transcription, polls until completed, returns { transcript }
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });

    const filePath = req.file.path;
    const fileStream = fs.createReadStream(filePath);

    // 1) Upload to AssemblyAI
    const upResp = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        authorization: ASSEMBLYAI_KEY,
        // Transfer-Encoding: chunked is handled automatically by node-fetch when using a stream
      },
      body: fileStream
    });

    if (!upResp.ok) {
      const txt = await upResp.text();
      throw new Error(`AssemblyAI upload failed: ${upResp.status} ${txt}`);
    }
    const upJson = await upResp.json();
    if (!upJson.upload_url) throw new Error('AssemblyAI upload returned no upload_url.');

    const audioUrl = upJson.upload_url;

    // 2) Create transcript
    const createResp = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: ASSEMBLYAI_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        // you can add features here like language detection, punctuate, etc.
      })
    });

    if (!createResp.ok) {
      const txt = await createResp.text();
      throw new Error(`AssemblyAI transcript create failed: ${createResp.status} ${txt}`);
    }
    const createJson = await createResp.json();
    if (!createJson.id) throw new Error('AssemblyAI transcript creation failed (no id).');
    const transcriptId = createJson.id;

    // 3) Poll for completion (up to a timeout)
    let transcriptText = '';
    const start = Date.now();
    const timeoutMs = 60_000; // 60 seconds max wait (adjust if you want)
    for (;;) {
      await new Promise(r => setTimeout(r, 1000));
      const pollResp = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { authorization: ASSEMBLYAI_KEY }
      });
      if (!pollResp.ok) {
        const txt = await pollResp.text();
        throw new Error(`AssemblyAI poll failed: ${pollResp.status} ${txt}`);
      }
      const pollJson = await pollResp.json();
      if (pollJson.status === 'completed') {
        transcriptText = pollJson.text || '';
        break;
      }
      if (pollJson.status === 'error') {
        throw new Error('AssemblyAI transcription error: ' + (pollJson.error || JSON.stringify(pollJson)));
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error('AssemblyAI transcription timed out.');
      }
    }

    // cleanup temp file
    fs.unlink(filePath, () => {});

    return res.json({ transcript: transcriptText });
  } catch (err) {
    console.error('[/api/upload] error:', err);
    // attempt to remove uploaded file if present
    try { if (req?.file?.path) fs.unlinkSync(req.file.path); } catch(e){/*ignore*/}
    return res.status(500).json({ error: 'upload_failed', detail: String(err) });
  }
});


/**
 * POST /api/generate
 * Body: { text: "<transcript or prompt>" }
 * Calls HF Router for Falcon, then Murf TTS. Returns JSON { story, audioUrl } OR returns audio bytes directly.
 */
app.post('/api/generate', async (req, res) => {
  try {
    const userText = (req.body && req.body.text) ? String(req.body.text).trim() : '';

    // 1) Extract keywords from user input and search for related stories
    let story = '';
    let keywords = [];
    
    if (userText && userText.length > 10) {
      // Extract keywords (nouns, adjectives, important words)
      const stopWords = ['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'tell', 'me', 'about', 'of', 'to', 'for', 'in', 'on', 'at', 'by', 'with'];
      const words = userText.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.includes(w));
      keywords = words.slice(0, 3); // Take top 3 keywords
      
      console.log('Extracted keywords:', keywords);
      
      // Search for stories using keywords
      if (keywords.length > 0) {
        const searchQuery = keywords.join(' ');
        
        // Try multiple story APIs with search/filtering
        const storyAPIs = [
          {
            url: 'https://shortstories-api.onrender.com/stories',
            extract: (data, keywords) => {
              // Filter stories that contain any of the keywords
              const matchingStories = data.filter(s => {
                const storyText = (s.story || s.content || s.text || '').toLowerCase();
                return keywords.some(keyword => storyText.includes(keyword));
              });
              
              if (matchingStories.length > 0) {
                const randomMatch = matchingStories[Math.floor(Math.random() * matchingStories.length)];
                return randomMatch?.story || randomMatch?.content || randomMatch?.text || '';
              }
              
              // No exact match, return random story
              const randomStory = data[Math.floor(Math.random() * data.length)];
              return randomStory?.story || randomStory?.content || randomStory?.text || '';
            }
          }
        ];

        let apiSuccess = false;
        for (const api of storyAPIs) {
          try {
            const storyResp = await fetch(api.url, {
              headers: { 'Accept': 'application/json' }
            });
            
            if (storyResp.ok) {
              const data = await storyResp.json();
              story = api.extract(data, keywords);
              
              if (story && story.length > 50) {
                story = story.replace(/<[^>]*>/g, '');
                story = story.trim();
                
                // Keep full story - no truncation
                
                apiSuccess = true;
                console.log('✓ Found story related to keywords from:', api.url);
                break;
              }
            }
          } catch (err) {
            console.log('× API failed:', api.url, err.message);
            continue;
          }
        }

        // If APIs fail, create a longer story using keywords
        if (!apiSuccess || !story) {
          console.log('Creating story from keywords:', keywords);
          const mainKeyword = keywords[0] || 'adventure';
          story = `Once upon a time, in a land far, far away, there was a wonderful story about ${keywords.join(', ')}. The tale began on a bright sunny morning when everything seemed peaceful and calm. Suddenly, ${mainKeyword} appeared and changed everything! The journey was filled with excitement, mystery, and wonder at every turn. Along the way, there were many challenges to overcome and lessons to learn. Friends were made, obstacles were conquered, and hearts were filled with courage. As the days passed, the adventure grew more thrilling and more magical. Every moment brought new surprises and discoveries that amazed everyone. The story of ${mainKeyword} taught us about bravery, kindness, and the power of believing in ourselves. In the end, everything worked out beautifully, and joy filled the hearts of all who heard this magnificent tale. And so, the legend of ${keywords.join(' and ')} lived on forever, inspiring generations to come. They all lived happily ever after, with memories that would last a lifetime!`;
        }
      }
    } else {
      // No user input - fetch a random story
      console.log('No user input, fetching random story');
      const fallbackStories = [
        "Once upon a time, in a magical forest filled with wonder, there lived a brave little bunny named Fluffy. Fluffy had the softest white fur and the brightest curious eyes you ever did see. Every morning, she would wake up excited to explore new parts of the enchanted forest. One beautiful spring day, while hopping through a meadow of colorful wildflowers, Fluffy discovered something extraordinary. Hidden beneath a rainbow of petals was a glowing golden carrot that shimmered with magical light! Fluffy couldn't believe her eyes. She carefully picked up the magical carrot and knew immediately that this was something special that needed to be shared. She hopped as fast as her little legs could carry her, gathering all her forest friends together. There was Sammy the squirrel, Oliver the owl, Bella the butterfly, and many more wonderful creatures. When they all saw the magical carrot, their eyes lit up with amazement and joy. Fluffy broke the carrot into pieces and shared it with everyone, and something magical happened. Each friend who ate a piece felt filled with happiness, kindness, and courage. From that day forward, the forest was filled with even more love and friendship than before. Fluffy learned that the best kind of magic comes from sharing and caring for others. And they all played together happily ever after, making beautiful memories every single day!",
        "There was a tiny mouse named Max who lived in the coziest little hole you could imagine, right at the base of an old oak tree. Max's home was decorated with acorn caps and soft moss, and he loved it dearly. But there was one thing Max loved even more than his cozy home, and that was cheese! Max dreamed about cheese day and night. He loved all kinds: sharp cheddar, creamy brie, Swiss with holes, and tangy blue cheese. One extraordinary morning, Max woke up to the most incredible smell wafting through his tiny door. He followed his nose through the forest, over hills, and across babbling brooks. The delicious aroma led him to an enormous cave he had never seen before. When Max entered the cave, he gasped in absolute amazement. There, sitting in the middle of the cave, was the biggest, most magnificent wheel of golden cheese he had ever laid eyes on! It was as tall as a tree and as wide as a house. Max couldn't believe his incredible luck! But then Max had a wonderful idea. Instead of keeping this treasure all to himself, he decided to share it with everyone in the forest. He scurried back home and invited all his friends: the rabbits, the birds, the deer, the foxes, and even the shy hedgehogs. That evening, they had the most spectacular cheese party the forest had ever seen! There was dancing under the stars, singing beautiful songs, and laughter that echoed through the trees. Everyone enjoyed the delicious cheese and thanked Max for his generous heart. Max realized that sharing something special with friends made it taste even better than keeping it all to himself. They celebrated until the moon was high in the sky, and Max went to bed that night with the biggest smile on his face. What an absolutely wonderful and unforgettable day it had been!",
        "High above the clouds, in the bright blue sky, lived a friendly dragon named Spark who was quite different from other dragons. While most dragons breathed fire and guarded treasure, Spark had a very special and unique gift. He could paint the most beautiful, vibrant rainbows anyone had ever seen! Every morning, as the sun began to rise and paint the sky with golden light, Spark would wake up feeling excited and ready to create. He had a magical paintbrush that was as long as a tree and bristles that sparkled with all the colors of the rainbow. Spark would fly gracefully through the clouds, dipping his brush in sunlight and rain, mixing colors that no one had ever seen before. He painted magnificent arches of red, orange, yellow, green, blue, indigo, and violet across the vast sky. The children in the villages below would run outside, point up at the sky, and wave enthusiastically at their friend Spark. Their faces would light up with pure joy and wonder every single time they saw his beautiful creations. Parents would stop their work to admire Spark's artwork, and even the grumpiest grown-ups couldn't help but smile when they saw his rainbows. Spark loved knowing that his art brought happiness to so many people and made their days brighter. He would sometimes paint special shapes in his rainbows: hearts for people in love, stars for those who needed hope, and swirls for anyone who needed a reason to smile. Every evening, as the sun began to set, Spark would paint one last magnificent rainbow to say goodnight to all his friends below. He would curl up on a soft cloud, feeling warm and content, knowing he had made the world more beautiful and colorful that day. Spark was truly the happiest dragon in the entire world, and everyone loved him dearly!"
      ];
      story = fallbackStories[Math.floor(Math.random() * fallbackStories.length)];
    }

    // 2) Call Murf AI TTS API
    const murfPayload = {
      voiceId: "en-US-ken",  // Murf voice ID (check Murf dashboard for available voices)
      text: story,
      rate: 0,
      pitch: 0,
      sampleRate: 48000,
      format: "MP3",
      channelType: "STEREO",
      pronunciationDictionary: {},
      encodeAsBase64: false
    };

    const murfResp = await fetch('https://api.murf.ai/v1/speech/generate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': MURF_KEY
      },
      body: JSON.stringify(murfPayload)
    });

    if (!murfResp.ok) {
      const txt = await murfResp.text();
      throw new Error(`Murf TTS error ${murfResp.status}: ${txt}`);
    }

    const murfJson = await murfResp.json();
    
    // Murf returns audioFile URL or audioContent (base64)
    if (murfJson.audioFile) {
      return res.json({ story, audioUrl: murfJson.audioFile });
    } else if (murfJson.audioContent) {
      return res.json({ story, base64_audio: murfJson.audioContent });
    } else {
      // Return the story with whatever Murf returned
      return res.json({ story, murf: murfJson });
    }
  } catch (err) {
    console.error('[/api/generate] error:', err);
    return res.status(500).json({ error: 'generation_failed', detail: String(err) });
  }
});

// fallback route for SPA (in case you're serving build)
app.get('*', (req, res) => {
  const indexHtml = path.join(fs.existsSync(frontendBuild) ? frontendBuild : frontendPathDev, 'index.html');
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  return res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`🔥 Murfai backend running on http://localhost:${PORT}`);
});
