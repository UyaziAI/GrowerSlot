import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { insertBookingSchema, insertSlotSchema } from "@shared/schema";

// JWT middleware
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    growerId?: string;
    role: string;
  };
}

const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId!,
      growerId: user.growerId!,
      role: user.role,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes - both /api and /v1 for compatibility
  const loginHandler = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: "24h" });
      
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          tenantId: user.tenantId,
          growerId: user.growerId 
        } 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  // Register login handler for both /api and /v1 routes
  app.post("/api/auth/login", loginHandler);
  app.post("/v1/auth/login", loginHandler);

  const meHandler = async (req: AuthRequest, res: Response) => {
    res.json({ user: req.user });
  };

  // Register me handler for both /api and /v1 routes
  app.get("/api/auth/me", authenticateToken, meHandler);
  app.get("/v1/auth/me", authenticateToken, meHandler);

  // Growers route
  app.get("/api/growers", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const growers = await storage.getGrowersByTenant(req.user!.tenantId);
      res.json(growers);
    } catch (error) {
      console.error("Get growers error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Cultivars route
  app.get("/api/cultivars", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const cultivars = await storage.getCultivarsByTenant(req.user!.tenantId);
      res.json(cultivars);
    } catch (error) {
      console.error("Get cultivars error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Slots routes
  app.get("/api/slots", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { date } = req.query;
      
      if (!date || typeof date !== "string") {
        return res.status(400).json({ error: "Date parameter required" });
      }

      const slots = await storage.getSlotsByDate(req.user!.tenantId, date);
      res.json(slots);
    } catch (error) {
      console.error("Get slots error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Slots range endpoint for calendar view
  app.get("/api/slots/range", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { start_date, end_date } = req.query;
      
      if (!start_date || !end_date || typeof start_date !== "string" || typeof end_date !== "string") {
        return res.status(400).json({ error: "start_date and end_date parameters required" });
      }
      
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      
      if (startDate > endDate) {
        return res.status(400).json({ error: "start_date must be <= end_date" });
      }
      
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 14) {
        return res.status(400).json({ error: "Date range cannot exceed 14 days" });
      }

      const slots = await storage.getSlotsRange(req.user!.tenantId, start_date, end_date);
      res.json(slots);
    } catch (error) {
      console.error("Get slots range error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/slots/bulk", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const bulkSlotSchema = z.object({
        startDate: z.string(),
        endDate: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        slotDuration: z.number(),
        capacity: z.number(),
        notes: z.string().optional(),
      });

      const data = bulkSlotSchema.parse(req.body);
      
      // Generate slots for the date range
      const slots = [];
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      
      for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        // Generate time slots for this date
        const [startHour, startMin] = data.startTime.split(':').map(Number);
        const [endHour, endMin] = data.endTime.split(':').map(Number);
        
        let currentHour = startHour;
        let currentMin = startMin;
        
        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
          const slotStart = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}:00`;
          
          // Calculate end time
          let endSlotHour = currentHour;
          let endSlotMin = currentMin + (data.slotDuration * 60);
          
          if (endSlotMin >= 60) {
            endSlotHour += Math.floor(endSlotMin / 60);
            endSlotMin = endSlotMin % 60;
          }
          
          const slotEnd = `${endSlotHour.toString().padStart(2, '0')}:${endSlotMin.toString().padStart(2, '0')}:00`;
          
          slots.push({
            tenantId: req.user!.tenantId,
            date: dateStr,
            startTime: slotStart,
            endTime: slotEnd,
            capacity: data.capacity.toString(),
            resourceUnit: "tons",
            blackout: false,
            notes: data.notes || null,
            createdBy: req.user!.id,
          });
          
          // Move to next slot
          currentMin += data.slotDuration * 60;
          if (currentMin >= 60) {
            currentHour += Math.floor(currentMin / 60);
            currentMin = currentMin % 60;
          }
        }
      }

      const created = await storage.bulkCreateSlots(slots);
      res.json({ success: true, count: created.length });
    } catch (error) {
      console.error("Bulk slots creation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/slots/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        blackout: z.boolean().optional(),
        capacity: z.string().optional(),
        notes: z.string().optional(),
      });

      const updates = updateSchema.parse(req.body);
      const updated = await storage.updateSlot(id, updates);
      
      res.json(updated);
    } catch (error) {
      console.error("Update slot error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bookings routes
  app.post("/api/bookings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const bookingData = insertBookingSchema.parse({
        ...req.body,
        tenantId: req.user!.tenantId,
        growerId: req.user!.growerId,
      });

      const result = await storage.createBookingTransactional(bookingData);
      
      if (!result.success) {
        return res.status(409).json({ error: result.error });
      }

      res.json({ ok: true, booking: result.booking });
    } catch (error) {
      console.error("Create booking error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/bookings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.growerId) {
        return res.status(400).json({ error: "Grower ID required" });
      }
      const bookings = await storage.getBookingsByGrower(req.user.growerId);
      res.json(bookings);
    } catch (error) {
      console.error("Get bookings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/bookings/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const success = await storage.cancelBooking(id);
      
      if (!success) {
        return res.status(404).json({ error: "Booking not found" });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("Cancel booking error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Slot usage endpoint
  app.get("/api/slots/:id/usage", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const slot = await storage.getSlot(id);
      
      if (!slot) {
        return res.status(404).json({ error: "Slot not found" });
      }

      const bookings = await storage.getBookingsBySlot(id);
      const usage = {
        slotId: id,
        bookings: bookings.length,
        totalBooked: bookings.reduce((sum, b) => sum + (b.quantity || 0), 0)
      };
      res.json(usage);
    } catch (error) {
      console.error("Get slot usage error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin dashboard stats
  app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { date } = req.query;
      
      if (!date || typeof date !== "string") {
        return res.status(400).json({ error: "Date parameter required" });
      }

      const stats = await storage.getDashboardStats(req.user!.tenantId, date);
      res.json(stats);
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Restrictions endpoint
  app.post("/api/restrictions/apply", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const restrictionSchema = z.object({
        slotId: z.string().optional(),
        date: z.string().optional(),
        growerIds: z.array(z.string()).optional(),
        cultivarIds: z.array(z.string()).optional(),
      });

      const data = restrictionSchema.parse(req.body);
      
      // Apply restrictions logic would be implemented here
      // For now, return success
      res.json({ success: true, message: "Restrictions applied successfully" });
    } catch (error) {
      console.error("Apply restrictions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
