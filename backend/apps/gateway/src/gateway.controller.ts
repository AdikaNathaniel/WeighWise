import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateSubgroupDto, UpdateSubgroupDto } from '@app/common';
import { GatewayService } from './gateway.service.js';

@Controller()
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Post('subgroups')
  createSubgroup(@Body() dto: CreateSubgroupDto) {
    return this.gatewayService.createSubgroup(dto);
  }

  @Get('subgroups')
  listSubgroups() {
    return this.gatewayService.listSubgroups();
  }

  @Patch('subgroups/:id')
  updateSubgroup(@Param('id') id: string, @Body() dto: UpdateSubgroupDto) {
    return this.gatewayService.updateSubgroup(id, dto);
  }

  @Delete('subgroups/:id')
  deleteSubgroup(@Param('id') id: string) {
    return this.gatewayService.deleteSubgroup(id);
  }

  @Get('dashboard')
  getDashboard() {
    return this.gatewayService.getDashboard();
  }
}
