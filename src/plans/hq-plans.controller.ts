import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HqGuard } from '../hq/guards/hq.guard';
import { CreatePlanDto } from './dto/create-plan.dto';
import { HqPlansQueryDto } from './dto/hq-plans-query.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { Plan } from './entities/plan.entity';
import { PlansService } from './plans.service';

@Controller('hq/plans')
@UseGuards(HqGuard)
export class HqPlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAll(@Query() query: HqPlansQueryDto): Promise<Plan[]> {
    return this.plansService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Plan> {
    return this.plansService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePlanDto): Promise<Plan> {
    return this.plansService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto): Promise<Plan> {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<Plan> {
    return this.plansService.remove(id);
  }
}
