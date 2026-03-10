import db from "../database/client.ts";
import { and, eq, or } from "drizzle-orm";
import { usersTable } from "../database/schemas/users.ts";
import { friendsTable } from "../database/schemas/friends.ts";
import { friendRequestsTable } from "../database/schemas/friendRequests.ts";
import { APIError } from "../errors/api.error.ts";
import { STATUS_CODES } from "../lib/constants.ts";
import { alias } from "drizzle-orm/pg-core";

/**
 *	Retrieves the internal ids of all friends of the user
 */
export async function getAllFriendsOfUser(userId: string) {
	const friendTable = alias(usersTable, "friend");

	return db!
		.select({
			internal_id: friendTable.internal_id,
			id: friendTable.id,
			full_name: friendTable.full_name,
			email: friendTable.email,
			avatar_url: friendTable.avatar_url,
		})
		.from(usersTable)
		.innerJoin(
			friendsTable,
			or(
				eq(friendsTable.user_id, usersTable.internal_id),
				eq(friendsTable.friend_id, usersTable.internal_id),
			),
		)
		.innerJoin(
			friendTable,
			or(
				and(
					eq(friendsTable.user_id, usersTable.internal_id),
					eq(friendTable.internal_id, friendsTable.friend_id),
				),
				and(
					eq(friendsTable.friend_id, usersTable.internal_id),
					eq(friendTable.internal_id, friendsTable.user_id),
				),
			),
		)
		.where(eq(usersTable.id, userId));
}

/**
 *	Send friend request to a user
 */
export async function sendFriendRequestToUser(
	fromId: string,
	toIdentifier: string,
) {
	// Check if the identified is an email or ID
	const isEmail = toIdentifier.includes("@");

	// Quick check to see if the user is sending a request to themselves
	if (!isEmail && fromId === toIdentifier)
		throw new APIError(STATUS_CODES.BAD_REQUEST, "You are sending a request to yourself");

	// Get the internal IDs of the user and the receiver
	const users = await db!
		.select({
			id: usersTable.id,
			email: usersTable.email,
			internal_id: usersTable.internal_id,
		})
		.from(usersTable)
		.where(
			or(
				eq(usersTable.id, fromId),
				isEmail
					? eq(usersTable.email, toIdentifier)
					: eq(usersTable.id, toIdentifier),
			),
		)
		.limit(2);

	// Get the row containing sender and receiver
	const from = users.find((u) => u.id === fromId);
	const to = isEmail
		? users.find((u) => u.email === toIdentifier)
		: users.find((u) => u.id === toIdentifier);

	// If in case receiver doesn't exist then throw error
	if (!to) throw new APIError(STATUS_CODES.NOT_FOUND, "User not found");

	// Check if user is sending a request to themself
	// extra check in case the identifier provided is an email
	if (to.internal_id === from!.internal_id)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"You cannot send a request to yourself",
		);

	// Check if there is already a request in the db
	// Checking both ways to ensure neither have sent a request
	// to each other
	const [existingRequest] = await db!
		.select()
		.from(friendRequestsTable)
		.where(
			or(
				and(
					eq(friendRequestsTable.sender_id, from!.internal_id),
					eq(friendRequestsTable.receiver_id, to.internal_id),
				),
				and(
					eq(friendRequestsTable.sender_id, to.internal_id),
					eq(friendRequestsTable.receiver_id, from!.internal_id),
				),
			),
		)
		.limit(1);

	if (existingRequest)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"Friend request already exists",
		);

	// Checking if the users are friends already
	const [existingFriendship] = await db!
		.select()
		.from(friendsTable)
		.where(
			or(
				and(
					eq(friendsTable.user_id, from!.internal_id),
					eq(friendsTable.friend_id, to.internal_id),
				),
				and(
					eq(friendsTable.user_id, to.internal_id),
					eq(friendsTable.friend_id, from!.internal_id),
				),
			),
		)
		.limit(1);

	if (existingFriendship)
		throw new APIError(STATUS_CODES.BAD_REQUEST, "You are already friends");

	// Create a request
	await db!.insert(friendRequestsTable).values({
		sender_id: from!.internal_id,
		receiver_id: to.internal_id,
	});
}

/**
 *	Gets all friends requests sent by the user
 */
export async function getAllFriendRequestsSentByUser(userId: string) {
	const receiverTable = alias(usersTable, "receiver");

	return db!
		.select({
			sender: friendRequestsTable.sender_id,
			created_at: friendRequestsTable.created_at,
			receiver: {
				internal_id: receiverTable.internal_id,
				full_name: receiverTable.full_name,
				avatar_url: receiverTable.avatar_url,
			},
		})
		.from(friendRequestsTable)
		.innerJoin(
			usersTable,
			eq(usersTable.internal_id, friendRequestsTable.sender_id),
		)
		.innerJoin(
			receiverTable,
			eq(receiverTable.internal_id, friendRequestsTable.receiver_id),
		)
		.where(eq(usersTable.id, userId));
}

/**
 *	Gets all friend requests received by the user
 */
export async function getAllFriendRequestsReceivedByUser(userId: string) {
	const senderTable = alias(usersTable, "sender");

	return db!
		.select({
			receiver_id: friendRequestsTable.receiver_id,
			created_at: friendRequestsTable.created_at,
			sender: {
				internal_id: senderTable.internal_id,
				full_name: senderTable.full_name,
				avatar_url: senderTable.avatar_url,
			},
		})
		.from(friendRequestsTable)
		.innerJoin(
			usersTable,
			eq(usersTable.internal_id, friendRequestsTable.receiver_id),
		)
		.innerJoin(
			senderTable,
			eq(senderTable.internal_id, friendRequestsTable.sender_id),
		)
		.where(eq(usersTable.id, userId));
}

/**
 * Performs the necessary on any action taken on a request
 */
export async function validateFriendRequestAction(
	senderId: number,
	receiverId: number,
	userId: string,
	accept: boolean,
) {
	const [request] = await db!
		.select()
		.from(friendRequestsTable)
		.where(
			and(
				eq(friendRequestsTable.sender_id, senderId),
				eq(friendRequestsTable.receiver_id, receiverId),
			),
		)
		.limit(1);

	if (!request)
		throw new APIError(STATUS_CODES.NOT_FOUND, "Friend request not found");

	const [user] = await db!
		.select({ internal_id: usersTable.internal_id })
		.from(usersTable)
		.where(
			and(
				eq(usersTable.id, userId),
				or(
					eq(usersTable.internal_id, senderId),
					eq(usersTable.internal_id, receiverId),
				),
			),
		)
		.limit(1);

	if (!user)
		throw new APIError(
			STATUS_CODES.UNAUTHORIZED,
			"You are neither the receiver nor the sender of this request",
		);

	if (accept && user.internal_id !== receiverId)
		throw new APIError(
			STATUS_CODES.UNAUTHORIZED,
			"You are not allowed to accept this request",
		);
}

/**
 *	Accepts a friend request
 */
export async function acceptFriendRequest(
	senderId: number,
	receiverId: number,
) {
	await removeFriendRequest(senderId, receiverId);

	await db!.insert(friendsTable).values({
		user_id: senderId,
		friend_id: receiverId,
	});
}

/**
 *	Rejects a friend request
 */
export async function removeFriendRequest(
	senderId: number,
	receiverId: number,
) {
	await db!
		.delete(friendRequestsTable)
		.where(
			and(
				eq(friendRequestsTable.sender_id, senderId),
				eq(friendRequestsTable.receiver_id, receiverId),
			),
		);
}
