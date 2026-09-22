import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileLead } from './entities/profile-lead.entity';
import { ProfileLink } from './entities/profile-link.entity';
import { Profile } from './entities/profile.entity';
import { ProfileStorageService } from './profile-storage.service';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { PublicProfilesController } from './public-profiles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Profile, ProfileLink, ProfileLead])],
  controllers: [ProfilesController, PublicProfilesController],
  providers: [ProfilesService, ProfileStorageService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
