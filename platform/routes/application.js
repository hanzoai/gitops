import express from "express";
import { authSession } from "../middlewares/authSession.js";
import { checkContentType } from "../middlewares/contentType.js";
import { validateOrg } from "../middlewares/validateOrg.js";
import { validateProject } from "../middlewares/validateProject.js";
import { validateEnvironment } from "../middlewares/validateEnvironment.js";
import { validate } from "../middlewares/validate.js";
import { applyRules } from "../schemas/application.js";
import appCtrl from "../controllers/application.js";
import helper from "../util/helper.js";

const router = express.Router({ mergeParams: true });

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/application
@method     GET
@desc       Get all applications in a project environment
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

			const items = await appCtrl.getManyByQuery(query, { sort });
			res.json(items);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/application/:id
@method     GET
@desc       Get a specific application by ID
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
			const item = await appCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });
			res.json(item);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/application
@method     POST
@desc       Creates a new application in the project environment
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

			const item = await appCtrl.create({
				...req.body,
				orgId: org._id,
				projectId: project._id,
				environmentId: environment._id,
				iid: helper.generateSlug("app"),
				createdBy: user._id,
			});

			res.status(201).json(item);
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/application/:id
@method     PUT
@desc       Updates an application
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

			const item = await appCtrl.updateOneById(req.params.id, {
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
@route      /v1/org/:orgId/project/:projectId/env/:envId/application/:id
@method     DELETE
@desc       Deletes an application
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
			await appCtrl.deleteOneById(req.params.id);
			res.json({});
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/application/:id/deploy
@method     POST
@desc       Triggers deployment of the application
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
			const item = await appCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			await appCtrl.updateOneById(req.params.id, {
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
@route      /v1/org/:orgId/project/:projectId/env/:envId/application/:id/start
@method     POST
@desc       Starts the application
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
			const item = await appCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			await appCtrl.updateOneById(req.params.id, {
				status: "running",
				updatedBy: req.user._id,
			});

			res.json({ message: "Application started" });
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/application/:id/stop
@method     POST
@desc       Stops the application
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
			const item = await appCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			await appCtrl.updateOneById(req.params.id, {
				status: "stopped",
				updatedBy: req.user._id,
			});

			res.json({ message: "Application stopped" });
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

/*
@route      /v1/org/:orgId/project/:projectId/env/:envId/application/:id/reload
@method     POST
@desc       Reloads the application
@access     private
*/
router.post(
	"/:id/reload",
	authSession,
	validateOrg,
	validateProject,
	validateEnvironment,
	async (req, res) => {
		try {
			const item = await appCtrl.getOneById(req.params.id);
			if (!item) return res.status(404).json({ error: "Not found" });

			await appCtrl.updateOneById(req.params.id, {
				status: "reloading",
				updatedBy: req.user._id,
			});

			res.json({ message: "Application reloading" });
		} catch (err) {
			helper.handleError(req, res, err);
		}
	}
);

export default router;
