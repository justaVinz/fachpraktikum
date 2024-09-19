import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { io, Socket } from 'socket.io-client';
import { FaceRecognitionService } from '../services/face-recognition.service';
import { Participant } from '../participant-list/participant.model';
import { Subscription, interval, combineLatest, EMPTY } from 'rxjs';

@Component({
  selector: 'app-meeting',
  templateUrl: './meeting.component.html',
  styleUrls: ['./meeting.component.css']
})
export class MeetingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('participantVideo') participantVideos!: QueryList<ElementRef<HTMLVideoElement>>;
  participants: Set<Participant> = new Set();
  videoEnabled = false;
  audioEnabled = false;
  showParticipants = true;
  private userId?: string;
  private checkInterval$?: Subscription;
  private detectionInterval$?: Subscription;
  private socket: Socket;

  constructor(
    private route: ActivatedRoute,
    private faceRecognitionService: FaceRecognitionService,
    private cd: ChangeDetectorRef
  ) {
    this.socket = io('http://localhost:3000', {
      transports: ['websocket']
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const name = params['name'];
      if (name) {
        this.initializeSocket(name);
      }
    });

    window.addEventListener('beforeunload', () => this.disconnectUser());
  }

  ngAfterViewInit() {
    this.cd.detectChanges();
    this.updateParticipantVideos();
  }

  ngOnDestroy(): void {
    this.disconnectUser();
    this.checkInterval$?.unsubscribe();
    this.detectionInterval$?.unsubscribe();
  }

  private initializeSocket(name: string): void {
    // Ensure the socket is initialized only once

    this.socket.on('new-participant', (data: any) => {
      console.log("New participant " + data.userId);
    });

    this.socket.on('stream', (data: any) => this.handleIncomingStream(data));

    this.socket.on('existing-participants', (participants: any[]) => {
      participants.forEach(participantData => {
        const existingParticipant = Array.from(this.participants).find(p => p.id === participantData.id);
        if (!existingParticipant) {
        } else {
          Object.assign(existingParticipant, participantData);
        }
      });
    });

    // Emit a signal to the server that the local participant has joined
    this.socket.emit('new-participant', { id: 'local', name });
  }

  private handleIncomingStream(data: any): void {
    const participant = Array.from(this.participants).find(p => p.id === data.userId);
    if (participant) {
      participant.stream = data.stream;
      this.updateParticipantVideos();
    }
  }

  private updateParticipantVideos(): void {
    if (this.participantVideos) {
      this.participantVideos.forEach((elementRef, index) => {
        const videoElement = elementRef.nativeElement;
        const participant = Array.from(this.participants)[index];
        if (participant) {
            videoElement.srcObject = participant.stream;
          } else {
            videoElement.srcObject = null;
          }
          videoElement.play().catch(err => console.error("Error playing video:", err));
      });
    }
  }

  private disconnectUser(): void {
    if (this.socket) {
      this.socket.emit('disconnect');
      this.socket.disconnect();
    }
  }
}
