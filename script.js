function checkParticipantFace(participantId) {
    fetch('http://127.0.0.1:5000/detect', {method: 'POST'})
        .then(response => response.json())
        .then(data => {
            console.log(data.message);
            if (!data.recognized) {
                addStatusIcon(participantId);
            }
        })
        .catch(error => console.error('Fehler bei der Anfrage:', error));
}

function captureParticipantFace() {
    fetch('http://127.0.0.1:5000/capture', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            console.log(data.message);
            if (data.img_path) {
                console.log("Bild hinzugefügt unter " + data.img_path);
            }
        } else if (data.error) {
            console.error('Fehler:', data.error);
        }
    })
    .catch(error => console.error('Fetch-Fehler:', error));
}

function addStatusIcon(participantId) {
    // Finde das Teilnehmer-Element im DOM (abhängig von Jitsi DOM-Struktur)
    const participantElement = document.querySelector(`[id="participant_${participantId}"]`);
    if (participantElement) {
        // Erstelle das Bild-Element
        const indicatorsContainer = participantElement.querySelector('.css-lribt2-indicators');
        if (indicatorsContainer) {
            const img = document.createElement('img');
            img.src = './sample/lightbulb.jpg';  // Pfad zu deinem Symbolbild
            img.className = 'status-icon';
            indicatorsContainer.appendChild(img);
        } else {
            console.log('Der Container für die Icons wurde nicht gefunden.');
        }
    } else {
        console.log(`Teilnehmer-Element für ${participantId} nicht gefunden.`);
    }
}

function checkIfImageExists(url) {
    return fetch(url, { method: 'HEAD' }) // HEAD-Anfrage, um nur Header-Daten abzurufen
        .then(response => {
            if (response.ok) { // Statuscode 200-299 bedeutet Erfolg
                console.log('Bild existiert.');
                return true;
            } else {
                console.log('Bild existiert nicht.');
                return false;
            }
        })
        .catch(error => {
            console.error('Fehler bei der Überprüfung des Bildes:', error);
            return false;
        });
}

async function initializeCapture() {
    const imgPath = 'http://127.0.0.1:5000/photos/img.png';
    const imgExists = await checkIfImageExists(imgPath)
    if (!imgExists) {
        captureParticipantFace()
    }
}