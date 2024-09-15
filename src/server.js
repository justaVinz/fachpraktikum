// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serviere statische Dateien aus dem Verzeichnis "public"
app.use(express.static('public'));

// Wenn ein Client eine Verbindung herstellt
io.on('connection', (socket) => {
  console.log('Ein neuer Benutzer hat sich verbunden:', socket.id);

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

  // Wenn der Client die Verbindung trennt
  socket.on('disconnect', () => {
    console.log('Benutzer hat die Verbindung getrennt:', socket.id);
  });
});

// Starte den Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
