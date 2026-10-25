import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { stateNameFromCode } from '../invoices/gst/gst-states';
import { gstinStateCode, isValidGstin } from '../invoices/gst/gstin';
import type { InvoiceBillTo } from '../invoices/invoice-snapshots';
import { LocationAccessService } from '../locations/location-access.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomersQueryDto } from './dto/customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Contact } from './entities/contact.entity';
import { Customer } from './entities/customer.entity';

export type CustomerDto = {
  id: string;
  locationId: string;
  contactId: string;
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  billingAddress: string | null;
  city: string | null;
  stateCode: string | null;
  stateName: string | null;
  pincode: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly locationAccess: LocationAccessService,
    private readonly dataSource: DataSource,
  ) {}

  async list(
    locationId: string,
    query: CustomersQueryDto,
  ): Promise<PaginatedResponseDto<CustomerDto>> {
    await this.locationAccess.requireOwned(locationId);
    const { page = 1, limit = 10, search } = query;

    const qb = this.customerRepository
      .createQueryBuilder('customer')
      .innerJoinAndSelect('customer.contact', 'contact')
      .where('customer.locationId = :locationId', { locationId });

    if (search) {
      const term = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere(
        `(contact.name ILIKE :term OR contact.companyName ILIKE :term
          OR contact.phone ILIKE :term OR contact.email ILIKE :term
          OR customer.gstin ILIKE :term)`,
        { term },
      );
    }

    const [customers, total] = await qb
      .orderBy('contact.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return new PaginatedResponseDto(
      customers.map((customer) => this.toDto(customer)),
      total,
      page,
      limit,
    );
  }

  async get(locationId: string, customerId: string): Promise<CustomerDto> {
    await this.locationAccess.requireOwned(locationId);
    return this.toDto(await this.requireCustomer(locationId, customerId));
  }

  async create(
    locationId: string,
    dto: CreateCustomerDto,
  ): Promise<CustomerDto> {
    await this.locationAccess.requireOwned(locationId);
    const gst = this.resolveGst(dto.gstin ?? null, dto.stateCode ?? null);
    const phone = dto.phone ?? null;
    await this.assertPhoneAvailable(locationId, phone);

    const customerId = await this.dataSource.transaction(async (manager) => {
      // Reuse the contact left behind by a removed customer with this phone.
      const existingContact = phone
        ? await manager.findOne(Contact, { where: { locationId, phone } })
        : null;

      const contact = await manager.save(
        Object.assign(existingContact ?? new Contact({ locationId }), {
          name: dto.name,
          phone,
          email: dto.email ?? null,
          companyName: dto.companyName ?? null,
        }),
      );

      const customer = await manager.save(
        new Customer({
          locationId,
          contactId: contact.id,
          gstin: gst.gstin,
          stateCode: gst.stateCode,
          billingAddress: dto.billingAddress ?? null,
          city: dto.city ?? null,
          pincode: dto.pincode ?? null,
          notes: dto.notes ?? null,
        }),
      );
      return customer.id;
    });

    return this.toDto(await this.requireCustomer(locationId, customerId));
  }

  async update(
    locationId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerDto> {
    await this.locationAccess.requireOwned(locationId);
    const customer = await this.requireCustomer(locationId, customerId);
    const { contact } = customer;

    if (dto.phone !== undefined && dto.phone !== contact.phone) {
      await this.assertPhoneAvailable(locationId, dto.phone, customer.id);
    }

    const gstinChanged = dto.gstin !== undefined;
    const stateChanged = dto.stateCode !== undefined;
    if (gstinChanged || stateChanged) {
      const nextGstin = gstinChanged ? (dto.gstin ?? null) : customer.gstin;
      // A new GSTIN without an explicit state takes the GSTIN's state.
      const nextState = stateChanged
        ? (dto.stateCode ?? null)
        : gstinChanged && nextGstin
          ? null
          : customer.stateCode;
      const gst = this.resolveGst(nextGstin, nextState);
      customer.gstin = gst.gstin;
      customer.stateCode = gst.stateCode;
    }

    if (dto.name !== undefined) contact.name = dto.name;
    if (dto.companyName !== undefined) contact.companyName = dto.companyName;
    if (dto.phone !== undefined) contact.phone = dto.phone;
    if (dto.email !== undefined) contact.email = dto.email;
    if (dto.billingAddress !== undefined) {
      customer.billingAddress = dto.billingAddress;
    }
    if (dto.city !== undefined) customer.city = dto.city;
    if (dto.pincode !== undefined) customer.pincode = dto.pincode;
    if (dto.notes !== undefined) customer.notes = dto.notes;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(contact);
      await manager.save(customer);
    });

    return this.toDto(await this.requireCustomer(locationId, customerId));
  }

  /** Soft delete. Issued invoices keep their own copy of the details. */
  async remove(locationId: string, customerId: string): Promise<void> {
    await this.locationAccess.requireOwned(locationId);
    const customer = await this.requireCustomer(locationId, customerId);
    await this.customerRepository.softRemove(customer);
  }

  /** For callers that have already checked access to the location. */
  async requireCustomer(
    locationId: string,
    customerId: string,
  ): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId, locationId },
      relations: { contact: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  toBillTo(customer: Customer): InvoiceBillTo {
    return {
      name: customer.contact.name,
      companyName: customer.contact.companyName,
      phone: customer.contact.phone,
      email: customer.contact.email,
      gstin: customer.gstin,
      address: customer.billingAddress,
      city: customer.city,
      stateCode: customer.stateCode,
      pincode: customer.pincode,
    };
  }

  private toDto(customer: Customer): CustomerDto {
    return {
      id: customer.id,
      locationId: customer.locationId,
      contactId: customer.contactId,
      name: customer.contact.name,
      companyName: customer.contact.companyName,
      phone: customer.contact.phone,
      email: customer.contact.email,
      gstin: customer.gstin,
      billingAddress: customer.billingAddress,
      city: customer.city,
      stateCode: customer.stateCode,
      stateName: stateNameFromCode(customer.stateCode),
      pincode: customer.pincode,
      notes: customer.notes,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  /** Validates the GSTIN and keeps the state in line with it. */
  private resolveGst(
    gstin: string | null,
    stateCode: string | null,
  ): { gstin: string | null; stateCode: string | null } {
    if (!gstin) {
      return { gstin: null, stateCode };
    }
    if (!isValidGstin(gstin)) {
      throw new BadRequestException('GSTIN is not valid');
    }
    const gstinState = gstinStateCode(gstin);
    if (stateCode && stateCode !== gstinState) {
      throw new BadRequestException(
        `State does not match the GSTIN (GSTIN is registered in ${stateNameFromCode(gstinState)})`,
      );
    }
    return { gstin, stateCode: gstinState };
  }

  private async assertPhoneAvailable(
    locationId: string,
    phone: string | null,
    exceptCustomerId?: string,
  ): Promise<void> {
    if (!phone) return;
    const qb = this.customerRepository
      .createQueryBuilder('customer')
      .innerJoin('customer.contact', 'contact')
      .where('customer.locationId = :locationId', { locationId })
      .andWhere('contact.phone = :phone', { phone });
    if (exceptCustomerId) {
      qb.andWhere('customer.id != :exceptCustomerId', { exceptCustomerId });
    }
    if (await qb.getExists()) {
      throw new ConflictException('A customer with this phone already exists');
    }
  }
}
