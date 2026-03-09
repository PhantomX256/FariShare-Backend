import db from "../database/client.ts";
import { and, eq, or } from "drizzle-orm";
import { usersTable } from "../database/schemas/users.ts";
import { friendsTable } from "../database/schemas/friends.ts";
import { friendRequestsTable } from "../database/schemas/friendRequests.ts";
import { APIError } from "../errors/api.error.ts";
import { STATUS_CODES } from "../lib/constants.ts";

/**
 *	Retrieves the internal ids of all friends of the user
 */
export async function getAllFriendIdsOfUser(userId: string) {
	// Get all rows containing the user on either column
	const friendships = await db!
		.select({
			user_id: friendsTable.user_id,
			friend_id: friendsTable.friend_id,
			internal_id: usersTable.internal_id,
		})
		.from(usersTable)
		.innerJoin(
			friendsTable,
			or(
				eq(friendsTable.user_id, usersTable.internal_id),
				eq(friendsTable.friend_id, usersTable.internal_id),
			),
		)
		.where(eq(usersTable.id, userId));

	// Return an array of internalIds of the friends of the user
	return friendships.map((f) =>
		f.user_id === f.internal_id ? f.friend_id : f.user_id,
	);
}

export async function getAFriendRequest(senderId: number, receiverId: number) {
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

	return request;
}

/**
 *	Send friend request to a user
 */
export async function sendFriendRequestToUser(fromId: string, toIdentifier: string) {
	const isEmail = toIdentifier.includes("@");

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

	if (to.internal_id === from!.internal_id) throw new APIError(STATUS_CODES.BAD_REQUEST, "You cannot send a request to yourself");

	const request = await getAFriendRequest(from!.internal_id, to.internal_id);

	if (request) throw new APIError(STATUS_CODES.BAD_REQUEST, "Friend request already sent");

	// Create a request
	await db!.insert(friendRequestsTable).values({
		sender_id: from!.internal_id,
		receiver_id: to.internal_id,
	});
}

export function getAllFriendRequestsSentByUser(userId: string) {
	return db!
		.select({
			sender_id: friendRequestsTable.sender_id,
			receiver_id: friendRequestsTable.receiver_id,
			created_at: friendRequestsTable.created_at,
		})
		.from(friendRequestsTable)
		.innerJoin(
			usersTable,
			eq(usersTable.internal_id, friendRequestsTable.sender_id),
		)
		.where(eq(usersTable.id, userId));
}

export function getAllFriendRequestsReceivedByUser(userId: string) {
	return db!
		.select({
			sender_id: friendRequestsTable.sender_id,
			receiver_id: friendRequestsTable.receiver_id,
			created_at: friendRequestsTable.created_at,
		})
		.from(friendRequestsTable)
		.innerJoin(
			usersTable,
			eq(usersTable.internal_id, friendRequestsTable.receiver_id),
		)
		.where(eq(usersTable.id, userId));
}

export async function validateFriendRequestAction(
	senderId: number,
	receiverId: number,
	userId: string,
) {
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

	const request = await getAFriendRequest(senderId, receiverId);

	if (!request)
		throw new APIError(STATUS_CODES.NOT_FOUND, "Friend request not found");
}

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
