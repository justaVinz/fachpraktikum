import {Component, OnInit, AfterViewInit, ViewChild, ViewChildren, QueryList, ElementRef} from '@angular/core';
import {Participant} from '../participant-list/participant.model';
import {io, Socket} from 'socket.io-client';
import {ActivatedRoute} from '@angular/router';
import {FaceRecognitionService} from '../services/face.recognition.service';

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
  localStream: MediaStream | undefined;
  private peerConnections: { [id: string]: RTCPeerConnection } = {};
  private configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]};
  private detectionInterval: any;
  private videoEnabled = true;
  private audioEnabled = true;

  @ViewChild('localVideo', {static: false}) localVideo: ElementRef | undefined;
  @ViewChildren('participantVideo') participantVideos: QueryList<ElementRef> | undefined;
  private name: any;

  constructor(
    private route: ActivatedRoute,
    private faceRecognitionService: FaceRecognitionService
  ) {
  }

  ngOnInit(): void {
    console.log('Initializing MeetingComponent...');
    this.route.queryParams.subscribe(params => {
      this.name = params['name'];
      this.userId = params['id'];
      console.log('User ID:', this.userId);
      this.startLocalStream().then(() => {
        console.log('Local stream started. Initializing socket...');
        this.initializeSocket();
      }).catch(error => {
        console.error('Error starting local stream:', error);
      });
    });
  }

  ngAfterViewInit(): void {
    console.log('View initialized. Updating video elements...');
    this.updateVideoElements();
  }

  initializeSocket(): void {
    console.log('Initializing socket connection...');
    this.socket = io('http://localhost:3000', {
      transports: ['websocket'],
      withCredentials: false
    });

    this.socket.on('connect', () => {
      console.log('Connected to the signaling server.');
      this.socket?.emit('new-participant', {
        id: this.userId,
        name: this.name,
        videoEnabled: this.videoEnabled,
        audioEnabled: this.audioEnabled
      });
    });

    this.socket.on('offer', (data: { from: string, offer: RTCSessionDescriptionInit }) => {
      console.log('Received offer from participant:', data.from);
      this.handleOffer(data);
    });

    this.socket.on('answer', (data: { from: string, answer: RTCSessionDescriptionInit }) => {
      console.log('Received answer from participant:', data.from);
      this.handleAnswer(data);
    });

    this.socket.on('ice-candidate', (data: { from: string, candidate: RTCIceCandidateInit }) => {
      console.log('Received ICE candidate from participant:', data.from);
      this.handleIceCandidate(data);
    });

    this.socket.on('update-video-status', (data: { id: string, videoEnabled: boolean }) => {
      console.log('Received video status update from participant:', data.id);
      const participant = this.participants.find(p => p.id === data.id);
      if (participant) {
        participant.videoEnabled = data.videoEnabled;
        this.updateVideoElements();
      }
    });

    this.socket.on('update-mic-status', (data: { id: string, audioEnabled: boolean }) => {
      console.log('Received mic status update from participant:', data.id);
      const participant = this.participants.find(p => p.id === data.id);
      if (participant) {
        participant.audioEnabled = data.audioEnabled;
      }
    });

    this.socket.on('recognition-update', (data: { id: string, recognized: boolean }) => {
      const participant = this.participants.find(p => p.id === data.id);
      if (participant) {
        participant.recognized = data.recognized;
      }
    });

    this.socket.on('get-participants', (participants: Participant[]) => {
      if (!this.localParticipant) {
        this.localParticipant = participants.find(p => p.id === this.userId);
        this.participants.push(this.localParticipant!);
        console.log("set local participant");
        console.log(this.localParticipant);
      }
      console.log('Updated participants list received:', participants);
      participants.forEach(participant => {
        if (participant.id !== this.userId && !this.peerConnections[participant.id]) {
          console.log(`Creating peer connection for participant ${participant.id}`);
          if (!this.participants.find(p => p.id === participant.id)) {
            this.participants.push(participant);
          }
          if (!this.peerConnections[participant.id]) {
            console.log(`Creating peer connection for participant ${participant.id}`);
            this.createPeerConnection(participant.id);
          }
        }
      });

      this.updateVideoElements();
      this.initializeCapture();
    });
  }

  async startLocalStream(): Promise<void> {
    try {
      console.log('Accessing media devices...');
      const stream = await navigator.mediaDevices.getUserMedia({video: this.videoEnabled, audio: this.audioEnabled});
      console.log('Local stream:', stream);
      this.localStream = stream;
      if (this.localVideo?.nativeElement) {
        this.localVideo.nativeElement.srcObject = stream;
        await this.localVideo.nativeElement.play();
        console.log('Local video is playing');
      }
    } catch (error) {
      console.error('Error accessing media devices.', error);
    }
  }

  createPeerConnection(participantId: string): void {
    if (this.peerConnections[participantId]) {
      console.log(`Peer connection already exists for participant ${participantId}`);
      return;
    }

    console.log(`Creating new peer connection for participant ${participantId}`);
    const peerConnection = new RTCPeerConnection(this.configuration);
    this.peerConnections[participantId] = peerConnection;

    this.localStream?.getTracks().forEach(track => {
      console.log('Adding track to peer connection:', track);
      peerConnection.addTrack(track, this.localStream!);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Test");
        console.log('Sending ICE candidate to signaling server:', event.candidate);
        this.socket?.emit('ice-candidate', {from: this.userId, to: participantId, candidate: event.candidate});
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Remote stream received:', event.streams[0]);
      const participant = this.participants.find(p => p.id === participantId);
      if (participant) {
        participant.stream = event.streams[0];
        this.updateVideoElements();
      }
    };

    peerConnection.createOffer().then((offer) => {
      console.log('Creating offer:', offer);
      return peerConnection.setLocalDescription(offer);
    }).then(() => {
      console.log('Sending offer to signaling server:', peerConnection.localDescription);
      this.socket?.emit('offer', {from: this.userId, to: participantId, offer: peerConnection.localDescription});
    });
  }

  handleOffer(data: { from: string, offer: RTCSessionDescriptionInit }): void {
    console.log('Handling offer from participant:', data.from);
    const peerConnection = new RTCPeerConnection(this.configuration);
    this.peerConnections[data.from] = peerConnection;

    this.localStream?.getTracks().forEach(track => {
      console.log('Adding track to peer connection:', track);
      peerConnection.addTrack(track, this.localStream!);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to signaling server:', event.candidate);
        this.socket?.emit('ice-candidate', {from: this.userId, to: data.from, candidate: event.candidate});
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Remote stream received:', event.streams[0]);
      const participant = this.participants.find(p => p.id === data.from);
      if (participant) {
        participant.stream = event.streams[0];
        this.updateVideoElements();
      }
    };

    peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer)).then(() => {
      console.log('Setting remote description and creating answer');
      return peerConnection.createAnswer();
    }).then((answer) => {
      console.log('Setting local description with answer:', answer);
      return peerConnection.setLocalDescription(answer);
    }).then(() => {
      console.log('Sending answer to signaling server:', peerConnection.localDescription);
      this.socket?.emit('answer', {from: this.userId, to: data.from, answer: peerConnection.localDescription});
    });
  }

  handleAnswer(data: { from: string, answer: RTCSessionDescriptionInit }): void {
    console.log('Handling answer from participant:', data.from);
    const peerConnection = this.peerConnections[data.from];
    peerConnection?.setRemoteDescription(new RTCSessionDescription(data.answer))
      .catch(error => console.error('Error setting remote description:', error));
  }

  handleIceCandidate(data: { from: string, candidate: RTCIceCandidateInit }): void {
    console.log('Handling ICE candidate from participant:', data.from);
    const peerConnection = this.peerConnections[data.from];
    if (peerConnection) {
      peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
        .then(() => {
          console.log('ICE candidate added successfully.');
        })
        .catch(error => {
          console.error('Error adding ICE candidate:', error);
        });
    }
  }

  updateVideoElements(): void {
    if (this.localStream && this.localVideo) {
      this.localVideo.nativeElement.srcObject = this.localStream;
    }
    this.participantVideos?.forEach(videoElement => {
      const participant = this.participants.find(p => p.id === videoElement.nativeElement.id);
      if (participant && participant.stream) {
        videoElement.nativeElement.srcObject = participant.stream;
        videoElement.nativeElement.style.border = participant.videoEnabled ? '2px solid blue' : 'none';
      }
    });
  }

  toggleVideo(): void {
    this.videoEnabled = !this.videoEnabled;
    console.log('Toggling video:', this.videoEnabled);
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = this.videoEnabled;
      });
      this.socket?.emit('update-video-status', {id: this.userId, videoEnabled: this.videoEnabled});
      this.updateVideoElements();
    }
  }

  toggleMic(): void {
    this.audioEnabled = !this.audioEnabled;
    console.log('Toggling microphone:', this.audioEnabled);
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = this.audioEnabled;
      });
      this.socket?.emit('update-mic-status', {id: this.userId, audioEnabled: this.audioEnabled});
    }
  }

  toggleParticipantList() {
    this.showParticipants = !this.showParticipants;
  }

  initializeCapture(): void {
    if (!this.localParticipant?.isLeader) {
      console.log('Initialize detection');
      this.checkAndCaptureImage();
    } else {
      console.log("User is leader, no detection needed");
    }
  }

  private startFaceDetectionInterval(): void {
    this.detectionInterval = setInterval(() => {
      this.performFaceDetection();
    }, 20000); // 20 seconds
  }

  private checkAndCaptureImage(): void {
    if (this.faceRecognitionService) {
      console.log("Checking for existing image");
      this.faceRecognitionService.checkImage(this.localParticipant?.id).subscribe({
        next: async (data) => {
          if (!data.exists) {
            console.log('No image found, capturing new image.');
            this.captureNewImage();
          } else {
            console.log('Image found, proceeding to face detection.');
            this.startFaceDetectionInterval();
          }
        },
        error: (error) => {
          console.error('No image found:', error);
          console.log('capturing new image for user');
          this.captureNewImage();
        }
      });
    }
  }

  private captureNewImage(): void {
    this.faceRecognitionService.captureImage(this.localParticipant?.id).subscribe({
      next: () => {
        console.log('Image captured successfully.');
        this.startFaceDetectionInterval(); // Startet den Erkennungsintervall nach dem Aufnehmen eines neuen Bildes
      },
      error: (error) => {
        console.error('Error capturing image:', error);
        console.log('Attempting to capture new image.');
        this.captureNewImage();
      }
    });
  }

  private performFaceDetection(): void {
    if (this.localParticipant) {
      console.log('Performing face detection');
      this.faceRecognitionService.detectFace(this.localParticipant?.id).subscribe({
        next: (data) => {
          if (this.localParticipant) {
            this.localParticipant.recognized = data.recognized;
            console.log(this.localParticipant.recognized);
            if (this.socket) {
              this.socket.emit('user-recognized', {
                id: this.userId,
                recognized: this.localParticipant.recognized || false
              });
            }
            console.log('Face detection result sent to leader');
          }
        },
        error: (error) => {
          console.error('Error detecting face:', error);
        }
      });
    }
  }
}
