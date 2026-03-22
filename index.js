require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Google OAuth setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Load tokens from env on startup (persists across redeploys if set in Railway)
let storedTokens = process.env.GOOGLE_REFRESH_TOKEN
  ? {
      access_token: process.env.GOOGLE_ACCESS_TOKEN,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    }
  : null;

if (storedTokens) {
  oauth2Client.setCredentials(storedTokens);
  console.log('Loaded tokens from environment variables');
}

// Step 1: Visit this URL to authorize your Google account
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent', // Force consent screen so refresh_token is always returned
  });
  res.redirect(authUrl);
});

// Step 2: Google redirects here after authorization
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  storedTokens = tokens;
  oauth2Client.setCredentials(tokens);
  console.log('Tokens received and stored:', tokens);
  console.log('--- COPY THESE TO RAILWAY ENV VARS ---');
  console.log('GOOGLE_ACCESS_TOKEN:', tokens.access_token);
  console.log('GOOGLE_REFRESH_TOKEN:', tokens.refresh_token);
  console.log('--------------------------------------');
  res.send(`
    <h2>Google Calendar authorization successful!</h2>
    <p>Tokens have been stored. Check your Railway logs and copy the token values into your Railway environment variables:</p>
    <ul>
      <li><strong>GOOGLE_ACCESS_TOKEN</strong></li>
      <li><strong>GOOGLE_REFRESH_TOKEN</strong></li>
    </ul>
    <p>Once set, the app will survive redeploys without needing to re-authenticate.</p>
  `);
});

// Helper function to create a calendar event
async function createCalendarEvent({ summary, date, time, name }) {
  if (!storedTokens) {
    throw new Error('No tokens stored. Please visit /auth to authorize Google Calendar.');
  }

  oauth2Client.setCredentials(storedTokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const [hours, minutes] = time.split(':').map(Number);
  const endHours = hours + 1;
  const endTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const event = {
    summary: summary || 'Meeting',
    description: `Meeting booked for ${name} via Voice Scheduling Agent`,
    start: {
      dateTime: `${date}T${time}:00`,
      timeZone: 'Asia/Kolkata',
    },
    end: {
      dateTime: `${date}T${endTime}:00`,
      timeZone: 'Asia/Kolkata',
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
  });

  return response.data;
}

// VAPI webhook handler
app.post('/webhook', async (req, res) => {
  const body = req.body;
  console.log('VAPI event received:', body.message?.type);

  if (body.message?.type === 'tool-calls') {
    const toolCalls = body.message.toolCalls;

    for (const toolCall of toolCalls) {
      if (toolCall.function?.name === 'bookMeeting') {
        const { name, date, time, summary } = toolCall.function.arguments;
        console.log('bookMeeting called with:', { name, date, time, summary });

        try {
          const event = await createCalendarEvent({ name, date, time, summary });
          return res.json({
            results: [
              {
                toolCallId: toolCall.id,
                result: `Meeting booked successfully for ${name} on ${date} at ${time}.`,
              },
            ],
          });
        } catch (err) {
          console.error('Calendar event creation failed:', err);
          return res.json({
            results: [
              {
                toolCallId: toolCall.id,
                result: `Sorry, I was unable to create the calendar event. Please try again.`,
              },
            ],
          });
        }
      }
    }
  }

  res.json({ received: true });
});

// Test endpoint to manually create a calendar event
app.post('/create-event', async (req, res) => {
  try {
    const { summary, date, time, name } = req.body;
    const event = await createCalendarEvent({ summary, date, time, name });
    res.json({ success: true, event });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'Voice Scheduling Agent is running' });
});

app.use(express.static('public'));

app.get('/call', (req, res) => {
  res.sendFile(__dirname + '/public/call.html');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT}/auth to authorize Google Calendar`);
});