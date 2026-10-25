import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationAccessModule } from '../locations/location-access.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { Contact } from './entities/contact.entity';
import { Customer } from './entities/customer.entity';

/**
 * Shared people records for a business. EasyInvoice uses customers today;
 * EasyLeads will add leads on top of the same contacts.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, Customer]),
    LocationAccessModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class ContactsModule {}
