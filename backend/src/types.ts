enum EventType {
    ROOM_CREATED = "room_created",
    ROOM_JOINED = "room_joined",
    ROOM_CLOSED = "room_closed",
    WEBRTC_SIGNAL = "webrtc_signal"
}

export interface WEBRTCData {
  description?: string;
  candidate?: string;
  roomId: string;
}


export type RoomEvent = {
  roomId: string;
  event: EventType;
}