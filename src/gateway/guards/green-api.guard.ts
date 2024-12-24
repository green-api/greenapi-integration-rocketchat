import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { BaseGreenApiAuthGuard } from "@green-api/greenapi-integration";
import { DatabaseService } from "../../database/database.service";

@Injectable()
export class GreenApiGuard extends BaseGreenApiAuthGuard<Request> implements CanActivate {
	constructor(protected db: DatabaseService) {super(db);}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		return this.validateRequest(request);
	}
}
