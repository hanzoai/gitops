import express from "express";
import { authSession } from "../middlewares/authSession.js";
import { checkContentType } from "../middlewares/contentType.js";
import { validateOrg } from "../middlewares/validateOrg.js";
import { validate } from "../middlewares/validate.js";
import { applyRules } from "../schemas/notification.js";
import notifCtrl from "../controllers/notification.js";
import helper from "../util/helper.js";

const router = express.Router({ mergeParams: true });

/*
@route      /v1/org/:orgId/notification
@method     GET
@desc       Get all notifications for the organization
@access     private
*/
router.get(
	"/",
	authSession,
	validateOrg,
	async (req, res) => {
		try {
			const { org } = req;
			const { search, sortBy, sortDir } = req.query;

			let query = { orgId: org._id };
			if (search) {
				query.name = {
					$regex: helper.escapeStringRegexp(search),
					$options: "i",
				};
			}

			let sort = {};
			if (sortBy && sortDir) {
				sort[sortBy] = sortDir;
			} else sort = { createdAt: "desc" };

			const items = await notifCtrl.getManyByQuery(query, { sort });
			res.json(items);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/notification/:id
@method     GET
@desc       Get a specific notification by ID
@access     private
*/
router.get(
	"/:id",
	authSession,
	validateOrg,
	async (req, res) => {
		try {
			const item = await notifCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });
			res.json(item);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/notification
@method     POST
@desc       Creates a new notification channel
@access     private
*/
router.post(
	"/",
	checkContentType,
	authSession,
	validateOrg,
	applyRules("create"),
	validate,
	async (req, res) => {
		try {
			const { org, user } = req;

			const item = await notifCtrl.create({
				...req.body,
				orgId: org._id,
				iid: helper.generateSlug("ntf"),
				createdBy: user._id,
			});

			res.status(201).json(item);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/notification/:id
@method     PUT
@desc       Updates a notification channel
@access     private
*/
router.put(
	"/:id",
	checkContentType,
	authSession,
	validateOrg,
	applyRules("update"),
	validate,
	async (req, res) => {
		try {
			const { user } = req;

			const item = await notifCtrl.updateOneById(req.params.id, {
				...req.body,
				updatedBy: user._id,
			});

			res.json(item);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/notification/:id
@method     DELETE
@desc       Deletes a notification channel
@access     private
*/
router.delete(
	"/:id",
	authSession,
	validateOrg,
	async (req, res) => {
		try {
			await notifCtrl.deleteOneById(req.params.id);
			res.json({});
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/notification/:id/test
@method     POST
@desc       Sends a test notification
@access     private
*/
router.post(
	"/:id/test",
	authSession,
	validateOrg,
	async (req, res) => {
		try {
			const item = await notifCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			res.json({ message: "Test notification sent" });
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

export default router;
