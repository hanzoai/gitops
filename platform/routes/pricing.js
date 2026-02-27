import express from "express";
import { getCloudPlans, getCloudRegions } from "../handlers/pricing.js";
import helper from "../util/helper.js";

const router = express.Router({ mergeParams: true });

/*
@route      /v1/pricing/cloud/plans
@method     GET
@desc       Returns available cloud VM plans with real pricing from DigitalOcean
@access     public (no auth required — pricing is public information)
*/
router.get("/cloud/plans", async (req, res) => {
	try {
		const plans = await getCloudPlans();
		res.json({ plans });
	} catch (error) {
		helper.handleError(req, res, error);
	}
});

/*
@route      /v1/pricing/cloud/regions
@method     GET
@desc       Returns available deployment regions
@access     public
*/
router.get("/cloud/regions", async (req, res) => {
	try {
		const regions = await getCloudRegions();
		res.json({ regions });
	} catch (error) {
		helper.handleError(req, res, error);
	}
});

export default router;
