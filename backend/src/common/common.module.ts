// =====================================================
// Common Module - Shared services
// =====================================================

import { Global, Module } from '@nestjs/common';
import { SafeFetcherService } from './safe-fetcher.service';

@Global()
@Module({
  providers: [SafeFetcherService],
  exports: [SafeFetcherService],
})
export class CommonModule {}
