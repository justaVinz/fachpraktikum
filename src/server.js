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

const participants = {}; // Teilnehmerliste

io.on('connection', (socket) => {
  console.log('Ein neuer Benutzer hat sich verbunden:', socket.id);

  // Füge den neuen Teilnehmer zur Liste hinzu
  participants[socket.id] = { id: socket.id, name: 'User ' + socket.id }; // Beispielname, kannst du anpassen

  // Informiere den neuen Teilnehmer über alle anderen Teilnehmer
  socket.emit('current-participants', Object.values(participants));

  // Informiere alle anderen Benutzer über den neuen Teilnehmer
  socket.broadcast.emit('new-participant', participants[socket.id]);

  // Wenn der Client die Verbindung trennt
  socket.on('disconnect', () => {
    console.log('Benutzer hat die Verbindung getrennt:', socket.id);

    // Entferne den Teilnehmer aus der Liste
    delete participants[socket.id];

    // Informiere alle anderen Benutzer über die Trennung
    io.emit('participant-left', { id: socket.id });
  });

  // Empfangene Nachricht für einen neuen Teilnehmer
  socket.on('new-participant', (data) => {
    console.log('Neuer Teilnehmer:', data);
    // Broadcast an alle anderen Clients, dass ein neuer Teilnehmer da ist
    socket.broadcast.emit('new-peer', data);
  });

  // Empfangene Nachricht für einen Stream
  socket.on('stream', (data) => {
    console.log('Neuer Stream von Teilnehmer:', data.userId);
    // Broadcast an alle anderen Clients, dass ein neuer Stream da ist
    socket.broadcast.emit('stream', data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
