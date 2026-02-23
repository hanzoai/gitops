import BaseController from "./base.js";
import { ServerModel } from "../schemas/server.js";

class ServerController extends BaseController {
	constructor() {
		super(ServerModel);
	}
}

export default new ServerController();
