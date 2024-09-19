import { Component, OnInit, AfterViewInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Participant } from '../participant-list/participant.model';
import { io, Socket } from 'socket.io-client';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-meeting',
  templateUrl: './meeting.component.html',
  styleUrls: ['./meeting.component.css']
})
export class MeetingComponent implements OnInit, AfterViewInit {
  participants: Participant[] = [];
  showParticipants = true;
  userId: string | undefined;
  localParticipant: Participant | undefined;
  socket: Socket | undefined;
  private localStream: MediaStream | undefined;

  @ViewChildren('participantVideo') participantVideos: QueryList<ElementRef<HTMLVideoElement>> | undefined;

  constructor(private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.userId = params['id'];
      this.initializeSocket();
    });
  }

  ngAfterViewInit(): void {
    this.updateVideoElements();
  }

  initializeSocket(): void {
    this.socket = io('http://localhost:3000', {
      transports: ['websocket'],
      withCredentials: false
    });

    this.socket.on('connect', () => {
      this.startLocalStream();
    });

    this.socket.on('existing-participants', (participants: Participant[]) => {
      console.log('Existing participants received:', participants);
      this.participants = participants;
      this.localParticipant = participants.find(p => p.id === this.userId);
      console.log('Local participant:', this.localParticipant);
    });

    this.socket.on('stream', (data) => {
      console.log('Received stream data:', data);
      const participant = this.participants.find(p => p.id === data.id);
      if (participant) {
        participant.stream = data.stream;
        this.updateVideoElements();
      } else {
        console.log(`Participant ${data.id} not found in the list.`);
      }
    });

    this.socket.emit('get-participants');
  }

  updateVideoElements(): void {
    if (this.participantVideos) {
      this.participantVideos.forEach((videoElement, index) => {
        const participant = this.participants[index];
        if (participant && participant.stream) {
          if (participant.stream instanceof MediaStream) {
            console.log("instace of media stream");
            videoElement.nativeElement.srcObject = participant.stream;
          } else {
            {
              console.error(`Invalid stream for participant ${participant.id}`);
              return;
            }
          }
          videoElement.nativeElement.play().catch((e) => console.error('Error playing video:', e));
          console.log(`Video for participant ${participant.id} updated.`);
        }
      });
    }
  }

  toggleParticipants(): void {
    this.showParticipants = !this.showParticipants;
  }

  toggleVideo(): void {
    if (this.localParticipant) {
      this.localParticipant.videoEnabled = !this.localParticipant.videoEnabled;
      this.socket?.emit('update-participant', this.localParticipant);
    }
  }

  toggleMic(): void {
    if (this.localParticipant) {
      this.localParticipant.audioEnabled = !this.localParticipant.audioEnabled;
      this.socket?.emit('update-participant', this.localParticipant);
    }
  }

  startLocalStream(): void {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        this.localStream = stream;
        const videoElement = document.getElementById('local-video') as HTMLVideoElement;
        if (videoElement) {
          videoElement.srcObject = stream;
          videoElement.play().catch((e) => console.error('Error playing local video:', e));
        }

        const streamData = {
          id: this.userId,
          stream: stream
        };

        console.log(streamData);

        if (this.socket) {
          this.socket.emit('stream', streamData);
        }
      })
      .catch((error) => {
        console.error('Error accessing media devices.', error);
      });
  }
}
