import db from "../database/client.ts";
import { and, asc, eq, or } from "drizzle-orm";
import { usersTable } from "../database/schemas/users.ts";
import { friendsTable } from "../database/schemas/friends.ts";
import { friendRequestsTable } from "../database/schemas/friendRequests.ts";
import { APIError } from "../errors/api.error.ts";
import { STATUS_CODES } from "../lib/constants.ts";
import { alias } from "drizzle-orm/pg-core";

/**
 *	Retrieves the internal ids of all friends of the user
 */
export async function getAllFriendsOfUser(userInternalId: number) {
	const friendTable = alias(usersTable, "friend");

	return db!
		.select({
			internal_id: friendTable.internal_id,
			id: friendTable.id,
			full_name: friendTable.full_name,
			email: friendTable.email,
			avatar_url: friendTable.avatar_url,
			created_at: friendsTable.created_at,
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
		.orderBy(asc(friendTable.full_name))
		.where(eq(usersTable.internal_id, userInternalId));
}

/**
 *	Send friend request to a user
 */
export async function sendFriendRequestToUser(
	fromInternalId: number,
	toIdentifier: string,
) {
	// Check if the identifier is an email or ID
	const isEmail = toIdentifier.includes("@");

	// Find target user by email or UUID id
	const [to] = await db!
		.select({
			id: usersTable.id,
			email: usersTable.email,
			internal_id: usersTable.internal_id,
		})
		.from(usersTable)
		.where(
			isEmail
				? eq(usersTable.email, toIdentifier)
				: eq(usersTable.id, toIdentifier),
		)
		.limit(1);

	// If receiver doesn't exist then throw error
	if (!to) throw new APIError(STATUS_CODES.NOT_FOUND, "User not found");

	// Prevent sending request to yourself
	if (to.internal_id === fromInternalId)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"You cannot send a request to yourself",
		);

	// Check if there is already a request in either direction
	const [existingRequest] = await db!
		.select()
		.from(friendRequestsTable)
		.where(
			or(
				and(
					eq(friendRequestsTable.sender_id, fromInternalId),
					eq(friendRequestsTable.receiver_id, to.internal_id),
				),
				and(
					eq(friendRequestsTable.sender_id, to.internal_id),
					eq(friendRequestsTable.receiver_id, fromInternalId),
				),
			),
		)
		.limit(1);

	if (existingRequest)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"Friend request already exists",
		);

	// Check if users are already friends
	const [existingFriendship] = await db!
		.select()
		.from(friendsTable)
		.where(
			or(
				and(
					eq(friendsTable.user_id, fromInternalId),
					eq(friendsTable.friend_id, to.internal_id),
				),
				and(
					eq(friendsTable.user_id, to.internal_id),
					eq(friendsTable.friend_id, fromInternalId),
				),
			),
		)
		.limit(1);

	if (existingFriendship)
		throw new APIError(STATUS_CODES.BAD_REQUEST, "You are already friends");

	// Create request
	await db!.insert(friendRequestsTable).values({
		sender_id: fromInternalId,
		receiver_id: to.internal_id,
	});
}

/**
 *	Gets all friends requests sent by the user
 */
export async function getAllFriendRequestsSentByUser(userInternalId: number) {
	const receiverTable = alias(usersTable, "receiver");

	return db!
		.select({
			sender_id: friendRequestsTable.sender_id,
			created_at: friendRequestsTable.created_at,
			receiver: {
				id: receiverTable.id,
				internal_id: receiverTable.internal_id,
				full_name: receiverTable.full_name,
				email: receiverTable.email,
				avatar_url: receiverTable.avatar_url,
				created_at: receiverTable.created_at,
			},
		})
		.from(friendRequestsTable)
		.innerJoin(
			receiverTable,
			eq(receiverTable.internal_id, friendRequestsTable.receiver_id),
		)
		.where(eq(friendRequestsTable.sender_id, userInternalId));
}

/**
 *	Gets all friend requests received by the user
 */
export async function getAllFriendRequestsReceivedByUser(
	userInternalId: number,
) {
	const senderTable = alias(usersTable, "sender");

	return db!
		.select({
			receiver_id: friendRequestsTable.receiver_id,
			created_at: friendRequestsTable.created_at,
			sender: {
				id: senderTable.id,
				internal_id: senderTable.internal_id,
				full_name: senderTable.full_name,
				email: senderTable.email,
				avatar_url: senderTable.avatar_url,
				created_at: senderTable.created_at,
			},
		})
		.from(friendRequestsTable)
		.innerJoin(
			senderTable,
			eq(senderTable.internal_id, friendRequestsTable.sender_id),
		)
		.where(eq(friendRequestsTable.receiver_id, userInternalId));
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
