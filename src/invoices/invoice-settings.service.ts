import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../locations/entities/location.entity';
import { LocationAccessService } from '../locations/location-access.service';
import { UpdateInvoiceSettingsDto } from './dto/invoice-settings.dto';
import { InvoiceSettings } from './entities/invoice-settings.entity';
import { stateCodeFromName, stateNameFromCode } from './gst/gst-states';
import { gstinStateCode, isValidGstin } from './gst/gstin';
import { DEFAULT_INVOICE_PREFIX } from './invoice-number';
import type { InvoiceSupplier } from './invoice-snapshots';

export type InvoiceSettingsDto = {
  /** False until the business saves settings; values are prefilled from the location. */
  configured: boolean;
  locationId: string;
  legalName: string;
  gstin: string | null;
  stateCode: string | null;
  stateName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  /** The business logo (`locations.logoUrl`); changed via `/locations/:id/logo`. */
  logoUrl: string | null;
  invoicePrefix: string;
  defaultDueDays: number | null;
  defaultNotes: string | null;
  defaultTerms: string | null;
  roundOffTotal: boolean;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  upiId: string | null;
};

@Injectable()
export class InvoiceSettingsService {
  constructor(
    @InjectRepository(InvoiceSettings)
    private readonly settingsRepository: Repository<InvoiceSettings>,
    private readonly locationAccess: LocationAccessService,
  ) {}

  async get(locationId: string): Promise<InvoiceSettingsDto> {
    const { location, settings } = await this.load(locationId);
    return this.toDto(settings, location);
  }

  async update(
    locationId: string,
    dto: UpdateInvoiceSettingsDto,
  ): Promise<InvoiceSettingsDto> {
    const { location, settings: current } = await this.load(locationId);

    const gstin = dto.gstin ?? null;
    let stateCode = dto.stateCode ?? stateCodeFromName(location.state);
    if (gstin) {
      if (!isValidGstin(gstin)) {
        throw new BadRequestException('GSTIN is not valid');
      }
      if (dto.stateCode && dto.stateCode !== gstinStateCode(gstin)) {
        throw new BadRequestException('State does not match the GSTIN');
      }
      stateCode = gstinStateCode(gstin);
    }

    const settings = Object.assign(
      current.id ? current : new InvoiceSettings({ locationId }),
      {
        legalName: dto.legalName,
        gstin,
        stateCode,
        address: dto.address ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        invoicePrefix: dto.invoicePrefix ?? DEFAULT_INVOICE_PREFIX,
        defaultDueDays: dto.defaultDueDays ?? null,
        defaultNotes: dto.defaultNotes ?? null,
        defaultTerms: dto.defaultTerms ?? null,
        roundOffTotal: dto.roundOffTotal ?? true,
        bankAccountName: dto.bankAccountName ?? null,
        bankAccountNumber: dto.bankAccountNumber ?? null,
        bankIfsc: dto.bankIfsc ?? null,
        bankName: dto.bankName ?? null,
        upiId: dto.upiId ?? null,
      },
    );

    return this.toDto(await this.settingsRepository.save(settings), location);
  }

  /**
   * The current user's location and its invoice settings, in one query.
   * Settings that were never saved come back prefilled from the location,
   * without an `id`.
   */
  async load(
    locationId: string,
  ): Promise<{ location: Location; settings: InvoiceSettings }> {
    // Saved settings are mapped onto the location by the join below.
    const location: (Location & { invoiceSettings?: InvoiceSettings }) | null =
      await this.locationAccess
        .ownedQuery(locationId)
        .select([
          'location.id',
          'location.name',
          'location.state',
          'location.formattedAddress',
          'location.phoneNumber',
          'location.logoUrl',
        ])
        .leftJoinAndMapOne(
          'location.invoiceSettings',
          InvoiceSettings,
          'settings',
          'settings.locationId = location.id',
        )
        .getOne();
    if (!location) throw this.locationAccess.notFound(locationId);
    return {
      location,
      settings: location.invoiceSettings ?? this.defaultsFor(location),
    };
  }

  private defaultsFor(location: Location): InvoiceSettings {
    return new InvoiceSettings({
      locationId: location.id,
      legalName: location.name,
      gstin: null,
      stateCode: stateCodeFromName(location.state),
      address: location.formattedAddress,
      phone: location.phoneNumber,
      email: null,
      invoicePrefix: DEFAULT_INVOICE_PREFIX,
      defaultDueDays: null,
      defaultNotes: null,
      defaultTerms: null,
      roundOffTotal: true,
      bankAccountName: null,
      bankAccountNumber: null,
      bankIfsc: null,
      bankName: null,
      upiId: null,
    });
  }

  toSupplier(settings: InvoiceSettings, location: Location): InvoiceSupplier {
    return {
      legalName: settings.legalName,
      gstin: settings.gstin,
      address: settings.address,
      stateCode: settings.stateCode,
      phone: settings.phone,
      email: settings.email,
      logoUrl: location.logoUrl,
      bankAccountName: settings.bankAccountName,
      bankAccountNumber: settings.bankAccountNumber,
      bankIfsc: settings.bankIfsc,
      bankName: settings.bankName,
      upiId: settings.upiId,
    };
  }

  private toDto(
    settings: InvoiceSettings,
    location: Location,
  ): InvoiceSettingsDto {
    return {
      configured: Boolean(settings.id),
      locationId: settings.locationId,
      legalName: settings.legalName,
      gstin: settings.gstin,
      stateCode: settings.stateCode,
      stateName: stateNameFromCode(settings.stateCode),
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      logoUrl: location.logoUrl,
      invoicePrefix: settings.invoicePrefix,
      defaultDueDays: settings.defaultDueDays,
      defaultNotes: settings.defaultNotes,
      defaultTerms: settings.defaultTerms,
      roundOffTotal: settings.roundOffTotal,
      bankAccountName: settings.bankAccountName,
      bankAccountNumber: settings.bankAccountNumber,
      bankIfsc: settings.bankIfsc,
      bankName: settings.bankName,
      upiId: settings.upiId,
    };
  }
}
