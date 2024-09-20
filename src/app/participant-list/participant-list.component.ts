import { Component, Input } from '@angular/core';
import { Participant } from './participant.model';
import {MatCard, MatCardContent, MatCardHeader, MatCardTitle} from '@angular/material/card';
import {MatList, MatListItem} from '@angular/material/list';
import {NgForOf, NgIf} from "@angular/common";

@Component({
  selector: 'app-participant-list',
  templateUrl: './participant-list.component.html',
  standalone: true,
  imports: [
    MatListItem,
    MatList,
    MatCardContent,
    MatCardTitle,
    MatCardHeader,
    MatCard,
    NgForOf,
    NgIf
  ],
  styleUrls: ['./participant-list.component.css']
})
export class ParticipantListComponent {
  @Input() participants: Participant[] = []; // Liste der Teilnehmer

  /**
   * Returns the status of a participant based on their muted state.
   *
   * @param participant - The participant whose status needs to be determined.
   * @returns A string indicating whether the participant is muted or unmuted.
   *
   * @example
   * ```typescript
   * const participant: Participant = { name: 'John Doe', muted: true };
   * console.log(getParticipantStatus(participant)); // Output: 'Muted'
   * ```
   */
  getParticipantStatus(participant: Participant): string {
    return participant.muted ? 'Muted' : 'Unmuted';
  }
}
