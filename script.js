function checkParticipantFace(participantId) {
    // API-Aufruf zur Gesichtserkennung
    fetch('http://127.0.0.1:5000/detect', {method: 'POST'})
        .then(response => response.json())
        .then(data => {
            if (!data.isRecognized) {
                addStatusIcon(participantId);
            }
        })
        .catch(error => console.error('Fehler bei der Anfrage:', error));
}

function addStatusIcon(participantId) {
    // Finde das Teilnehmer-Element im DOM (abhängig von Jitsi DOM-Struktur)
    const participantElement = document.querySelector(`[id="participant_${participantId}"]`);

    if (participantElement) {
        // Erstelle das Bild-Element
        const img = document.createElement('img');
        img.src = './sample/lightbulb.jpg';  // Pfad zu deinem Symbolbild
        img.className = 'status-icon';

        // Füge das Symbolbild dem Teilnehmer-Element hinzu
        participantElement.appendChild(img);
    } else {
        console.log(`Teilnehmer-Element für ${participantId} nicht gefunden.`);
    }
}