import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PublicQrCodeDto } from './dto/public-qr-code.dto';
import { HqService } from './hq.service';

@Controller('qr-codes')
export class QrCodesController {
  constructor(private readonly hqService: HqService) {}

  @Public()
  @Get(':code')
  resolve(@Param('code') code: string): Promise<PublicQrCodeDto> {
    return this.hqService.resolveQrCode(code);
  }
}
