import express from "express";
import { authSession } from "../middlewares/authSession.js";
import { checkContentType } from "../middlewares/contentType.js";
import { validateOrg } from "../middlewares/validateOrg.js";
import { validateProject } from "../middlewares/validateProject.js";
import { validateEnvironment } from "../middlewares/validateEnvironment.js";
import { validate } from "../middlewares/validate.js";
import { applyRules } from "../schemas/database.js";
import dbCtrl from "../controllers/database.js";
import helper from "../util/helper.js";

const router = express.Router({ mergeParams: true });

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/database
@method     GET
@desc       Get all databases in a project environment
@access     private
*/
router.get(
	"/",
	authSession,
	validateOrg,
	validateProject,
	validateEnvironment,
	async (req, res) => {
		try {
			const { environment } = req;
			const { search, sortBy, sortDir } = req.query;

			let query = { environmentId: environment._id };
			if (search) {
				query.name = {
					$regex: helper.escapeStringRegexp(search),
					$options: "i",
				};
			}

			let sort = {};
			if (sortBy && sortDir) {
				sort[sortBy] = sortDir;
			} else sort = { createdAt: "asc" };

			const items = await dbCtrl.getManyByQuery(query, { sort });
			res.json(items);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/database/:id
@method     GET
@desc       Get a specific database by ID
@access     private
*/
router.get(
	"/:id",
	authSession,
	validateOrg,
	validateProject,
	validateEnvironment,
	async (req, res) => {
		try {
			const item = await dbCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });
			res.json(item);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/database
@method     POST
@desc       Creates a new database in the project environment
@access     private
*/
router.post(
	"/",
	checkContentType,
	authSession,
	validateOrg,
	validateProject,
	validateEnvironment,
	applyRules("create"),
	validate,
	async (req, res) => {
		try {
			const { org, project, environment, user } = req;

			const item = await dbCtrl.create({
				...req.body,
				orgId: org._id,
				projectId: project._id,
				environmentId: environment._id,
				iid: helper.generateSlug("db"),
				createdBy: user._id,
			});

			res.status(201).json(item);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/database/:id
@method     PUT
@desc       Updates a database
@access     private
*/
router.put(
	"/:id",
	checkContentType,
	authSession,
	validateOrg,
	validateProject,
	validateEnvironment,
	applyRules("update"),
	validate,
	async (req, res) => {
		try {
			const { user } = req;

			const item = await dbCtrl.updateOneById(req.params.id, {
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
@route      /v1/org/:orgId/project/:projectId/env/:envId/database/:id
@method     DELETE
@desc       Deletes a database
@access     private
*/
router.delete(
	"/:id",
	authSession,
	validateOrg,
	validateProject,
	validateEnvironment,
	async (req, res) => {
		try {
			await dbCtrl.deleteOneById(req.params.id);
			res.json({});
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/database/:id/deploy
@method     POST
@desc       Triggers deployment of the database
@access     private
*/
router.post(
	"/:id/deploy",
	authSession,
	validateOrg,
	validateProject,
	validateEnvironment,
	async (req, res) => {
		try {
			const item = await dbCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			await dbCtrl.updateOneById(req.params.id, {
				status: "deploying",
				updatedBy: req.user._id,
			});

			res.json({ message: "Deployment triggered" });
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/database/:id/start
@method     POST
@desc       Starts the database
@access     private
*/
router.post(
	"/:id/start",
	authSession,
	validateOrg,
	validateProject,
	validateEnvironment,
	async (req, res) => {
		try {
			const item = await dbCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			await dbCtrl.updateOneById(req.params.id, {
				status: "running",
				updatedBy: req.user._id,
			});

			res.json({ message: "Database started" });
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/database/:id/stop
@method     POST
@desc       Stops the database
@access     private
*/
router.post(
	"/:id/stop",
	authSession,
	validateOrg,
	validateProject,
	validateEnvironment,
	async (req, res) => {
		try {
			const item = await dbCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			await dbCtrl.updateOneById(req.params.id, {
				status: "stopped",
				updatedBy: req.user._id,
			});

			res.json({ message: "Database stopped" });
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/database/:id/rebuild
@method     POST
@desc       Rebuilds the database
@access     private
*/
router.post(
	"/:id/rebuild",
	authSession,
	validateOrg,
	validateProject,
	validateEnvironment,
	async (req, res) => {
		try {
			const item = await dbCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			await dbCtrl.updateOneById(req.params.id, {
				status: "rebuilding",
				updatedBy: req.user._id,
			});

			res.json({ message: "Database rebuilding" });
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/database/:id/save-environment
@method     POST
@desc       Saves environment variables for the database
@access     private
*/
router.post(
	"/:id/save-environment",
	checkContentType,
	authSession,
	validateOrg,
	validateProject,
	validateEnvironment,
	async (req, res) => {
		try {
			const item = await dbCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			const { env } = req.body;

			const updated = await dbCtrl.updateOneById(req.params.id, {
				env,
				updatedBy: req.user._id,
			});

			res.json(updated);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/database/:id/save-external-port
@method     POST
@desc       Saves external port for the database
@access     private
*/
router.post(
	"/:id/save-external-port",
	checkContentType,
	authSession,
	validateOrg,
	validateProject,
	validateEnvironment,
	async (req, res) => {
		try {
			const item = await dbCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			const { externalPort } = req.body;

			const updated = await dbCtrl.updateOneById(req.params.id, {
				externalPort,
				updatedBy: req.user._id,
			});

			res.json(updated);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

export default router;
