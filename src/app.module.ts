import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { CoreModule } from "./core/core.module";
import { GatewayModule } from "./gateway/gateway.module";
import { ThrottlerModule } from "@nestjs/throttler";

@Module({
	imports: [DatabaseModule, CoreModule, GatewayModule, ThrottlerModule.forRoot([{
		ttl: 1000,
		limit: 100000,
	}])],
})
export class AppModule {}
