import db from "../database/client.ts";
import { and, asc, eq, or } from "drizzle-orm";
import { usersTable } from "../database/schemas/users.ts";
import { friendsTable } from "../database/schemas/friends.ts";
import { friendRequestsTable } from "../database/schemas/friendRequests.ts";
import { APIError } from "../errors/api.error.ts";
import { STATUS_CODES } from "../lib/constants.ts";
import { alias } from "drizzle-orm/pg-core";
import { getUserDataByEmailOrId } from "./user.service.ts";

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
export async function sendRequest(
	fromInternalId: number,
	toIdentifier: string,
) {
	try {
		const toInternalId = await validateSendFriendRequestAction(
			fromInternalId,
			toIdentifier,
		);

		// Create request
		await createRequest(fromInternalId, toInternalId);
	} catch (err) {
		// We throw the error to the controller to handle return
		throw err;
	}
}

/**
 *	Validates the Send Request Action and returns the internalId of the
 *	user the request is being sent to
 */
async function validateSendFriendRequestAction(
	fromInternalId: number,
	toIdentifier: string,
) {
	// Get the data of the user the request is being sent to
	const to = await getUserDataByEmailOrId(toIdentifier);

	// If receiver doesn't exist then throw error
	if (!to) throw new APIError(STATUS_CODES.NOT_FOUND, "User not found");

	// Prevent sending request to yourself
	if (to.internal_id === fromInternalId)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"You cannot send a request to yourself",
		);

	// Check if there is already a request in either direction
	const existingRequest = await getFriendRequestByIds(
		fromInternalId,
		to.internal_id,
	);

	if (existingRequest)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"Friend request already exists",
		);

	// Check if users are already friends
	const existingFriendship = await getFriendshipByIds(
		fromInternalId,
		to.internal_id,
	);

	if (existingFriendship)
		throw new APIError(STATUS_CODES.BAD_REQUEST, "You are already friends");

	return to.internal_id;
}

/**
 * Given two user internal ids, function returns a request
 * if it exists between the two users
 */
async function getFriendRequestByIds(firstId: number, secondId: number) {
	const [friendRequest] = await db!
		.select()
		.from(friendRequestsTable)
		.where(
			or(
				and(
					eq(friendRequestsTable.sender_id, firstId),
					eq(friendRequestsTable.receiver_id, secondId),
				),
				and(
					eq(friendRequestsTable.sender_id, secondId),
					eq(friendRequestsTable.receiver_id, firstId),
				),
			),
		)
		.limit(1);
	return friendRequest;
}

/**
 * Given two user internal ids, function returns a friendship
 * if it exists between the two users
 */
async function getFriendshipByIds(firstId: number, secondId: number) {
	const [friendship] = await db!
		.select()
		.from(friendsTable)
		.where(
			or(
				and(
					eq(friendsTable.user_id, firstId),
					eq(friendsTable.friend_id, secondId),
				),
				and(
					eq(friendsTable.user_id, secondId),
					eq(friendsTable.friend_id, firstId),
				),
			),
		)
		.limit(1);

	return friendship;
}

async function createRequest(senderId: number, receiverId: number) {
	await db!.insert(friendRequestsTable).values({
		sender_id: senderId,
		receiver_id: receiverId,
	});
}

/**
 *	Gets all friends requests sent by the user
 */
export async function getAllSentRequests(userInternalId: number) {
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
export async function getAllReceivedRequests(
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

export async function handleRequestAction(
	senderId: number,
	receiverId: number,
	userInternalId: number,
	accept: boolean,
) {
	try {
		await validateFriendRequestAction(
			senderId,
			receiverId,
			userInternalId,
			accept,
		);

		if (accept) {
			await acceptFriendRequest(senderId, receiverId);
		} else {
			await removeFriendRequest(senderId, receiverId);
		}
	} catch (err) {
		throw err;
	}
}

/**
 * Performs the necessary on any action taken on a request
 */
async function validateFriendRequestAction(
	senderId: number,
	receiverId: number,
	userInternalId: number,
	accept: boolean,
) {
	// Check if the request exists
	const request = await getFriendRequestByIds(senderId, receiverId);

	if (!request)
		throw new APIError(STATUS_CODES.NOT_FOUND, "Friend request not found");

	// Check if the user is the sender or the receiver of the request
	if (userInternalId !== senderId && userInternalId !== receiverId)
		throw new APIError(
			STATUS_CODES.FORBIDDEN,
			"You are neither the receiver nor the sender of the request",
		);

	// If the request is being accepted then the current user should
	// be the receiver of the request
	if (accept && userInternalId !== receiverId)
		throw new APIError(
			STATUS_CODES.UNAUTHORIZED,
			"You are not allowed to accept this request",
		);
}

/**
 *	Accepts a friend request
 */
async function acceptFriendRequest(
	senderId: number,
	receiverId: number,
) {
	await removeFriendRequest(senderId, receiverId);
	await createFriendship(senderId, receiverId);
}

async function createFriendship(
	firstUserInternalId: number,
	secondUserInternalId: number,
) {
	await db!.insert(friendsTable).values({
		user_id: firstUserInternalId,
		friend_id: secondUserInternalId,
	});
}

/**
 *	Rejects a friend request
 */
async function removeFriendRequest(
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
