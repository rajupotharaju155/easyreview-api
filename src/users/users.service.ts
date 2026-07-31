import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository, UpdateResult } from 'typeorm';
import { generateHashPassword } from '../common/utils/token.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await generateHashPassword(createUserDto.password);

    try {
      const user = this.userRepository.create({
        email: createUserDto.email,
        name: createUserDto.name,
        password: hashedPassword,
        emailVerified: false,
        emailVerificationOtp: null,
        emailVerificationOtpExpiresAt: null,
      });
      return await this.userRepository.save(user);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { googleSub } });
  }

  async createFromGoogle(data: {
    email: string;
    name: string | null;
    googleSub: string;
  }): Promise<User> {
    try {
      const user = this.userRepository.create({
        email: data.email,
        name: data.name,
        password: null,
        googleSub: data.googleSub,
        emailVerified: true,
        emailVerificationOtp: null,
        emailVerificationOtpExpiresAt: null,
      });
      return await this.userRepository.save(user);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async linkGoogleAccount(
    userId: string,
    googleSub: string,
    name?: string | null,
  ): Promise<User> {
    const fields: Partial<User> = {
      googleSub,
      emailVerified: true,
      emailVerificationOtp: null,
      emailVerificationOtpExpiresAt: null,
    };
    if (name) {
      const existing = await this.findOne(userId);
      if (!existing.name) {
        fields.name = name;
      }
    }
    await this.userRepository.update(userId, fields);
    return this.findOne(userId);
  }

  async setEmailVerificationOtp(
    userId: string,
    otp: string,
    expiresAt: Date,
  ): Promise<User> {
    await this.userRepository.update(userId, {
      emailVerificationOtp: otp,
      emailVerificationOtpExpiresAt: expiresAt,
    });
    return this.findOne(userId);
  }

  async markEmailVerified(userId: string): Promise<User> {
    await this.userRepository.update(userId, {
      emailVerified: true,
      emailVerificationOtp: null,
      emailVerificationOtpExpiresAt: null,
    });
    return this.findOne(userId);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    await this.findOne(id);

    const data: Partial<User> = {
      email: updateUserDto.email,
      name: updateUserDto.name,
    };

    if (updateUserDto.password) {
      data.password = await generateHashPassword(updateUserDto.password);
    }

    try {
      await this.userRepository.update(id, data);
      return await this.findOne(id);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<UpdateResult> {
    await this.findOne(id);
    return this.userRepository.softDelete(id);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    );
  }
}
