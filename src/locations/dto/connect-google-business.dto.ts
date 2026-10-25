import { CreateLocationDto } from './create-location.dto';

/**
 * Google place details to connect to an existing location. Same shape as the
 * create payload, but placeId is required (checked in the service, since
 * class-validator would still apply the parent's @IsOptional).
 */
export class ConnectGoogleBusinessDto extends CreateLocationDto {}
