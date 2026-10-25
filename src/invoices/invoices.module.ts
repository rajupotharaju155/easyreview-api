import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashModule } from '../cash/cash.module';
import { ContactsModule } from '../contacts/contacts.module';
import { CashEntry } from '../cash/entities/cash-entry.entity';
import { LocationAccessModule } from '../locations/location-access.module';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoiceNumberSequence } from './entities/invoice-number-sequence.entity';
import { InvoiceSettings } from './entities/invoice-settings.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceSettingsService } from './invoice-settings.service';
import { InvoiceSettingsController } from './invoice-settings.controller';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

/**
 * Invoices for EasyCash: business invoice settings, invoices and line items.
 * Payments against invoices are stored as cash entries.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CashEntry,
      Invoice,
      InvoiceItem,
      InvoiceSettings,
      InvoiceNumberSequence,
    ]),
    ContactsModule,
    LocationAccessModule,
    CashModule,
  ],
  controllers: [InvoiceSettingsController, InvoicesController],
  providers: [InvoiceSettingsService, InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
