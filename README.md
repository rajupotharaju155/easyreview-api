# EasyReview API

NestJS backend for EasyReview.

## Project setup

```bash
yarn install
```

Copy `.env.example` to `.env.staging` / `.env.production` and fill in values.

## Run

```bash
# Staging (watch mode)
yarn staging

# Production (compiled)
yarn build
yarn prod
```

Server starts at `http://localhost:3000`.

## Health check

```bash
curl http://localhost:3000/health
```

## Migrations

```bash
# Create a new migration
yarn migration:create --name=CreateFooTable

# Run migrations
yarn migration:run:staging
yarn migration:run:prod

# Revert last migration
yarn migration:revert:staging
yarn migration:revert:prod
```

## Scripts

| Script | Description |
|--------|-------------|
| `yarn staging` | Run with `NODE_ENV=staging` (watch mode) |
| `yarn production` | Run with `NODE_ENV=production` |
| `yarn build` | Build for production |
| `yarn prod` | Run compiled production build |
| `yarn lint` | Lint and fix TypeScript files |
| `yarn migration:create --name=Name` | Create a new empty migration |
| `yarn migration:run:staging` | Run migrations against staging |
| `yarn migration:revert:staging` | Revert last staging migration |
