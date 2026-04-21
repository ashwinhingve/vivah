export interface VideoRoom {
  roomId:    string;
  roomName:  string;
  roomUrl:   string;
  token:     string;
  expiresAt: string;
  matchId:   string;
}

export interface MeetingSchedule {
  id:          string;
  matchId:     string;
  proposedBy:  string;
  scheduledAt: string;
  durationMin: number;
  roomUrl:     string | null;
  status:      'PROPOSED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes:       string | null;
}
