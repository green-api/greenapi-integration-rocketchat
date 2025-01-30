import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";
import { GreenApiLogger, Settings } from "@green-api/greenapi-integration";

declare global {
	namespace PrismaJson {
		// noinspection JSUnusedGlobalSymbols
		type InstanceSettings = Settings;
	}
}

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		logger: GreenApiLogger.getInstance("NestJS"), bufferLogs: true,
	});
	app.setGlobalPrefix("api");
	app.use(helmet());
	await app.listen(3000);
}

bootstrap();
