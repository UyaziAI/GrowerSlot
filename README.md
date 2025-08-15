# Grower Slot SaaS - Unified Blueprint Implementation

A comprehensive multi-tenant delivery slot booking platform for packhouses with extensibility for logistics, quality management, and compliance tracking.

## Architecture

This implementation follows the unified blueprint specification with:

- **Frontend**: React + Vite + TanStack Query + Tailwind CSS
- **Backend**: FastAPI (Python) with asyncpg for PostgreSQL
- **Database**: PostgreSQL with extensibility tables
- **Authentication**: JWT-based with role-based access control

## Project Structure

```
/app
  /frontend          # React application  
    /src
      /api           # API client and endpoints
      /features      # Feature modules (booking, logistics, etc.)
      /core          # Auth and shared utilities
  /backend           # FastAPI application
    /routers         # API route handlers  
    main.py          # FastAPI app entry point
    db.py            # Database utilities
    security.py      # Auth and JWT handling
    schemas.py       # Pydantic models
  /infra             # Database migrations
    001_init.sql     # Core MVP tables
    002_seed.sql     # Development seed data
    101_*.sql        # Extensibility tables
```

## Quick Start

### 1. Environment Setup

Copy the example environment file:
```bash
cp .env.example .env
```

Update the environment variables with your database credentials and API keys.

### 2. Database Setup  

Run the migrations to set up your database:
```bash
./app/infra/run_migrations.sh $DATABASE_URL
```

Or run them individually:
```bash
psql $DATABASE_URL -f app/infra/001_init.sql
psql $DATABASE_URL -f app/infra/002_seed.sql
psql $DATABASE_URL -f app/infra/101_parties_products.sql
psql $DATABASE_URL -f app/infra/102_logistics.sql
psql $DATABASE_URL -f app/infra/103_events_rules.sql
```

### 3. Backend Development

Install Python dependencies:
```bash
pip install -r requirements.txt  # or use the packager tool
```

Start the FastAPI development server:
```bash
cd app/backend
uvicorn main:app --reload --port 8000
```

### 4. Frontend Development  

The frontend is already integrated with the current setup. For the new structure:
```bash
cd app/frontend
npm install
npm run dev
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info

### Slots (v1)
- `GET /v1/slots?date=YYYY-MM-DD` - Get slots for date
- `POST /v1/slots/bulk` - Bulk create slots
- `PATCH /v1/slots/{id}` - Update slot
- `GET /v1/slots/{id}/usage` - Get slot capacity usage

### Bookings (v1)
- `POST /v1/bookings` - Create booking (with atomic capacity checking)
- `GET /v1/bookings?date=&grower_id=` - Get bookings
- `DELETE /v1/bookings/{id}` - Cancel booking

### Logistics (v1) 
- `POST /v1/logistics/consignments` - Create consignment from booking
- `GET /v1/logistics/consignments?date=` - List consignments  
- `POST /v1/logistics/consignments/{id}/checkpoints` - Add checkpoint

### Restrictions (v1)
- `POST /v1/restrictions/apply` - Apply slot restrictions

## Features

### MVP Features ✓
- Multi-tenant slot booking system
- Transactional booking with capacity controls
- Admin tools for slot management and blackouts
- Grower self-service booking interface
- JWT authentication with role-based access
- Email notifications (ready for integration)

### Extensibility Features ✓
- Logistics tracking with consignments and checkpoints
- Domain events and outbox pattern for integrations
- Generic parties model for future stakeholders
- Products and variants structure
- Rules engine foundation

### Feature Flags

Enable/disable features using environment variables:
- `VITE_FEATURE_LOGISTICS=true` - Enable logistics tracking UI
- `VITE_FEATURE_QUALITY=false` - Quality inspections (future)
- `VITE_FEATURE_COMPLIANCE=false` - Compliance docs (future)
- `VITE_FEATURE_REPORTS=false` - Advanced reporting (future)

## Development Credentials

Default development users (password: `password123`):
- **Admin**: admin@demo.com  
- **Grower**: grower@lowveld.com

## Deployment

### Development
- Frontend: Vite dev server on port 5173
- Backend: FastAPI on port 8000
- Database: Local PostgreSQL or Supabase

### Production
- Frontend: Deploy to Vercel/Netlify
- Backend: Deploy to Replit/Render/Fly.io  
- Database: Supabase or managed PostgreSQL

## Testing

The implementation includes:
- Atomic booking concurrency protection using `SELECT ... FOR UPDATE`
- Domain event emission after successful operations
- Comprehensive input validation using Pydantic
- RBAC with tenant isolation

Test the booking concurrency by attempting to book the same slot simultaneously - one request should succeed with 200, the other should fail with 409.

## Next Steps

1. **Phase 1**: Add restrictions UI, week view, CSV export
2. **Phase 2**: Complete logistics UI, implement webhook delivery
3. **Phase 3**: Quality inspections, compliance docs, advanced analytics

## License

Proprietary - Grower Slot SaaS Platform