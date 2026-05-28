# Mobile Deployment

This game is ready to run as a public Node web service.

## Deploy

Use any Node hosting platform that supports long-running HTTP connections for Server-Sent Events.

Required settings:

- Build command: leave empty
- Start command: `node server.js`
- Node version: `20` or newer
- Environment:
  - `HOST=0.0.0.0`
  - `PORT=<provided by host>`

## Mobile Play

Current public URL:

https://omok-h9o2.onrender.com/

After deployment, open the public HTTPS URL on a phone.

1. Enter a nickname.
2. Create a room.
3. Tap `초대 링크 공유`.
4. Send the Render link to a friend.
5. The friend taps the link, enters a nickname, and taps `방 입장`.

Do not send `localhost:3001` to a phone. `localhost` only works on the computer running the local server.

The app also includes a web manifest and service worker, so phones can add it to the home screen.

## Current Storage Model

Rooms are stored in server memory. This is enough for casual matches, but rooms reset when the hosting service restarts. For permanent rankings, add a database later.
