import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../locations/entities/location.entity';
import { Order } from '../orders/entities/order.entity';
import { ExpenseCategory } from './entities/expense-category.entity';
import { Expense } from './entities/expense.entity';
import { ExpensesService } from './expenses.service';
import { HqExpenseCategoriesController } from './hq-expense-categories.controller';
import { HqExpensesController } from './hq-expenses.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, ExpenseCategory, Location, Order]),
  ],
  controllers: [HqExpensesController, HqExpenseCategoriesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
