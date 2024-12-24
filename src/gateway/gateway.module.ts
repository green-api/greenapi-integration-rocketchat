import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CoreModule } from "../core/core.module";
import { GatewayController } from './gateway.controller';

@Module({
    imports: [DatabaseModule, CoreModule],
    controllers: [GatewayController]
})
export class GatewayModule {}
