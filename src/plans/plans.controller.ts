import { Controller, Get, Param, Query } from '@nestjs/common';
import { Plan } from './entities/plan.entity';
import { PlansQueryDto } from './dto/plans-query.dto';
import { Product } from './enums/product.enum';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAll(@Query() query: PlansQueryDto): Promise<Plan[]> {
    return this.plansService.findActiveCatalog(
      query.product ?? Product.EASY_REVIEW,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Plan> {
    return this.plansService.findActiveById(id);
  }
}
