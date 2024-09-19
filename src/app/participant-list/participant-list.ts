import { Component, Input } from '@angular/core';
import { Participant } from '../participant-list/participant.model'; // Pfad zum Participant-Modell anpassen

@Component({
  selector: 'app-participant-list',
  templateUrl: './participant-list.component.html',
  styleUrls: ['./participant-list.component.css']
})
export class ParticipantListComponent {
  @Input() participants: Participant[] = []; // Liste der Teilnehmer

  // Diese Methode wird aufgerufen, um den Status des Teilnehmers (gemutet oder nicht) zu erkennen
  getParticipantStatus(participant: Participant): string {
    return participant.muted ? 'Muted' : 'Unmuted';
  }
}
