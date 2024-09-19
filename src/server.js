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

function addUser(socket, data) {
  if (!data || !data.id || !data.name) {
    console.error('Invalid data received:', data);
    return;
  }

  participants[data.id] = {
    id: data.id,
    name: data.name,
    stream: data.stream || null,
    videoEnabled: data.videoEnabled || false,
    audioEnabled: data.audioEnabled || false,
    recognized: data.recognized || false,
    muted: data.muted || true
  };

  console.log(`User ${data.name} (${socket.id}) added successfully.`);
  console.log('Current participants:', participants);
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle new participant
  socket.on('new-participant', (data) => {
    addUser(socket, data);
    console.log(`Participant ${data.name} (${data.id}) has joined.`);
    // Broadcast to all other clients
    socket.broadcast.emit('get-participants', Object.values(participants));
    // Send the updated participants list to the newly connected client
    socket.emit('existing-participants', Object.values(participants));
  });

  // Handle stream updates
  socket.on('stream', (data) => {
    console.log('socket id '+ socket.id);
    console.log(`Received stream from socket ${socket.id}`);
    console.log(data.id + ' user id')
    if (participants[data.id]) {
      participants[data.id].stream = data.stream;

      // Broadcast updated stream to all other clients
      io.emit('stream', { id: participants[data.id].id, stream: data.stream });
      console.log(`New stream from participant: ${participants[data.id].id}`);
    } else {
      console.log('Participant not found.');
    }
  });

  // Handle participant updates (e.g., video/audio toggles)
  socket.on('update-participant', (data) => {
    if (participants[data.id]) {
      participants[data.id] = { ...participants[data.id], ...data };
      socket.broadcast.emit('update-participant', participants[data.id]);
      console.log(`Updated participant ${data.name} (${socket.id})`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', (data) => {
    console.log('Client disconnected:', data.id);
    delete participants[data.id];
    socket.broadcast.emit('get-participants', Object.values(participants));
  });

  // Initial request for participants
  socket.on('get-participants', () => {
    console.log('Client requested participants');
    socket.emit('existing-participants', Object.values(participants));
    console.log('Sent participants:', Object.values(participants));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
