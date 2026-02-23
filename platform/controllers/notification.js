import BaseController from "./base.js";
import { NotificationModel } from "../schemas/notification.js";

class NotificationController extends BaseController {
	constructor() {
		super(NotificationModel);
	}
}

export default new NotificationController();
