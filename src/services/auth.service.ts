import {GOOGLE_CLIENT_ID, JWT_SECRET} from "../lib/constants.ts";
import logger from "../lib/utils/logger.ts";
import {OAuth2Client} from "google-auth-library";
import {usersTable} from "../database/schemas/users.ts";
import db from "../database/client.ts";
import jwt from "jsonwebtoken";

const client = new OAuth2Client(GOOGLE_CLIENT_ID);
logger.debug("Google OAuth Client created successfully");

export async function getJWTFromTokenAndInsertIntoDb(credential: string) {
    const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

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

    return jwt.sign(
        { id: user!.id },
        JWT_SECRET,
        {expiresIn: "7d"}
    );
}