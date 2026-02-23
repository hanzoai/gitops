import BaseController from "./base.js";
import { ApplicationModel } from "../schemas/application.js";

class ApplicationController extends BaseController {
	constructor() {
		super(ApplicationModel);
	}
}

export default new ApplicationController();
