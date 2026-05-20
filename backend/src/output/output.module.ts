import { Module } from '@nestjs/common';
import { OutputController } from './output.controller';
import { OutputService } from './output.service';
import { ParserModule } from '../parser/parser.module';

@Module({
  imports: [ParserModule],
  controllers: [OutputController],
  providers: [OutputService],
  exports: [OutputService],
})
export class OutputModule {}
