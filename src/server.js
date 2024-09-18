const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  }
});

app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.static('public'));

const participants = {};

function addUser(socket, data, isFirstUser) {
  participants[socket.id] = {
    id: data.id,
    name: data.name,
    stream: data.stream || null,
    videoElement: data.videoElement || null,
    videoEnabled: data.videoEnabled || false,
    audioEnabled: data.audioEnabled || false,
    recognized: data.recognized || null,
    muted: data.muted || true,
    lastChecked: data.lastChecked || null,
    isFirstUser: isFirstUser,
  };
  console.log(`user ${data.name} (${socket.id}) added successfully.`);
}

// Handle new participant joining
io.on('connection', (socket) => {
  console.log('new client connected:', socket.id);

  // When a new participant joins
  socket.on('new-participant', (data) => {
    const isFirstUser = Object.keys(participants).length === 0;

    // Add the new participant to the server's participants list
    addUser(socket, data, isFirstUser);

    console.log(`client: participant ${data.name} (${socket.id}) has joined.`);

    // Send the existing participants list to the newly connected client
    socket.emit('existing-participants', Object.values(participants));
    console.log(`sent existing participants to ${data.name} (${socket.id})`);

    // Broadcast the new participant to all other clients
    socket.broadcast.emit('participant-joined', participants[socket.id]);
    console.log(`broadcasted new participant ${data.name} (${socket.id}) to others.`);
  });

  // When a participant disconnects
  socket.on('disconnect', () => {
    console.log('client: user with socket id ' + socket.id + 'disconnected');

    // Remove the participant from the server's participants list
    const deletedParticipant =  participants[socket.id];
    delete participants[socket.id];

    // Inform all clients that this participant left
    socket.broadcast.emit('participant-left', deletedParticipant);
  });

  // When a participant sends a video stream
  socket.on('stream', (data) => {
    console.log('client: sent stream data to broadcast:', data);

    if (data && data.userId && data.stream) {
      // Update the participant's video stream on the server
      if (participants[data.userId]) {
        participants[data.userId].stream = data.stream;
        // Broadcast the stream to other participants
        socket.broadcast.emit('stream', data);
        console.log(`New stream from participant: ${data.userId}`);
      } else {
        console.log('Participant not found:', data.userId);
      }
    } else {
      console.log('Invalid stream data:', data);
    }
  });

  socket.on('get-participants', () => {
    console.log('Client requested participants');
    socket.emit('existing-participants', Object.values(participants));
    console.log('Sent participants:', Object.values(participants));
  });

  // Handle requests for participants' video streams
  socket.on('request-streams', () => {
    console.log('client: requesting all streams');
    for (const [id, participant] of Object.entries(participants)) {
      if (participant.videoStream) {
        socket.emit('stream', { userId: id, stream: participant.videoStream });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
