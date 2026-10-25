import type { CreateLocationDto } from './dto/create-location.dto';
import type { Location } from './entities/location.entity';

export type GooglePlaceFields = Pick<
  Location,
  | 'name'
  | 'placeId'
  | 'addressLine1'
  | 'localArea'
  | 'city'
  | 'state'
  | 'pincode'
  | 'country'
  | 'formattedAddress'
  | 'phoneNumber'
  | 'websiteURI'
  | 'googleMapsURI'
  | 'businessStatus'
  | 'primaryType'
  | 'primaryTypeDisplayName'
  | 'types'
  | 'currentRating'
  | 'currentReviewCount'
>;

/**
 * Location columns that come from a Google place, or that the owner typed
 * for a business not on Google. Missing values become null.
 */
export function googlePlaceFields(dto: CreateLocationDto): GooglePlaceFields {
  return {
    name: dto.name,
    placeId: dto.placeId ?? null,
    addressLine1: dto.addressLine1 ?? null,
    localArea: dto.localArea ?? null,
    city: dto.city ?? null,
    state: dto.state ?? null,
    pincode: dto.pincode ?? null,
    country: dto.country ?? null,
    formattedAddress: dto.formattedAddress ?? null,
    phoneNumber: dto.phoneNumber ?? null,
    websiteURI: dto.websiteURI ?? null,
    googleMapsURI: dto.googleMapsURI ?? null,
    businessStatus: dto.businessStatus ?? null,
    primaryType: dto.primaryType ?? null,
    primaryTypeDisplayName: dto.primaryTypeDisplayName ?? null,
    types: dto.types?.length ? dto.types : null,
    currentRating: dto.rating ?? null,
    currentReviewCount: dto.userRatingCount ?? null,
  };
}

/**
 * Google values that are actually present. Used when connecting an existing
 * business, so a field Google leaves blank keeps what the owner entered.
 */
export function nonEmptyGooglePlaceFields(
  dto: CreateLocationDto,
): Partial<GooglePlaceFields> {
  return Object.fromEntries(
    Object.entries(googlePlaceFields(dto)).filter(
      ([, value]) => value !== null && value !== '',
    ),
  );
}

export const GOOGLE_BUSINESS_REQUIRED_MESSAGE =
  'Connect your Google Business to use EasyReview';

/** EasyReview needs a Google place; other products work without one. */
export function hasGooglePlace(location: Pick<Location, 'placeId'>): boolean {
  return Boolean(location.placeId);
}
