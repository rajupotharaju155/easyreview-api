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
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { HqGuard } from '../hq/guards/hq.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { HqExpenseSummaryDto } from './dto/hq-expense-summary.dto';
import { HqExpensesQueryDto } from './dto/hq-expenses-query.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { Expense } from './entities/expense.entity';
import { ExpensesService } from './expenses.service';

@Controller('hq/expenses')
@UseGuards(HqGuard)
export class HqExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(
    @Query() query: HqExpensesQueryDto,
  ): Promise<PaginatedResponseDto<Expense>> {
    return this.expensesService.findAllForHq(query);
  }

  @Get('summary')
  summary(): Promise<HqExpenseSummaryDto> {
    return this.expensesService.findSummaryForHq();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Expense> {
    return this.expensesService.findOneForHq(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateExpenseDto): Promise<Expense> {
    return this.expensesService.createForHq(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<Expense> {
    return this.expensesService.updateForHq(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<Expense> {
    return this.expensesService.removeForHq(id);
  }
}
