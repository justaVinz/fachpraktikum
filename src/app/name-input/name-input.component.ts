import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Participant } from '../participant-list/participant.model';
import { v4 as uuid } from 'uuid';
import { io, Socket } from 'socket.io-client';

@Component({
  selector: 'app-name-input',
  templateUrl: './name-input.component.html',
  styleUrls: ['./name-input.component.css']
})
export class NameInputComponent implements OnInit {
  userName: string = '';
  stream: MediaStream | null = null;
  socket: Socket | undefined;

  @ViewChild('userVideo') userVideo!: ElementRef<HTMLVideoElement>;

  constructor(private router: Router) { }

  ngOnInit(): void {
    this.socket = io('http://localhost:3000');

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });
  }

  async getUserVideoStream(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (this.userVideo && this.userVideo.nativeElement) {
        this.userVideo.nativeElement.srcObject = this.stream;
      }
    } catch (err) {
      console.error('Error accessing media devices.', err);
      alert('Unable to access camera. Please allow camera access.');
    }
  }

  async submitName(): Promise<void> {
    if (this.userName.trim()) {
      if (!this.stream) {
        console.log("Waiting for stream...");
        await this.getUserVideoStream();
      }

      if (this.stream) {
        const generatedId = uuid();
        const newUser: Participant = {
          id: generatedId,
          name: this.userName,
          stream: this.stream,
          videoEnabled: true,
          audioEnabled: true,
          muted: true,
          recognized: false,
          isFirstUser: true
        };

        // Send the new participant data to the server
        this.socket?.emit('new-participant', newUser);

        // Navigate to the meeting page and pass the name and ID
        this.router.navigate(['/meeting'], { queryParams: { name: this.userName, id: generatedId } });
      } else {
        alert('Failed to access media stream. Please try again.');
      }
    } else {
      alert('Please enter a name.');
    }
  }
}
