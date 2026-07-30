import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type PlaceDetailsSnapshot = {
  placeId: string;
  rating: number | null;
  userRatingCount: number | null;
};

type PlacesApiPlaceResponse = {
  id?: string;
  rating?: number;
  userRatingCount?: number;
  error?: {
    message?: string;
    status?: string;
  };
};

@Injectable()
export class GooglePlacesService {
  constructor(private readonly configService: ConfigService) {}

  async fetchPlaceDetails(placeId: string): Promise<PlaceDetailsSnapshot> {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GOOGLE_MAPS_API_KEY is not configured',
      );
    }

    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,rating,userRatingCount',
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Places request failed';
      throw new BadGatewayException(
        `Failed to fetch place details: ${message}`,
      );
    }

    let body: PlacesApiPlaceResponse;
    try {
      body = (await response.json()) as PlacesApiPlaceResponse;
    } catch {
      throw new BadGatewayException(
        `Failed to fetch place details: invalid response (${response.status})`,
      );
    }

    if (!response.ok) {
      const message =
        body.error?.message ||
        `Places API returned ${response.status}`;
      throw new BadGatewayException(
        `Failed to fetch place details: ${message}`,
      );
    }

    return {
      placeId: body.id || placeId,
      rating: typeof body.rating === 'number' ? body.rating : null,
      userRatingCount:
        typeof body.userRatingCount === 'number' ? body.userRatingCount : null,
    };
  }
}
