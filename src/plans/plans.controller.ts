import { Controller, Get, Param } from '@nestjs/common';
import { Plan } from './entities/plan.entity';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAll(): Promise<Plan[]> {
    return this.plansService.findActiveCatalog();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Plan> {
    return this.plansService.findActiveById(id);
  }
}
