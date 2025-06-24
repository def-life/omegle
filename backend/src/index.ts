import express from "express";
import { vars } from "./config";
import WebSocket from "ws";
import cors from "cors";
import logger from "./logger";
import { WEBRTCData } from "./types";
import { WEBRTC_SIGNAL } from "./events";
import { Engine } from "./utils";

const app = express();
const port = vars.PORT;

app.use(cors({
    origin: "*"
}));

app.get("/", (req, res) => {
    res.send("WebRTC Signaling Server is running"); 
});

const httpServer = app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
});


const wss = new WebSocket.Server({ server: httpServer, path: "/webrtc" });

const engine = Engine.getInstance();

// let room: WebSocket[] = [];
// const roomId = "default-room"; // This can be dynamic based on your requirements
wss.on("connection", (ws) => {
    logger.info("New client connected");
    // if(room.length >= 2) {
    //     room = []
    // }
    // room.push(ws);
    // if(room.length === 2) {
    //     room.forEach((client) => {
    //         if(client.readyState === WebSocket.OPEN) {
    //             client.send(JSON.stringify({
    //                 event: "room_created",
    //                 roomId: roomId,
    //             }));
    //         }
    //     });
    //     logger.info("Room created with 2 clients", {roomId});
    // }
    // logger.info("client connected", {length: room.length});

    engine.match(ws)
    ws.on("message", (message) => {
        const payload = JSON.parse(message.toString());
        // TODO: do validation here:
        const {event, roomId, ...rest} = payload as {event: string, description?: string, candidate?: string, roomId: WEBRTCData};

        if(event === WEBRTC_SIGNAL) {
            // proxy the signal to other clients in the room
            // room.forEach((client) => {
            //     if(client !== ws && client.readyState === WebSocket.OPEN) {
            //         logger.info("Sending signal to other client:");
            //         client.send(JSON.stringify({
            //             event: WEBRTC_SIGNAL,
            //             ...rest
            //         }));
            //     }
            // })

            engine.signal(ws, payload)

        } else {
            logger.info("Unknown event type received:", event);
        }


    });

    ws.on("close", () => {
        logger.info("Client disconnected");
    });

    ws.on('error',(err) => {
        logger.error("WebSocket error occurred:", err);
        if(ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
            ws.close();
        }
    })
})

// TODO: on connectin close event, delete room
/**
 * 
 * 
 * user.on("close", () => {
                // Clean up on disconnect
                this.users.forEach(u => {
                    if (u !== user && u.readyState === WebSocket.OPEN) {
                        u.send(JSON.stringify({ event: "peer_disconnected" }));
                        u.close(); // Optionally close peer's connection too
                    }
                });
                RoomsManager.getInstance().deleteRoom(this.id);
            });
        });
 */