export const vars = {
    SIGNALLING_SERVER: "ws://localhost:3000/webrtc",
    // SIGNALLING_SERVER: "wss://192.168.29.106:3000/webrtc",
    PEERCONFIGURATION: {
        iceServers: [
            {
                urls: "stun:stun.l.google.com:19302"
            }
        ]
    },
    MEDIA_CONSTRAINTS: {
        audio: true,
        video: true
    },


}