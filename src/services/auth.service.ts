import {GOOGLE_CLIENT_ID, JWT_SECRET} from "../lib/constants.ts";
import logger from "../lib/utils/logger.ts";
import {OAuth2Client} from "google-auth-library";
import {usersTable} from "../database/schemas/users.ts";
import db from "../database/client.ts";
import jwt from "jsonwebtoken";

const client = new OAuth2Client(GOOGLE_CLIENT_ID);
logger.debug("Google OAuth Client created successfully");

/**
 *  Takes the Google ID Token and exchanges it to get the
 *  user's details and then enters them into the db
 *  and returns a JWT
 */
export async function getJWTFromTokenAndInsertIntoDb(credential: string) {
    // Verify the token from Google
    const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID
    });
    logger.debug("Token verified from Google");

    // Get the user's details
    const payload = ticket.getPayload();
    logger.debug("User details retrieved from Google");

    // Insert the relevant data into the database
    // and get back the id of the user
    const [user] = await db!.insert(usersTable)
        .values({
            full_name: payload?.name,
            email: payload?.email,
            avatar_url: payload?.picture
        })
        .onConflictDoUpdate({
            target: usersTable.email,
            set: {
                full_name: payload?.name,
                avatar_url: payload?.picture
            }
        })
        .returning({ id: usersTable.id });
    logger.debug(`User data inserted into database. UserID: ${user!.id}`);

    // Sign a JWT with the user's id and return it
    return jwt.sign(
        { id: user!.id },
        JWT_SECRET,
        {expiresIn: "7d"} // expires in 7 days
    );
}