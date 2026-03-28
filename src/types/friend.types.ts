import { User } from "./user.types.ts";

export interface FriendRequest {
	sender_id: number;
	receiver_id: number;
	created_at: Date;
}

export interface Friendship {
	user_id: number;
	friend_id: number;
	created_at: Date;
}

export interface SentRequest {
	sender_id: number;
	created_at: Date;
	receiver: User;
}

export interface ReceivedRequest {
	receiver_id: number;
	created_at: Date;
	sender: User;
}

export interface RequestActionParams {
	senderId: number;
	receiverId: number;
	userInternalId: number;
	accept: boolean;
}