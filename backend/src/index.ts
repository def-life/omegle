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

wss.on("connection", (ws) => {
    logger.info("New client connected");
    engine.match(ws)
    ws.on("message", (message) => {
        const payload = JSON.parse(message.toString());
        // TODO: do validation here:
        const {event, roomId, ...rest} = payload as {event: string, description?: string, candidate?: string, roomId: WEBRTCData};

        if(event === WEBRTC_SIGNAL) {
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
