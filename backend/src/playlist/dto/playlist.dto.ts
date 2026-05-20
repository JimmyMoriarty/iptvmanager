// =====================================================
// Playlist DTOs
// =====================================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsUrl,
  IsArray,
  IsEnum,
} from 'class-validator';

export class CreatePlaylistDto {
  @ApiProperty({ example: 'Sports Channels' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'https://example.com/sports.m3u' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  sourceUrl!: string;

  @ApiPropertyOptional({ example: 'Live sports channels from provider X' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoRefresh?: boolean;

  @ApiPropertyOptional({ example: 360, description: 'Refresh interval in minutes' })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(10080)
  refreshInterval?: number;

  @ApiPropertyOptional({ example: ['sports', 'live'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdatePlaylistDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoRefresh?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(10080)
  refreshInterval?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class BulkImportDto {
  @ApiProperty({
    example: [
      { name: 'Sports', sourceUrl: 'https://example.com/sports.m3u' },
      { name: 'Movies', sourceUrl: 'https://example.com/movies.m3u' },
    ],
  })
  @IsArray()
  playlists!: CreatePlaylistDto[];
}

export class PlaylistQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ['name', 'createdAt', 'channelCount', 'lastFetchedAt'] })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
