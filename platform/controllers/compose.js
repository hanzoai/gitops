import BaseController from "./base.js";
import { ComposeModel } from "../schemas/compose.js";

class ComposeController extends BaseController {
	constructor() {
		super(ComposeModel);
	}
}

export default new ComposeController();
