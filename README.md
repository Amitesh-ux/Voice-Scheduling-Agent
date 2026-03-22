# Voice Scheduling Agent

A real-time voice assistant that books Google Calendar events through natural conversation. You speak to it, it collects your details, confirms them, and creates the event.

**Live URL:** https://voice-scheduling-agent-production-4de7.up.railway.app

---

## Demo

[Loom video link here]

---

## How to Test It

**Deployed backend:** https://voice-scheduling-agent-production-4de7.up.railway.app

To test the voice agent:
1. Go to [vapi.ai](https://vapi.ai) and open the **Scheduling Agent** assistant
2. Click **Talk to Assistant** to start a voice call
3. The agent will ask for your name, preferred date, time, and an optional meeting title
4. Confirm the details when it reads them back
5. Check your Google Calendar — the event will appear within a few seconds

---

## How It Works

### Voice Layer (VAPI)

The assistant runs on VAPI with a custom system prompt that guides the conversation. It collects four pieces of information one at a time: name, date, time, and meeting title. Once it has everything, it confirms back in plain English before doing anything.

When the user confirms, VAPI calls the `bookMeeting` tool with the collected parameters formatted correctly (date as YYYY-MM-DD, time as HH:MM in 24-hour format).

### Backend (Node.js + Express on Railway)

VAPI sends a POST request to `/webhook` with the tool call payload. The server extracts the parameters and calls `createCalendarEvent()`.

### Google Calendar Integration

Calendar events are created using the Google Calendar API v3 via OAuth 2.0.

**Auth flow:**
1. Visiting `/auth` redirects to Google's OAuth consent screen
2. After the user approves, Google redirects to `/oauth/callback` with an authorization code
3. The server exchanges the code for an access token and refresh token
4. Tokens are stored in Railway environment variables so they persist across redeploys

**Event creation:**
- Start time is built as `${date}T${time}:00` directly to avoid timezone conversion issues
- End time is calculated by adding 1 hour to the start
- All events use the `Asia/Kolkata` timezone
- Events are inserted into the user's primary Google Calendar

### Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `GOOGLE_ACCESS_TOKEN` | Stored after first OAuth login |
| `GOOGLE_REFRESH_TOKEN` | Stored after first OAuth login |
| `VAPI_API_KEY` | From VAPI dashboard |

---

## Running Locally

```bash
git clone https://github.com/Amitesh-ux/Voice-Scheduling-Agent.git
cd Voice-Scheduling-Agent
npm install
```

Create a `.env` file with the variables listed above, then:

```bash
node index.js
```

Visit `http://localhost:3000/auth` to authorize Google Calendar on first run.

---

## Tech Stack

- **Voice:** VAPI
- **Backend:** Node.js + Express
- **Calendar:** Google Calendar API v3
- **Deployment:** Railway