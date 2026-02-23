import BaseController from "./base.js";
import { BackupModel } from "../schemas/backup.js";

class BackupController extends BaseController {
	constructor() {
		super(BackupModel);
	}
}

export default new BackupController();
