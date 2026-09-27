import { IsString, MinLength } from 'class-validator';

export class VerifyRazorpayPaymentDto {
  @IsString()
  @MinLength(1)
  razorpay_order_id: string;

  @IsString()
  @MinLength(1)
  razorpay_payment_id: string;

  @IsString()
  @MinLength(1)
  razorpay_signature: string;
}
