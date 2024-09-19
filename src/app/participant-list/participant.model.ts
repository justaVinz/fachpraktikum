export interface Participant {
  id: string;
  name: string;
  stream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  muted: boolean;
  recognized: boolean;
  isFirstUser: boolean;
}
