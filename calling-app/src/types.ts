export type Message = 
| {event: "room_created", roomId: string, isNegotiator: boolean}
| {event: "webrtc_signal", description?: RTCSessionDescriptionInit, roomId: string, candidate?: RTCIceCandidateInit}