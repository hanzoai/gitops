import BaseController from "./base.js";
import { MonitoringModel } from "../schemas/monitoring.js";

class MonitoringController extends BaseController {
	constructor() {
		super(MonitoringModel);
	}
}

export default new MonitoringController();
