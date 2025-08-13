"""
FastAPI backend for Grower Slot SaaS
Main application entry point
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from contextlib import asynccontextmanager

from .routers import auth, slots, bookings, restrictions, logistics
from .db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown - cleanup if needed
    pass


app = FastAPI(
    title="Grower Slot SaaS API",
    description="Multi-tenant delivery slot booking platform for packhouses",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(slots.router, prefix="/v1/slots", tags=["slots"])
app.include_router(bookings.router, prefix="/v1/bookings", tags=["bookings"])
app.include_router(restrictions.router, prefix="/v1/restrictions", tags=["restrictions"])
app.include_router(logistics.router, prefix="/v1/logistics", tags=["logistics"])

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)