import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrProductsStorageService } from './qr-products-storage.service';
import { QrProduct } from './entities/qr-product.entity';
import { QrProductCategory } from './entities/qr-product-category.entity';
import { CreateQrProductDto } from './dto/create-qr-product.dto';
import { CreateQrProductCategoryDto } from './dto/create-qr-product-category.dto';
import { UpdateQrProductDto } from './dto/update-qr-product.dto';
import { UpdateQrProductCategoryDto } from './dto/update-qr-product-category.dto';
import { ReorderQrProductsDto } from './dto/reorder-qr-products.dto';

const MAX_IMAGE_URL_LENGTH = 2048;

export type QrProductDto = QrProduct & {
  category?: Pick<QrProductCategory, 'id' | 'name'> | null;
};

export type QrProductCategoryDto = QrProductCategory;

@Injectable()
export class QrProductsService {
  constructor(
    @InjectRepository(QrProductCategory)
    private readonly categoryRepository: Repository<QrProductCategory>,
    @InjectRepository(QrProduct)
    private readonly productRepository: Repository<QrProduct>,
    private readonly storage: QrProductsStorageService,
  ) {}

  async listCategories(): Promise<QrProductCategoryDto[]> {
    return this.categoryRepository.find({
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async createCategory(dto: CreateQrProductCategoryDto): Promise<QrProductCategoryDto> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Category name is required');

    const duplicate = await this.categoryRepository.findOne({
      where: { name },
    });
    if (duplicate) {
      throw new ConflictException('Category already exists');
    }

    const sortOrder = await this.nextSortOrder();
    const category = this.categoryRepository.create({ name, sortOrder });
    return this.categoryRepository.save(category);
  }

  async updateCategory(
    categoryId: string,
    dto: UpdateQrProductCategoryDto,
  ): Promise<QrProductCategoryDto> {
    const category = await this.requireCategory(categoryId);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Category name is required');

      const conflict = await this.categoryRepository.findOne({
        where: { name },
      });
      if (conflict && conflict.id !== categoryId) {
        throw new ConflictException('Category already exists');
      }

      category.name = name;
    }

    return this.categoryRepository.save(category);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await this.requireCategory(categoryId);

    const products = await this.productRepository.find({
      where: { categoryId },
      select: ['id', 'imageUrls'],
    });

    const uniqueImageUrls = [...new Set(products.flatMap((p) => p.imageUrls))];

    await this.productRepository.softDelete({ categoryId });
    await this.categoryRepository.softDelete({ id: categoryId });

    await this.deleteManagedImagesIfUnused(uniqueImageUrls);
  }

  async listProducts(categoryId: string): Promise<QrProductDto[]> {
    await this.requireCategory(categoryId);
    return this.productRepository.find({
      where: { categoryId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createProduct(
    categoryId: string,
    dto: CreateQrProductDto,
  ): Promise<QrProductDto> {
    await this.requireCategory(categoryId);

    const name = dto.name.trim();
    const description = dto.description?.trim() ?? null;
    const dimensions = dto.dimensions?.trim() ?? null;
    const priceInr = Number(dto.priceInr);
    const imageUrls = dto.imageUrls.map((url) => url.trim());

    this.assertImageUrls(imageUrls);

    const sortOrder = await this.nextProductSortOrder(categoryId);
    const product = this.productRepository.create({
      categoryId,
      name,
      description,
      dimensions,
      priceInr,
      imageUrls,
      sortOrder,
    });
    return this.productRepository.save(product);
  }

  async updateProduct(
    productId: string,
    dto: UpdateQrProductDto,
  ): Promise<QrProductDto> {
    const product = await this.requireProduct(productId);

    const previousImageUrls = product.imageUrls ?? [];

    if (dto.name !== undefined) product.name = dto.name.trim();
    if (dto.description !== undefined) {
      product.description = dto.description?.trim() ?? null;
    }
    if (dto.dimensions !== undefined) {
      product.dimensions = dto.dimensions?.trim() ?? null;
    }
    if (dto.priceInr !== undefined) {
      product.priceInr = Number(dto.priceInr);
    }

    if (dto.imageUrls !== undefined) {
      const nextImageUrls = dto.imageUrls.map((url) => url.trim());
      this.assertImageUrls(nextImageUrls);
      product.imageUrls = nextImageUrls;
    }

    const saved = await this.productRepository.save(product);

    const nextImageUrls = saved.imageUrls ?? [];
    const removed = previousImageUrls.filter((url) => !nextImageUrls.includes(url));
    if (removed.length > 0) {
      await this.deleteManagedImagesIfUnused(removed);
    }

    return saved;
  }

  async reorderProducts(
    categoryId: string,
    dto: ReorderQrProductsDto,
  ): Promise<void> {
    await this.requireCategory(categoryId);
    const products = await this.productRepository.find({
      where: { categoryId },
      select: ['id'],
    });
    const knownIds = new Set(products.map((product) => product.id));
    if (
      dto.ids.length !== knownIds.size ||
      dto.ids.some((id) => !knownIds.has(id))
    ) {
      throw new BadRequestException(
        'Reorder list must include every product in this category exactly once',
      );
    }

    await Promise.all(
      dto.ids.map((id, index) =>
        this.productRepository.update({ id, categoryId }, { sortOrder: index }),
      ),
    );
  }

  async deleteProduct(productId: string): Promise<void> {
    const product = await this.requireProduct(productId);
    const imageUrls = product.imageUrls ?? [];
    await this.productRepository.softDelete({ id: productId });
    await this.deleteManagedImagesIfUnused(imageUrls);
  }

  async uploadImage(file: Parameters<QrProductsStorageService['uploadImage']>[0]) {
    return this.storage.uploadImage(file);
  }

  private async nextSortOrder(): Promise<number> {
    const raw = await this.categoryRepository
      .createQueryBuilder('c')
      .select('MAX(c.sortOrder)', 'max')
      .getRawOne<{ max: string | number | null }>();
    return (Number(raw?.max) || 0) + 1;
  }

  private async nextProductSortOrder(categoryId: string): Promise<number> {
    const raw = await this.productRepository
      .createQueryBuilder('p')
      .select('MAX(p.sortOrder)', 'max')
      .where('p.categoryId = :categoryId', { categoryId })
      .getRawOne<{ max: string | number | null }>();
    return (Number(raw?.max) || 0) + 1;
  }

  private requireCategory(categoryId: string): Promise<QrProductCategory> {
    return this.categoryRepository.findOne({ where: { id: categoryId } }).then((c) => {
      if (!c) throw new NotFoundException('Category not found');
      return c;
    });
  }

  private requireProduct(productId: string): Promise<QrProduct> {
    return this.productRepository.findOne({ where: { id: productId } }).then((p) => {
      if (!p) throw new NotFoundException('Product not found');
      return p;
    });
  }

  private assertImageUrls(imageUrls: string[]): void {
    if (imageUrls.length < 1 || imageUrls.length > 3) {
      throw new BadRequestException('Provide between 1 and 3 images');
    }
    const unique = [...new Set(imageUrls)];
    if (unique.length !== imageUrls.length) {
      throw new BadRequestException('Duplicate image URLs are not allowed');
    }
    for (const url of imageUrls) {
      if (!url) throw new BadRequestException('Image URL cannot be empty');
      if (url.startsWith('data:')) {
        throw new BadRequestException('Upload images instead of embedding them');
      }
      if (url.length > MAX_IMAGE_URL_LENGTH) {
        throw new BadRequestException('Image URL is too long');
      }
    }
  }

  private async deleteManagedImagesIfUnused(imageUrls: string[]): Promise<void> {
    const uniqueUrls = [...new Set(imageUrls.filter((url) => Boolean(url)))];
    await Promise.all(
      uniqueUrls.map(async (url) => {
        const stillUsed = await this.productRepository
          .createQueryBuilder('p')
          .where(':url = ANY(p.imageUrls)', { url })
          .getCount();
        if (stillUsed === 0) {
          await this.storage.deleteIfManaged(url);
        }
      }),
    );
  }
}

