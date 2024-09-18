import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

interface Participant {
  id: string;
  name: string;
  muted: boolean;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent {
  participants: Participant[] = []; // Definiere das Array mit dem Typ
  videoEnabled = true;
  audioEnabled = true;

  constructor(private toastr: ToastrService) {}

  addParticipant() {
    const newName = prompt('Geben Sie den Namen des neuen Teilnehmers ein:');
    if (newName) {
      this.participants.push({ id: `user${this.participants.length + 1}`, name: newName, muted: false });
      this.toastr.success('Teilnehmer hinzugefügt!', 'Erfolg');
    }
  }

  toggleVideo() {
    this.videoEnabled = !this.videoEnabled;
    this.toastr.info(this.videoEnabled ? 'Video aktiviert' : 'Video deaktiviert');
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    this.toastr.info(this.audioEnabled ? 'Audio aktiviert' : 'Audio deaktiviert');
  }
}
