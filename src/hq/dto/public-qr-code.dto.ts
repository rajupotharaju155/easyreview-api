export class PublicQrCodeDto {
  code: string;
  targetUrl: string | null;

  constructor(data: PublicQrCodeDto) {
    Object.assign(this, data);
  }
}
