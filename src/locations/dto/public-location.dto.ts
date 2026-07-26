export class PublicLocationDto {
  name: string;
  placeId: string;
  slug: string;
  city: string | null;
  state: string | null;
  keywords: string[] | null;
  languages: string[] | null;

  constructor(data: PublicLocationDto) {
    Object.assign(this, data);
  }
}
