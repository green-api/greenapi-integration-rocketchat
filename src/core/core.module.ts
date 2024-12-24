import { Module } from "@nestjs/common";
import { CoreService } from "./core.service";
import { DatabaseModule } from "../database/database.module";
import { RocketChatTransformer } from "./transformer";

@Module({
	imports: [DatabaseModule],
	providers: [CoreService, RocketChatTransformer],
	exports: [CoreService],
})
export class CoreModule {}
