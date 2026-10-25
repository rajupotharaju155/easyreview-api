import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../invoices/entities/invoice.entity';
import { LocationAccessModule } from '../locations/location-access.module';
import { CashCategoriesService } from './cash-categories.service';
import { CashController } from './cash.controller';
import { CashEntriesService } from './cash-entries.service';
import { CashCategory } from './entities/cash-category.entity';
import { CashEntry } from './entities/cash-entry.entity';

/**
 * EasyCash: a business's money in and money out. Businesses create their own
 * categories (the UI offers suggestions). Invoice payments are cash entries
 * too, filed under a reserved category, so every rupee lives in one table.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CashEntry, CashCategory, Invoice]),
    LocationAccessModule,
  ],
  controllers: [CashController],
  providers: [CashEntriesService, CashCategoriesService],
  exports: [CashCategoriesService, TypeOrmModule],
})
export class CashModule {}
