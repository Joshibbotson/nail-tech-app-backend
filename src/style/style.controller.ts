import { Controller, Get } from '@nestjs/common';
import { StyleService } from './style.service';

@Controller('styles')
export class StyleController {
  constructor(private readonly styleService: StyleService) {}

  @Get()
  findAll() {
    return this.styleService.findAll().map((style) => ({
      styleId: style.styleId,
      name: style.name,
      description: style.description,
      thumbnailUrl: style.thumbnailUrl,
      sortOrder: style.sortOrder,
    }));
  }
}
