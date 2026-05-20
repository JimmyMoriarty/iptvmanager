// =====================================================
// Playlist Module
// =====================================================

import { Module } from '@nestjs/common';
import { PlaylistController } from './playlist.controller';
import { PlaylistService } from './playlist.service';
import { CommonModule } from '../common/common.module';
import { ParserModule } from '../parser/parser.module';

@Module({
  imports: [CommonModule, ParserModule],
  controllers: [PlaylistController],
  providers: [PlaylistService],
  exports: [PlaylistService],
})
export class PlaylistModule {}
