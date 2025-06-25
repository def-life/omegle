import { useEffect, useRef, useState } from "react";
import "webrtc-adapter";
import { vars } from "./config";

// NOTE: IF things get complex, create singnaling server class.

export default function App() {
  const remoteView = useRef<HTMLVideoElement | null>(null);
  const localView = useRef<HTMLVideoElement | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [roomId, setRoomId] = useState("");
  const [isPolite, setIsPolite] = useState(false);
  const makingOfferRef = useRef(false);
  const [cameraAdded, setCameraAdded] = useState(false)
  const [enableAudio, setEnableAudio] = useState(true);
  const [showVideo, setShowVideo] = useState(true);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [messages, setMessages] = useState<{ message: string, sender: "you" | "other" }[]>([]) // keep last 40 messages;
  const typedAreaRef = useRef<HTMLTextAreaElement | null>(null);


  // TODO: apply useMemo here
  async function handleMic() {
    if (localView.current && localView.current.srcObject instanceof MediaStream) {
      const audioTracks = localView.current.srcObject.getAudioTracks();
      for (let track of audioTracks) {
        track.enabled = !enableAudio;
      }
      setEnableAudio(!enableAudio);
    }
  }

  async function handleCamera() {
    if (localView.current && localView.current.srcObject instanceof MediaStream) {
      const videoTracks = localView.current.srcObject.getVideoTracks();
      for (let track of videoTracks) {
        track.enabled = !showVideo;
      }
      setShowVideo(!showVideo)
    }
  }

  async function addCameraMic() {
    if (!pc.current || !localView.current) {
      console.error("Peer connection or local view not initialized");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(vars.MEDIA_CONSTRAINTS);
      for (const track of stream.getTracks()) {
        pc.current.addTrack(track, stream);
      }
      localView.current.srcObject = stream;
      setCameraAdded(true)

    } catch (err) {
      console.error("Error accessing media devices:", err);
    }

  }

  useEffect(() => {
    if (cameraAdded) {
      wsRef.current = new WebSocket(vars.SIGNALLING_SERVER);
      return () => {
        wsRef.current?.close();
      };

    }
  }, [cameraAdded]);

  useEffect(() => {

    if (!wsRef.current) {
      return;
    }
    const socket = wsRef.current;

    socket.onopen = () => {
      console.log("WebSocket connection established");
    };
    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.event === "room_created") {
        setRoomId(data.roomId)
        setIsPolite(data.isPolite);
      } else if (data.event === "webrtc_signal") {
        if (!pc.current) {
          console.error("Peer connection not initialized");
          return;
        }

        const { description, candidate } = data;
        if (description) {
          if (description.type === "offer") {

            const isOfferCollision = makingOfferRef.current || (pc.current.signalingState !== "stable");

            const ignoreOffer = !isPolite && isOfferCollision;

            if (ignoreOffer) {
              return;
            }

            await pc.current.setRemoteDescription(new RTCSessionDescription(description));
            const answer = await createAnswer();
            if (answer === undefined) {
              console.error("Failed to create answer");
              return;
            }
            socket.send(JSON.stringify({
              event: "webrtc_signal",
              description: answer,
              roomId
            }));
          } else if (description.type === "answer") {
            pc.current.setRemoteDescription(new RTCSessionDescription(description));
          }
        }
        if (candidate) {
          try {
            pc.current.addIceCandidate(new RTCIceCandidate(candidate));

          } catch (err) {
            console.error("addCandidate error")
          }
        }
      }
    };
    wsRef.current.onclose = () => {
      console.log("WebSocket connection closed");
    };
  }, [pc.current, wsRef.current, roomId]);



  useEffect(() => {
    const peerConnection = pc.current = new RTCPeerConnection(vars.PEERCONFIGURATION);
    addCameraMic();

    return () => {
      peerConnection.close();
      pc.current = null;
      dataChannelRef.current = null;
      setMessages([])
    }

  }, [roomId]);

  useEffect(() => {
    if (!pc.current || !wsRef.current || !remoteView.current || !localView.current) {
      return;
    }

    const peerConnection = pc.current;

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          event: "webrtc_signal",
          candidate: event.candidate,
          roomId
        }));
      }
    };

    peerConnection.ondatachannel = (event) => {
      const channel = event.channel;

      channel.onopen = () => {
        console.log("Data Channel open");
      };

      channel.onmessage = (event) => {
        setMessages((messages) => {
          return [...messages, { message: event.data, sender: "other" }]
        })
      };

      channel.onclose = () => {
        console.log("data channel closed");
      };

      // You can store it in another ref if you want to send messages
      dataChannelRef.current = channel;
    }

    peerConnection.onnegotiationneeded = async () => {
      if (!pc.current || !wsRef.current) {
        console.error("Peer connection or WebSocket not initialized");
        return;
      }

      if (pc.current.signalingState !== "stable") {
        console.warn("Signaling state is not stable, skipping offer creation");
        return;
      }

      if (!isPolite) {
        console.warn("dddd, Not the negotiator, skipping offer creation,", roomId);
        return;
      }
      try {
        makingOfferRef.current = true
        await createOffer();
      } catch (err) {
        console.error(err);
      } finally {
        makingOfferRef.current = false
      }
    };

    peerConnection.oniceconnectionstatechange = (e) => {
      console.log(e)
    }

    peerConnection.ontrack = (e) => {
      if (remoteView.current) {
        remoteView.current.srcObject = e.streams[0];
      } else {
        console.error("Remote view not initialized");
      }
    }
  }, [roomId, isPolite]);

  async function createOffer() {
    if (!pc.current || (!wsRef.current)) {
      console.error("Peer connection or WebSocket not initialized");
      return;
    }

    if (wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not open");
      return;
    }

    if (!roomId) {
      console.error("Room ID is not set");
      return;
    }

    if (!dataChannelRef.current) {
      const dataChannel = pc.current.createDataChannel("chat");
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        console.log("channel open")
      }

      dataChannel.onclose = () => {
        console.log('channel close')
      }

      // create a single messageHandler
      dataChannel.onmessage = (event) => {
        console.log("received message", event.data)
        setMessages((messages) => {
          return [...messages, { message: event.data, sender: "other" }]
        })
      }
    }

    const socket = wsRef.current;

    const offer = await pc.current.createOffer();
    pc.current.setLocalDescription(offer);

    socket.send(JSON.stringify({ event: "webrtc_signal", description: offer, roomId }));

  }

  async function createAnswer() {
    if (!pc.current) {
      console.error("Peer connection not initialized");
      return;
    }

    const answer = await pc.current.createAnswer();
    pc.current.setLocalDescription(answer);
    return answer;

  }

  function sendMessage() {
    if (!typedAreaRef.current || !dataChannelRef.current) return;
    const message = typedAreaRef.current.value;

    if (message) {
      setMessages((messages) => {
        return [...messages, { message, sender: "you" }]
      })
      dataChannelRef.current.send(message)
    }

    typedAreaRef.current.value = "";
  }

  return (
    <div className="App">
      {!roomId && <h3>Waiting for room to be created...</h3>}
      {roomId && <h3>Room ID: {roomId}</h3>}
      <video style={{ width: 300, height: 300, background: 'black', margin: 5 }} ref={localView} autoPlay playsInline muted></video>
      <video style={{ width: 300, height: 300, background: 'black', margin: 5 }} ref={remoteView} autoPlay playsInline></video>
      <br />
      <button onClick={handleMic}>{enableAudio ? "mute" : "unmute"}</button>
      <button onClick={handleCamera}>{showVideo ? "hide video" : "show video"}</button>
      <br />
      <textarea
        ref={typedAreaRef}
        rows={5}
        cols={40}
        placeholder="Type something..."
      />     
      <br /> 
      
      <button onClick={sendMessage}>send message</button>
      <div>
        {messages.map(({ sender, message }) => {
          return <div ><span>{sender}: </span><span>{message}</span></div>
        })}
      </div>

    </div>
  );
}

// avoid offer collisions.