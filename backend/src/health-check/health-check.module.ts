import { Module } from '@nestjs/common';
import { HealthCheckService } from './health-check.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [HealthCheckService],
  exports: [HealthCheckService],
})
export class HealthCheckModule {}
