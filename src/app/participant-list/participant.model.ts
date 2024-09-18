
export interface Participant {
  id: string;
  name: string;
  stream: MediaStream,
  videoElement: HTMLVideoElement;
  muted: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  recognized: boolean | null;
  lastChecked: number | null;
  isFirstUser: boolean
}
