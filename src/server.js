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

let participants = {};

function addUser(socket, data) {
  if (!data || !data.id || !data.name) {
    console.error('Invalid data received:', data);
    return;
  }

  participants[data.id] = {
    id: data.id,
    name: data.name,
    videoEnabled: data.videoEnabled || false,
    audioEnabled: data.audioEnabled || false,
    recognized: data.recognized || false,
    muted: data.muted || true,
  };

  console.log(`User ${data.name} (${socket.id}) added successfully.`);
  console.log('Current participants:', participants);
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('new-participant', (data) => {
    addUser(socket, data);
    console.log(`Participant ${data.name} (${data.id}) has joined.`);

    socket.broadcast.emit('get-participants', Object.values(participants));

    socket.emit('existing-participants', Object.values(participants));
  });

  socket.on('sdp-offer', (offer) => {
    console.log(`Received SDP offer from ${offer.from}`);
    socket.to(offer.to).emit('sdp-offer', offer);
  });

  socket.on('sdp-answer', (answer) => {
    console.log(`Received SDP answer from ${answer.from}`);
    socket.to(answer.to).emit('sdp-answer', answer);
  });

  socket.on('user-recognized', ({ id, recognized }) => {
    console.log(`User recognized: ${id}, Status: ${recognized}`);
    participants[id] = recognized;

    io.to('leaders').emit('recognition-update', { id, recognized });
  });

  socket.on('ice-candidate', (candidate) => {
    console.log(`Received ICE candidate from ${candidate.from}`);
    socket.to(candidate.to).emit('ice-candidate', candidate);
  });

  socket.on('update-participant', (data) => {
    if (participants[data.id]) {
      participants[data.id] = { ...participants[data.id], ...data };
      socket.broadcast.emit('update-participant', participants[data.id]);
      console.log(`Updated participant ${data.name} (${socket.id})`);
    }
  });

  socket.on('participant-left', (data) => {
    console.log('Participant left:', data.id);
    participants = participants.filter(p => p.id !== data.id);
    io.emit('existing-participants', participants);
  });

  socket.on('update-video-status', (data) => {
    console.log('Video status updated:', data);
    socket.broadcast.emit('update-video-status', data);
  });

  socket.on('update-mic-status', (data) => {
    console.log('Updating microphone status:', data);
    io.emit('update-mic-status', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    for (let id in participants) {
      if (participants[id].socketId === socket.id) {
        delete participants[id];
        break;
      }
    }
    socket.broadcast.emit('get-participants', Object.values(participants));
  });

  socket.on('get-participants', () => {
    console.log('Client requested participants');
    socket.emit('existing-participants', Object.values(participants));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
