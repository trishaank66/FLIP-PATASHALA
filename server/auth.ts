import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "activelearn-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Incorrect email or password" });
          }
          
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return done(null, false, { message: "Incorrect email or password" });
          }
          
          // Check if user account is active (not soft-deleted)
          if (user.is_active === false) {
            console.log(`User ${email} account is inactive, rejecting login.`);
            return done(null, false, { message: "Your account has been deactivated" });
          }
          
          // Check if user is verified
          if (user.verification_pending) {
            // Admin users can always log in
            if (user.role !== 'admin') {
              console.log(`User ${email} is pending verification, rejecting login.`);
              return done(null, false, { message: "Your account is pending verification and approval" });
            }
          }
          
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password, role, role_id } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Validate role_id format based on role
      if (!role_id) {
        return res.status(400).json({ message: `${role.charAt(0).toUpperCase() + role.slice(1)} ID is required` });
      }
      
      // Role-specific validation
      if (role === "student" && !role_id.startsWith("S")) {
        return res.status(400).json({ message: "Student ID must start with 'S' (e.g., S001)" });
      } else if (role === "faculty" && !role_id.startsWith("F")) {
        return res.status(400).json({ message: "Faculty ID must start with 'F' (e.g., F001)" });
      } else if (role === "admin" && !role_id.includes("ADMIN")) {
        return res.status(400).json({ message: "Admin code must include 'ADMIN' (e.g., ADMIN123)" });
      }
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Create user with verification pending
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        role: role || "student",
        role_id,
        verification_pending: true,
        is_active: true, // Ensure account is active on creation
        department_id: req.body.department_id ? Number(req.body.department_id) : null,
        first_name: req.body.first_name || null,
        last_name: req.body.last_name || null
      });
      
      // Remove password from response
      const userResponse = { ...user };
      delete (userResponse as any).password;
      
      // For demo purposes, automatically verify admin accounts
      if (role === "admin" && role_id === "ADMIN001") {
        await storage.updateUserVerification(user.id, false);
        userResponse.verification_pending = false;
      }
      
      // Only log in admin users automatically after registration 
      // Students and faculty should wait for approval
      if (role === "admin") {
        req.login(user, (err) => {
          if (err) {
            return res.status(500).json({ message: "Error during login" });
          }
          
          // Send response
          res.status(201).json({
            ...userResponse,
            message: "Registration successful! Your admin account has been verified."
          });
        });
      } else {
        // Don't log in students and faculty automatically
        res.status(201).json({
          ...userResponse,
          message: "Registration successful! Your account is pending approval. Please wait for an administrator to verify your account before logging in."
        });
      }
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Remove password from response
        const userResponse = { ...user };
        delete (userResponse as any).password;
        
        return res.status(200).json(userResponse);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    // Remove password from response
    const user = { ...req.user };
    delete (user as any).password;
    
    res.json(user);
  });
}
