// =====================================================
// Parser Module
// =====================================================

import { Global, Module } from '@nestjs/common';
import { M3uParserService } from './m3u-parser.service';

@Global()
@Module({
  providers: [M3uParserService],
  exports: [M3uParserService],
})
export class ParserModule {}
