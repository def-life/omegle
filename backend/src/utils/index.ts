import logger from "../logger";
import WebSocket from "ws";

export class Room {
    id: string;
    users: WebSocket[];

    constructor(id: string) {
        this.id = id;
        this.users = [];
    }

    addUsers(...ws: WebSocket[]): void {
        if (this.users.length + ws.length > 2) {
            throw new Error("Cannot add more than 2 users to a room");
        }
        this.users.push(...ws);
    }

    getUsers() {
        return this.users;
    }
}

export class RoomsManager {
    rooms: Map<string, Room>;
    private static instance: RoomsManager;

    private constructor() {
        this.rooms = new Map();
    }
    static getInstance(): RoomsManager {
        if (!RoomsManager.instance) {
            RoomsManager.instance = new RoomsManager();
        }
        return RoomsManager.instance;
    }
    createRoom(id: string): Room {
        const room = new Room(id);
        this.rooms.set(id, room);
        return room;
    }

    getRoom(id: string): Room | undefined {
        return this.rooms.get(id);
    }

    deleteRoom(id: string): boolean {
        return this.rooms.delete(id);
    }
}

export class Engine {
    private queue: WebSocket[];
    private static instance: Engine;
    private roomsManager: RoomsManager = RoomsManager.getInstance();
    private wsToRoomId = new Map<WebSocket, string>();
    private constructor() {
        this.queue = [];
    }

    static getInstance(): Engine {
        if (!Engine.instance) {
            Engine.instance = new Engine();
        }
        return Engine.instance;
    }

    
    private setUpWebSocket(ws: WebSocket): void {
        ws.on("close", () => {
            logger.info("Client disconnected, removing from queue");
            this.queue = this.queue.filter((client) => client !== ws);

            const roomId = this.wsToRoomId.get(ws);
            if(!roomId) {
                return;
            }

            const room = this.roomsManager.rooms.get(roomId);
            if(!room) return;

            this.wsToRoomId.delete(ws);

            const users = room.getUsers();

            users.forEach((user) => {
                if (user.readyState === WebSocket.OPEN && ws != user) {
                    this.wsToRoomId.delete(user);
                    this.match(user)
                    user.send(JSON.stringify({ event: "peer_disconnected" }));
                }
            });

            this.roomsManager.deleteRoom(roomId);
        })

    }


    match(ws: WebSocket): Room | undefined {
        this.setUpWebSocket(ws);
        logger.info("Client connected, adding to queue", { queueLength: this.queue.length });
        this.queue.push(ws);
        if (this.queue.length >= 2) {
            const [user1, user2] = this.queue.splice(0, 2);
            const roomId = `room-${Date.now()}`;
            const room = this.roomsManager.createRoom(roomId);
            room.addUsers(user1, user2);
            this.wsToRoomId.set(user1, roomId);
            this.wsToRoomId.set(user2, roomId);

            logger.info("Room created", {roomId, qlen: this.queue.length});

            // inform both the user room has been created
            [user1, user2].forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        event: "room_created",
                        roomId: roomId,
                        isPolite: client === user1 // first user is the negotiator
                    }));
                }
            });
            return room;
        }

        return undefined;
    }

    signal(ws: WebSocket, payload: { roomId: string, description?: RTCSessionDescriptionInit, candidate?: RTCIceCandidateInit }): void {
        const { roomId, ...data } = payload;
        const room = this.roomsManager.getRoom(payload.roomId);
        if (!room) {
            logger.info(`Room with id ${roomId} does not exist`, { roomId });
            throw new Error(`Room with id ${roomId} does not exist`);
        }
        room.users.forEach((user) => {
            if (user.readyState === WebSocket.OPEN && user !== ws) {
                user.send(JSON.stringify({
                    event: "webrtc_signal",
                    ...data
                }));
            }
        });
    }

    destroyRoom(roomId: string): boolean {
        return this.roomsManager.deleteRoom(roomId);
    }
}

// TOOD: add a cron job cleanng empty rooms or rooms that have not been used for a while

// user joins once room is created