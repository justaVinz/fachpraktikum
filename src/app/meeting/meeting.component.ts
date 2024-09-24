import {Component, OnInit, AfterViewInit, ViewChild, ViewChildren, QueryList, ElementRef} from '@angular/core';
import {Participant} from '../participant/participant.model';
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
  detectionInterval: any;
  localParticipant: Participant | undefined;
  socket: Socket | undefined;
  localStream: MediaStream | undefined;
  private peerConnections: { [id: string]: RTCPeerConnection } = {};
  private configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]};
  private videoEnabled = false;
  private audioEnabled = true;

  @ViewChild('localVideo', {static: false}) localVideo: ElementRef | undefined;
  @ViewChildren('participantVideo') participantVideos: QueryList<ElementRef> | undefined;
  private name: any;

  constructor(
    private route: ActivatedRoute,
    private faceRecognitionService: FaceRecognitionService
  ) {
  }

    /**
   * Initializes the MeetingComponent by retrieving the user's name and ID from the query parameters,
   * starting the local stream, and initializing the socket connection.
   *
   * @remarks
   * This function subscribes to the queryParams observable of the ActivatedRoute to retrieve the user's name and ID.
   * It then calls the startLocalStream function to start the local stream and initializes the socket connection.
   * If an error occurs while starting the local stream, it logs the error to the console.
   */
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

    /**
   * This lifecycle hook is called after Angular has fully initialized all components and directives in a view.
   * It is called after the `ngOnInit` method on all child components/directives.
   *
   * This hook is useful for performing any post-initialization tasks, such as updating video elements.
   *
   * @remarks
   * In this function, the `updateVideoElements` method is called to ensure that the video elements are up-to-date
   * after the view has been initialized.
   */
  ngAfterViewInit(): void {
    console.log('View initialized. Updating video elements...');
    this.updateVideoElements();
  }

    /**
   * Initializes the socket connection for signaling and event handling.
   *
   * @remarks
   * This function establishes a WebSocket connection to the signaling server at 'http://localhost:3000'.
   * It sets up event listeners for various signaling events, such as 'connect', 'offer', 'answer', 'ice-candidate',
   * 'update-video-status', 'update-mic-status', 'recognition-update', and 'get-participants'.
   *
   * @param {void} - This function does not return any value.
   */
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

    /**
   * Initializes and starts the local media stream for video and audio.
   *
   * @remarks
   * This function uses the `navigator.mediaDevices.getUserMedia` method to request access to the user's media devices.
   * It then creates a new `MediaStream` object and assigns it to the `localStream` property of the component.
   * If the `localVideo` element is available, it sets the `srcObject` property to the local stream and plays the video.
   * If an error occurs during the process, it logs the error to the console.
   *
   * @returns {Promise<void>} - A promise that resolves when the local stream has been successfully started.
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
   * Creates a new RTCPeerConnection for a given participant and sets up event listeners for ICE candidates and tracks.
   *
   * @param participantId - The ID of the participant for whom the peer connection should be created.
   *
   * @remarks
   * This function checks if a peer connection already exists for the given participant. If not, it creates a new
   * RTCPeerConnection, adds the local stream's tracks to the peer connection, and sets up event listeners for ICE candidates
   * and tracks. It then sends an offer to the signaling server and waits for an answer.
   *
   * @returns {void} - This function does not return any value.
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

    /**
   * Handles an incoming offer from a participant.
   *
   * @remarks
   * This function sets up a new RTCPeerConnection, adds the local stream's tracks to the peer connection,
   * sets up event listeners for ICE candidates and tracks, and sends an answer to the signaling server.
   *
   * @param data - An object containing the participant's ID and the offer.
   * @param data.from - The ID of the participant who sent the offer.
   * @param data.offer - The RTCSessionDescriptionInit object representing the offer.
   *
   * @returns {void} - This function does not return any value.
   */
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

    /**
   * Handles an incoming answer from a participant.
   *
   * @remarks
   * This function sets the remote description of the RTCPeerConnection associated with the participant
   * using the provided answer. If an error occurs during the process, it logs the error to the console.
   *
   * @param data - An object containing the participant's ID and the answer.
   * @param data.from - The ID of the participant who sent the answer.
   * @param data.answer - The RTCSessionDescriptionInit object representing the answer.
   *
   * @returns {void} - This function does not return any value.
   */
  handleAnswer(data: { from: string, answer: RTCSessionDescriptionInit }): void {
    console.log('Handling answer from participant:', data.from);
    const peerConnection = this.peerConnections[data.from];
    peerConnection?.setRemoteDescription(new RTCSessionDescription(data.answer))
      .catch(error => console.error('Error setting remote description:', error));
  }

    /**
   * Handles an incoming ICE candidate from a participant.
   *
   * @remarks
   * This function adds the received ICE candidate to the RTCPeerConnection associated with the participant.
   * If an error occurs during the process, it logs the error to the console.
   *
   * @param data - An object containing the participant's ID and the ICE candidate.
   * @param data.from - The ID of the participant who sent the ICE candidate.
   * @param data.candidate - The RTCIceCandidateInit object representing the ICE candidate.
   *
   * @returns {void} - This function does not return any value.
   */
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

    /**
   * Updates the video elements in the meeting room.
   *
   * This function sets the source object of the local video element to the local stream,
   * and updates the source object and border style of each participant's video element.
   *
   * @remarks
   * - If the local stream is available and the local video element exists, the source object of the local video element
   *   is set to the local stream.
   * - For each participant's video element, if the participant's stream is available, the source object of the video element
   *   is set to the participant's stream, and the border style is set based on the participant's video status.
   *
   * @returns {void} - This function does not return any value.
   */
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

    /**
   * Toggles the video status of the local participant.
   *
   * This function enables or disables the video track of the local stream based on the current video status.
   * It then sends an 'update-video-status' event to the signaling server with the updated video status.
   * Finally, it updates the video elements in the meeting room.
   *
   * @returns {void} - This function does not return any value.
   */
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

    /**
   * Toggles the microphone status of the local participant.
   *
   * This function enables or disables the audio track of the local stream based on the current audio status.
   * It then sends an 'update-mic-status' event to the signaling server with the updated audio status.
   *
   * @returns {void} - This function does not return any value.
   */
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

   /**
   * Toggles the visibility of the participant list in the meeting room.
   *
   * @remarks
   * This function is called when the user clicks on a button to toggle the visibility of the participant list.
   * It toggles the `showParticipants` property, which determines whether the participant list is visible or hidden.
   *
   * @returns {void} - This function does not return any value.
   */
  toggleParticipantList(): void {
    this.showParticipants = !this.showParticipants;
  }

    /**
   * Initializes and starts the image capture process for face recognition.
   *
   * This function checks if the current user is a participant and not the leader.
   * If the user is a participant, it logs a message indicating the initialization of detection.
   * Then, it calls the `checkAndCaptureImage` function to check for an existing image and capture a new one if necessary.
   * If the user is the leader, it logs a message indicating that no detection is needed.
   *
   * @returns {void} - This function does not return any value.
   */
  initializeCapture(): void {
    if (!this.localParticipant?.isLeader) {
      console.log('Initialize detection');
      this.checkAndCaptureImage();
    } else {
      console.log("User is leader, no detection needed");
    }
  }

    /**
   * Initializes and starts the image capture process for face recognition.
   * This function checks if the current user is a participant and not the leader.
   * If the user is a participant, it logs a message indicating the initialization of detection.
   * Then, it calls the `checkAndCaptureImage` function to check for an existing image and capture a new one if necessary.
   * If the user is the leader, it logs a message indicating that no detection is needed.
   *
   * @returns {void} - This function does not return any value.
   */
  private startFaceDetectionInterval(): void {
    this.detectionInterval = setInterval(() => {
      this.performFaceDetection();
    }, 20000); // 20 seconds
  }

    /**
   * Initializes and starts the image capture process for face recognition.
   *
   * @remarks
   * This function checks if the `faceRecognitionService` is available. If it is, it logs a message indicating the
   * process of checking for an existing image. Then, it subscribes to the `checkImage` method of the
   * `faceRecognitionService` to check for an existing image of the local participant.
   *
   * If no image is found, it logs a message indicating the need to capture a new image and calls the
   * `captureNewImage` method. If an image is found, it logs a message indicating the start of face detection and
   * calls the `startFaceDetectionInterval` method.
   *
   * If the `faceRecognitionService` is not initialized, it logs an error message indicating the issue.
   *
   * @returns {void} - This function does not return any value.
   */
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
          console.error('Error checking for existing image:', error);
          console.log('Attempting to capture new image.');
          this.captureNewImage();
        }
      });
    } else {
      console.error('FaceRecognitionService is not initialized.');
    }
  }

    /**
   * Captures a new image of the local participant and starts the face detection interval.
   *
   * @remarks
   * This function checks if the local participant ID is defined. If not, it logs an error message and returns.
   * Then, it calls the `captureImage` method of the `faceRecognitionService` to capture a new image.
   * If the image is captured successfully, it logs a message and starts the face detection interval.
   * If an error occurs during the image capture process, it logs the error and a message indicating that
   * retrying the capture may not solve the issue.
   *
   * @returns {void} - This function does not return any value.
   */
  private captureNewImage(): void {
    if (!this.localParticipant?.id) {
      console.error('Cannot capture image, localParticipant ID is undefined.');
      return;
    }

    this.faceRecognitionService.captureImage(this.localParticipant.id).subscribe({
      next: () => {
        console.log('Image captured successfully.');
        this.startFaceDetectionInterval();
      },
      error: (error) => {
        console.error('Error capturing image:', error);
        console.log('Error occurred, retrying capture may not solve the issue.');
      }
    });
  }

    /**
   * Performs face detection on the local participant's image.
   *
   * This function checks if the local participant ID is defined. If not, it logs an error message and returns.
   * Then, it logs a message indicating the start of face detection.
   * It subscribes to the `detectFace` method of the `faceRecognitionService` to detect faces in the local participant's image.
   * If the face is detected successfully, it updates the `recognized` property of the local participant and logs the result.
   * If the socket is initialized, it emits an 'user-recognized' event with the local participant's ID and the recognized status.
   * If the socket is not initialized, it logs a warning message.
   * If an error occurs during the face detection process, it logs the error.
   *
   * @returns {void} - This function does not return any value.
   */
  private performFaceDetection(): void {
    if (!this.localParticipant?.id) {
      console.error('Cannot perform face detection, localParticipant ID is undefined.');
      return;
    }

    console.log('Performing face detection');

    this.faceRecognitionService.detectFace(this.localParticipant.id).subscribe({
      next: (data) => {
        if (this.localParticipant) {
          this.localParticipant.recognized = data.recognized;
          console.log('Face detection result:', this.localParticipant.recognized);

          if (this.socket) {
            this.socket.emit('user-recognized', {
              id: this.userId,
              recognized: this.localParticipant.recognized || false
            });
          } else {
            console.warn('Socket is not initialized.');
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
