import express from "express";
import { authSession } from "../middlewares/authSession.js";
import { checkContentType } from "../middlewares/contentType.js";
import { validateOrg } from "../middlewares/validateOrg.js";
import { validate } from "../middlewares/validate.js";
import { applyRules } from "../schemas/backup.js";
import backupCtrl from "../controllers/backup.js";
import helper from "../util/helper.js";

const router = express.Router({ mergeParams: true });

/*
@route      /v1/org/:orgId/backup
@method     GET
@desc       Get all backups for the organization
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

			const items = await backupCtrl.getManyByQuery(query, { sort });
			res.json(items);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/backup/:id
@method     GET
@desc       Get a specific backup by ID
@access     private
*/
router.get(
	"/:id",
	authSession,
	validateOrg,
	async (req, res) => {
		try {
			const item = await backupCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });
			res.json(item);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/backup
@method     POST
@desc       Creates a new backup
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

			const item = await backupCtrl.create({
				...req.body,
				orgId: org._id,
				iid: helper.generateSlug("bak"),
				createdBy: user._id,
			});

			res.status(201).json(item);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/backup/:id
@method     PUT
@desc       Updates a backup
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

			const item = await backupCtrl.updateOneById(req.params.id, {
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
@route      /v1/org/:orgId/backup/:id
@method     DELETE
@desc       Deletes a backup
@access     private
*/
router.delete(
	"/:id",
	authSession,
	validateOrg,
	async (req, res) => {
		try {
			await backupCtrl.deleteOneById(req.params.id);
			res.json({});
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/backup/:id/restore
@method     POST
@desc       Restores a backup
@access     private
*/
router.post(
	"/:id/restore",
	authSession,
	validateOrg,
	async (req, res) => {
		try {
			const item = await backupCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			await backupCtrl.updateOneById(req.params.id, {
				status: "restoring",
				updatedBy: req.user._id,
			});

			res.json({ message: "Restore initiated" });
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/backup/:id/schedule
@method     POST
@desc       Schedules a backup
@access     private
*/
router.post(
	"/:id/schedule",
	checkContentType,
	authSession,
	validateOrg,
	async (req, res) => {
		try {
			const item = await backupCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			const updated = await backupCtrl.updateOneById(req.params.id, {
				...req.body,
				status: "scheduled",
				updatedBy: req.user._id,
			});

			res.json(updated);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

export default router;
