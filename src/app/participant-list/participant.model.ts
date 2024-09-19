export interface Participant {
  id: string;
  name: string;
  stream: MediaStream,
  videoEnabled: boolean;
  audioEnabled: boolean;
  muted: boolean;
  recognized: boolean;
  lastChecked: number | null;
  isFirstUser: boolean;
}
