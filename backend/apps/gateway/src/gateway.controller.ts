import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CreateColourBatchDto,
  CreateSubgroupDto,
  ImportSubgroupsDto,
  UpdateColourBatchDto,
  UpdateSubgroupDto,
} from '@app/common';
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

  /** Spreadsheet upload: archives the current subgroups and makes these the active set. */
  @Post('subgroups/import')
  importSubgroups(@Body() dto: ImportSubgroupsDto) {
    return this.gatewayService.importSubgroups(dto);
  }

  /** Earlier subgroup sets, grouped by when they were archived. */
  @Get('subgroups/archived')
  listArchivedSubgroups() {
    return this.gatewayService.listArchivedSubgroups();
  }

  /** Makes an archived set active again (the current set is archived in its place). */
  @Post('subgroups/restore')
  restoreSubgroups(@Body() body: { archivedAt: string }) {
    return this.gatewayService.restoreSubgroups(body?.archivedAt);
  }

  @Get('subgroups/page')
  listSubgroupsPage(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.gatewayService.listSubgroupsPage(Number(page) || 1, Number(pageSize) || 20);
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

  @Post('colour-batches')
  createColourBatch(@Body() dto: CreateColourBatchDto) {
    return this.gatewayService.createColourBatch(dto);
  }

  @Get('colour-batches')
  listColourBatches() {
    return this.gatewayService.listColourBatches();
  }

  /** Clears (archives) every batch from the p-chart; retrieve them with the two routes below. */
  @Delete('colour-batches')
  clearColourBatches() {
    return this.gatewayService.clearColourBatches();
  }

  @Get('colour-batches/cleared')
  listClearedColourBatches() {
    return this.gatewayService.listClearedColourBatches();
  }

  /** Restores the most recent clear, or the one whose `clearedAt` is given in the body. */
  @Post('colour-batches/restore')
  restoreColourBatches(@Body() body?: { clearedAt?: string }) {
    return this.gatewayService.restoreColourBatches(body?.clearedAt);
  }

  @Patch('colour-batches/:id')
  updateColourBatch(@Param('id') id: string, @Body() dto: UpdateColourBatchDto) {
    return this.gatewayService.updateColourBatch(id, dto);
  }

  @Delete('colour-batches/:id')
  deleteColourBatch(@Param('id') id: string) {
    return this.gatewayService.deleteColourBatch(id);
  }

  @Get('p-chart')
  getPChart() {
    return this.gatewayService.getPChart();
  }
}
