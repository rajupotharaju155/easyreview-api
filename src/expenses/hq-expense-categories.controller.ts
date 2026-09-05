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
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { HqExpenseCategoriesQueryDto } from './dto/hq-expense-categories-query.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { ExpenseCategory } from './entities/expense-category.entity';
import { ExpensesService } from './expenses.service';

@Controller('hq/expense-categories')
@UseGuards(HqGuard)
export class HqExpenseCategoriesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  list(
    @Query() query: HqExpenseCategoriesQueryDto,
  ): Promise<ExpenseCategory[]> {
    return this.expensesService.listCategories(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateExpenseCategoryDto): Promise<ExpenseCategory> {
    return this.expensesService.createCategory(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    return this.expensesService.updateCategory(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.expensesService.deleteCategory(id);
  }
}
