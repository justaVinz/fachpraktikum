
export interface Participant {
  id: string;
  name: string;
  videoStream: MediaStreamTrack[];
  audioStream: MediaStreamTrack[];
  muted: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  recognized: boolean | null;
}
