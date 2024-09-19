import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {Participant} from '../participant-list/participant.model';
import {v4 as uuid} from 'uuid';
import {io, Socket} from 'socket.io-client';

@Component({
  selector: 'app-name-input',
  templateUrl: './name-input.component.html',
  styleUrls: ['./name-input.component.css']
})
export class NameInputComponent implements OnInit {
  userName: string = '';
  stream: MediaStream | null = null;
  socket: Socket | undefined;
  userId: string | null = null;

  @ViewChild('userVideo') userVideo!: ElementRef<HTMLVideoElement>;

  constructor(private router: Router) {
  }

  ngOnInit(): void {
    this.socket = io('http://localhost:3000');

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });
  }

  async getUserVideoStream(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
      if (this.userVideo && this.userVideo.nativeElement) {
        this.userVideo.nativeElement.srcObject = this.stream;
      }
    } catch (err) {
      console.error('Error accessing media devices.', err);
      alert('Unable to access camera. Please allow camera access.');
    }
  }

  /**
   * Handles the submission of user name and initiates the video call process.
   *
   * @remarks
   * This function checks if the user name is provided, ensures that the media stream is available,
   * generates a new user ID if not already assigned, creates a new participant object, sends the data to the server,
   * and navigates to the meeting page.
   *
   * @returns {Promise<void>} - A promise that resolves when the function completes.
   */
  async submitName(): Promise<void> {
    if (this.userName.trim()) {
      if (!this.stream) {
        console.log("Waiting for stream...");
        await this.getUserVideoStream();
      }

      if (this.stream && !this.userId) {
        this.userId = uuid();

        const newUser: Participant = {
          id: this.userId,
          name: this.userName,
          stream: null,
          videoEnabled: true,
          audioEnabled: false,
          muted: true,
          recognized: false,
          isLeader: false
        };

        this.socket?.emit('new-participant', newUser);

        await this.router.navigate(['/meeting'], {queryParams: {name: this.userName, id: this.userId}});
      } else if (this.userId) {
        await this.router.navigate(['/meeting'], {queryParams: {name: this.userName, id: this.userId}});
      } else {
        alert('Failed to access media stream. Please try again.');
      }
    } else {
      alert('Please enter a name.');
    }
  }
}
