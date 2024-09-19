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
  private configuration = {
    iceServers: [{urls: 'stun:stun.l.google.com:19302'}]
  };
  private detectionInterval: any;
  private videoEnabled = true;
  private audioEnabled = true;

  @ViewChild('localVideo', {static: false}) localVideo: ElementRef<HTMLVideoElement> | undefined;
  @ViewChildren('participantVideo') participantVideos: QueryList<ElementRef<HTMLVideoElement>> | undefined;
  private recognized: boolean | undefined;
  private isLeader: boolean | undefined;

  constructor(private route: ActivatedRoute, private faceRecognitionService: FaceRecognitionService) {
  }

  /**
   * Initializes the MeetingComponent by retrieving the user ID from the query parameters,
   * starting the local stream, and initializing the socket connection.
   *
   * @remarks
   * This function subscribes to the queryParams of the ActivatedRoute to retrieve the user ID.
   * It then calls the startLocalStream method to initiate the local media stream.
   * If the local stream is successfully started, it initializes the socket connection by calling the initializeSocket method.
   * If an error occurs during the local stream initialization, it logs the error to the console.
   */
  ngOnInit(): void {
    console.log('Initializing MeetingComponent...');
    this.route.queryParams.subscribe(params => {
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

  /**
   * This lifecycle hook is called after Angular has fully initialized all components and directives in a view.
   * It is a good place to perform any post-initialization tasks, such as updating video elements.
   *
   * @remarks
   * This function logs a message to the console indicating that the view has been initialized.
   * It then calls the `updateVideoElements` method to update the video elements in the view.
   */
  ngAfterViewInit(): void {
    console.log('View initialized. Updating video elements...');
    this.updateVideoElements();
  }

  /**
   * Initializes the socket connection for signaling and communication with other participants.
   * Handles various socket events such as connecting, receiving existing participants, offers, answers,
   * ICE candidates, video status updates, and new streams.
   */
  initializeSocket(): void {
    console.log('Initializing socket connection...');
    this.socket = io('http://localhost:3000', {
      transports: ['websocket'],
      withCredentials: false
    });

    this.socket.on('connect', () => {
      console.log('Connected to the signaling server.');
      this.startLocalStream();
    });

    // TODO
    // user recognized

    this.socket.on('existing-participants', (participants: Participant[]) => {
      console.log('Existing participants received:', participants);
      this.participants = participants;
      this.localParticipant = participants.find(p => p.id === this.userId);
      console.log('Local participant:', this.localParticipant);

      if (this.participants.length > 0) {
        const leader = this.participants[0];
        leader.isLeader = true;
        console.log('Leader set to:', leader.id);
      }

      this.participants.forEach(participant => {
        if (participant.id !== this.userId && participant.stream) {
          console.log(`Creating peer connection for participant ${participant.id}`);
          this.createPeerConnection(participant.id, participant.stream);
        }
      });

      this.updateVideoElements();
      this.initializeCapture();
    });

    this.socket.on('offer', (data: { id: string, offer: RTCSessionDescriptionInit }) => {
      console.log('Received offer from participant:', data.id);
      this.handleOffer(data);
    });

    this.socket.on('answer', (data: { id: string, answer: RTCSessionDescriptionInit }) => {
      console.log('Received answer from participant:', data.id);
      this.handleAnswer(data);
    });

    this.socket.on('ice-candidate', (data: { id: string, candidate: RTCIceCandidate }) => {
      console.log('Received ICE candidate from participant:', data.id);
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

    this.socket.on('stream', (data: { id: string, stream: MediaStream }) => {
      console.log('Received new stream from participant:', data.id);
      this.updateRemoteStream(data);
    });

    this.socket.emit('get-participants');
  }

  /**
   * Updates the remote stream for a participant in the meeting.
   *
   * @param data - An object containing the participant's ID and the new stream.
   * @param data.id - The ID of the participant whose stream needs to be updated.
   * @param data.stream - The new stream to be assigned to the participant's video element.
   *
   * @returns {void}
   */
  updateRemoteStream(data: { id: string, stream: MediaStream }): void {
    // Finde das Video-Element für den Teilnehmer mit der ID `data.id`
    const videoElement = this.participantVideos?.find(video => video.nativeElement.id === data.id)?.nativeElement;

    if (videoElement) {
      // Setze den srcObject des Video-Elements auf den empfangenen Stream
      videoElement.srcObject = data.stream;
      videoElement.style.border = '2px solid blue'; // Optional: visuelle Rückmeldung, dass der Stream aktiv ist
      console.log(`Updated stream for participant ID ${data.id}`);
    } else {
      // Warnung, wenn kein Video-Element für diese ID gefunden wurde
      console.warn(`Video element for participant ID ${data.id} not found.`);
    }
  }

  /**
   * Initializes and starts the local media stream for video and audio.
   *
   * @remarks
   * This function attempts to access the user's media devices (video and audio) using the `navigator.mediaDevices.getUserMedia` method.
   * If successful, it assigns the obtained stream to the `localStream` property and sets the source object of the local video element.
   * It then plays the local video element.
   * If an error occurs during the media device access, it logs the error to the console.
   *
   * @returns {Promise<void>} - A promise that resolves when the local stream is successfully started or rejects with an error.
   */
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

  /**
   * Creates a new RTCPeerConnection for a given participant and adds the local stream to it.
   *
   * @param participantId - The ID of the participant for whom the peer connection is being created.
   * @param stream - The local media stream to be added to the peer connection.
   *
   * @remarks
   * This function checks if a peer connection already exists for the given participant ID.
   * If it does, a log message is printed and the function returns early.
   * Otherwise, a new RTCPeerConnection is created with the provided configuration.
   * The local stream's tracks are added to the peer connection.
   * Event listeners are added for ICE candidates and received tracks.
   * An offer is created and sent to the signaling server.
   *
   * @returns {void}
   */
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
        console.log('Sending ICE candidate to signaling server:', event.candidate);
        this.socket?.emit('ice-candidate', {id: participantId, candidate: event.candidate});
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Remote stream received:', event.streams[0]);
      this.participants.forEach(participant => {
        if (participant.id === participantId) {
          participant.stream = event.streams[0];
          this.updateVideoElements();
        }
      });
    };

    peerConnection.createOffer().then((offer) => {
      console.log('Creating offer:', offer);
      return peerConnection.setLocalDescription(offer);
    }).then(() => {
      console.log('Sending offer to signaling server:', peerConnection.localDescription);
      this.socket?.emit('offer', {id: participantId, offer: peerConnection.localDescription});
    });
  }

  /**
   * Handles an offer received from a participant in the meeting.
   *
   * @remarks
   * This function creates a new RTCPeerConnection, adds the local stream's tracks to it,
   * sets up event listeners for ICE candidates and received tracks, creates an answer,
   * and sends it to the signaling server.
   *
   * @param data - An object containing the participant's ID and the received offer.
   * @param data.id - The ID of the participant who sent the offer.
   * @param data.offer - The received offer from the participant.
   *
   * @returns {void}
   */
  handleOffer(data: { id: string, offer: RTCSessionDescriptionInit }): void {
    console.log('Handling offer from participant:', data.id);
    const peerConnection = new RTCPeerConnection(this.configuration);
    this.peerConnections[data.id] = peerConnection;

    this.localStream?.getTracks().forEach(track => {
      console.log('Adding track to peer connection:', track);
      peerConnection.addTrack(track, this.localStream!);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to signaling server:', event.candidate);
        this.socket?.emit('ice-candidate', {id: data.id, candidate: event.candidate});
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Remote stream received:', event.streams[0]);
      this.participants.forEach(participant => {
        if (participant.id === data.id) {
          participant.stream = event.streams[0];
          this.updateVideoElements();
        }
      });
    };

    peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
      .then(() => {
        console.log('Setting remote description and creating answer');
        return peerConnection.createAnswer();
      })
      .then((answer) => {
        console.log('Setting local description with answer:', answer);
        return peerConnection.setLocalDescription(answer);
      })
      .then(() => {
        console.log('Sending answer to signaling server:', peerConnection.localDescription);
        this.socket?.emit('answer', {id: data.id, answer: peerConnection.localDescription});
      });
  }

  /**
   * Handles an answer received from a participant in the meeting.
   *
   * @remarks
   * This function sets the received answer as the remote description of the corresponding
   * RTCPeerConnection.
   *
   * @param data - An object containing the participant's ID and the received answer.
   * @param data.id - The ID of the participant who sent the answer.
   * @param data.answer - The received answer from the participant.
   *
   * @returns {void}
   */
  handleAnswer(data: { id: string, answer: RTCSessionDescriptionInit }): void {
    console.log('Handling answer from participant:', data.id);
    const peerConnection = this.peerConnections[data.id];
    peerConnection?.setRemoteDescription(new RTCSessionDescription(data.answer))
      .catch(error => console.error('Error setting remote description:', error));
  }

  /**
   * Handles an ICE candidate received from a participant in the meeting.
   *
   * @remarks
   * This function adds the received ICE candidate to the corresponding RTCPeerConnection.
   *
   * @param data - An object containing the participant's ID and the received ICE candidate.
   * @param data.id - The ID of the participant who sent the ICE candidate.
   * @param data.candidate - The received ICE candidate from the participant.
   *
   * @returns {void}
   */
  handleIceCandidate(data: { id: string, candidate: RTCIceCandidate }): void {
    console.log('Handling ICE candidate from participant:', data.id);
    const peerConnection = this.peerConnections[data.id];
    peerConnection?.addIceCandidate(new RTCIceCandidate(data.candidate))
      .catch(error => console.error('Error adding ICE candidate:', error));
  }

  /**
   * Updates the video elements in the view with the corresponding streams and video status.
   *
   * @remarks
   * This function checks if the local stream is available and assigns it to the local video element.
   * It then iterates through the participant videos and finds the corresponding participant.
   * If a participant is found, it assigns the participant's stream to the video element and sets the border color based on the video status.
   *
   * @returns {void}
   */
  updateVideoElements(): void {
    if (this.localStream) {
      if (this.localVideo) {
        this.localVideo.nativeElement.srcObject = this.localStream;
      }
    }

    this.participantVideos?.forEach(videoElement => {
      const participant = this.participants.find(p => p.id === videoElement.nativeElement.id);
      if (participant && participant.stream) {
        videoElement.nativeElement.srcObject = participant.stream;
        videoElement.nativeElement.style.border = participant.videoEnabled ? '2px solid blue' : 'none';
      }
    });
  }

  /**
   * Toggles the video status for the current user.
   *
   * @remarks
   * This function toggles the `videoEnabled` property, logs the action,
   * updates the local stream's video tracks, emits an 'update-video-status' event to the signaling server,
   * and updates the video elements in the view.
   *
   * @returns {void}
   */
  toggleVideo(): void {
    this.videoEnabled = !this.videoEnabled;
    console.log('Toggling video:', this.videoEnabled);
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = this.videoEnabled;
      });
    }
    this.socket?.emit('update-video-status', {id: this.userId, videoEnabled: this.videoEnabled});
    this.updateVideoElements();
  }

  /**
   * Toggles the microphone status for the current user.
   *
   * @remarks
   * This function toggles the `audioEnabled` property, logs the action,
   * updates the local stream's audio tracks, emits an 'update-mic-status' event to the signaling server,
   * and updates the audio status of the local participant.
   *
   * @returns {void}
   */
  toggleMic(): void {
    this.audioEnabled = !this.audioEnabled;
    console.log('Toggling microphone:', this.audioEnabled);

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = this.audioEnabled;
      });

      this.socket?.emit('update-mic-status', { id: this.userId, audioEnabled: this.audioEnabled });
    }
  }

  /**
   * Starts the face recognition process for the current user.
   *
   * @remarks
   * This function initializes the face recognition service with the local participant's ID,
  */
   toggleParticipantList() {
    this.showParticipants = !this.showParticipants;
  }


  initializeCapture(): void {
    if (!this.isLeader) {
      console.log('Initialize detection');

      // Initiales Bild prüfen und bei Bedarf aufnehmen
      this.checkAndCaptureImage();
    } else {
      console.log("User is leader, no detection needed");
    }
  }

  private startFaceDetectionInterval(): void {
    // Interval zur Gesichtserkennung einrichten
    this.detectionInterval = setInterval(() => {
      this.performFaceDetection();
    }, 20000); // 20 Sekunden
  }

  private checkAndCaptureImage(): void {
    if (this.faceRecognitionService) {
      console.log("Checking for existing image");
      this.faceRecognitionService.checkImage(this.localParticipant?.id).subscribe({
        next: (data) => {
          if (!data.exists) {
            console.log('No image found, capturing new image.');
            this.captureNewImage();
          } else {
            console.log('Image found, proceeding to face detection.');
            this.startFaceDetectionInterval(); // Startet den Erkennungsintervall, wenn das Bild vorhanden ist
          }
        },
        error: (error) => {
          console.error('Error checking image:', error);
          console.log('Attempting to capture new image due to error.');
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
