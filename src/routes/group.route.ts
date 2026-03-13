import {Router} from "express";
import { getAllGroupsOfCurrentUser } from "../controllers/group.controller.ts";

const router = Router();

router.get("/", getAllGroupsOfCurrentUser);

export default router;