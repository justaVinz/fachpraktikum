
export interface Participant {
  id: string;
  name: string;
  videoStream: MediaStream;
  muted: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  recognized: boolean | null;
}
