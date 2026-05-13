import { Module } from '@nestjs/common';
import { BoxersController } from './boxers.controller';
import { BoxersService } from './boxers.service';
import { PassportOcrService } from './passport-ocr.service';

@Module({
  controllers: [BoxersController],
  providers: [BoxersService, PassportOcrService],
  exports: [BoxersService],
})
export class BoxersModule {}
