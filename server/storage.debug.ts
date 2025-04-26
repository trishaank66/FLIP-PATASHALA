import { users, verificationLogs, auditLogs, type User, type InsertUser, type VerificationLog, type InsertVerificationLog } from "@shared/schema";
import createMemoryStore from "memorystore";
import session from "express-session";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import { parse } from 'csv-parse';

const readFile = promisify(fs.readFile);

const PostgresSessionStore = connectPg(session);
const MemoryStore = createMemoryStore(session);

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserVerification(id: number, status: boolean): Promise<User | undefined>;
  verifyStudentById(studentId: string): Promise<boolean>;
  logVerificationAttempt(log: InsertVerificationLog): Promise<VerificationLog>;
  getVerificationLogs(userId: number): Promise<VerificationLog[]>;
  getPendingAdmins(): Promise<User[]>;
  getPendingFaculty(): Promise<User[]>;
  verifyAdmin(id: number): Promise<User | undefined>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
    
    // Create initial admin user for testing if it doesn't exist
    this.getUserByEmail("admin@activelearn.edu").then(user => {
      if (!user) {
        this.createUser({
          email: "admin@activelearn.edu",
          password: "$2b$10$J3GvURKjtekuqKdvz7jJ8.Py.K1VoSxtkS5fG5fGIFUwA4.h3dIOW", // "password123"
          role: "admin",
          role_id: "ADMIN001",
          verification_pending: false
        });
      }
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserVerification(id: number, status: boolean): Promise<User | undefined> {
    const now = new Date();
    const [user] = await db
      .update(users)
      .set({ 
        verification_pending: status,
        verified_at: status ? null : now  // If status is false (not pending), set verified_at to now
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async verifyStudentById(studentId: string): Promise<boolean> {
    try {
      console.log(`[DEBUG] Attempting to verify student ID: ${studentId}`);
      
      // Read and parse the CSV file
      const csvFilePath = path.resolve('data/students.csv');
      console.log(`[DEBUG] CSV file path: ${csvFilePath}`);
      
      const csvData = await readFile(csvFilePath, 'utf8');
      console.log(`[DEBUG] CSV data loaded successfully, length: ${csvData.length} characters`);
      console.log(`[DEBUG] First 100 chars of CSV: ${csvData.substring(0, 100)}`);
      
      // Parse CSV data
      const records: any[] = await new Promise((resolve, reject) => {
        parse(csvData, {
          columns: true,
          skip_empty_lines: true
        }, (err, records) => {
          if (err) {
            console.error('[DEBUG] CSV parsing error:', err);
            return reject(err);
          }
          resolve(records);
        });
      });
      
      console.log(`[DEBUG] Parsed ${records.length} records from CSV`);
      if (records.length > 0) {
        console.log(`[DEBUG] First record:`, JSON.stringify(records[0]));
      }
      
      // Check if studentId exists in the CSV data
      const foundStudent = records.find(record => {
        console.log(`[DEBUG] Comparing '${record.student_id}' with '${studentId}'`);
        return record.student_id === studentId;
      });
      
      const isVerified = !!foundStudent;
      console.log(`[DEBUG] Student verification result: ${isVerified}`);
      
      return isVerified; // Return true if student was found, false otherwise
    } catch (error) {
      console.error('[DEBUG] Error verifying student ID:', error);
      return false;
    }
  }

  async logVerificationAttempt(log: InsertVerificationLog): Promise<VerificationLog> {
    const [verificationLog] = await db
      .insert(verificationLogs)
      .values(log)
      .returning();
    
    return verificationLog;
  }

  async getVerificationLogs(userId: number): Promise<VerificationLog[]> {
    return await db
      .select()
      .from(verificationLogs)
      .where(eq(verificationLogs.user_id, userId))
      .orderBy(desc(verificationLogs.created_at));
  }
  
  async getPendingAdmins(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, 'admin'),
          eq(users.verification_pending, true),
          eq(users.is_active, true)
        )
      );
  }
  
  async getPendingFaculty(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, 'faculty'),
          eq(users.verification_pending, true),
          eq(users.is_active, true)
        )
      );
  }
  
  async verifyAdmin(id: number): Promise<User | undefined> {
    const now = new Date();
    const [user] = await db
      .update(users)
      .set({ 
        verification_pending: false,
        verified_at: now
      })
      .where(eq(users.id, id))
      .returning();
    
    // Log the verification action in audit logs
    if (user) {
      await db
        .insert(auditLogs)
        .values({
          action: 'ADMIN_VERIFY',
          user_id: id, 
          performed_by: id, // Use the admin's own ID as performer since system is verifying
          details: { message: 'Admin account verified' }
        });
    }
    
    return user;
  }
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  currentId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    
    // Create initial admin user for testing
    this.createUser({
      email: "admin@activelearn.edu",
      password: "$2b$10$J3GvURKjtekuqKdvz7jJ8.Py.K1VoSxtkS5fG5fGIFUwA4.h3dIOW", // "password123"
      role: "admin",
      role_id: "ADMIN001",
      verification_pending: false
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    
    // Ensure all required fields have values
    const user: User = { 
      id,
      email: insertUser.email,
      password: insertUser.password,
      role: insertUser.role || 'student',
      role_id: insertUser.role_id || null,
      department_id: insertUser.department_id || null,
      verification_pending: insertUser.verification_pending !== undefined ? insertUser.verification_pending : true,
      verified_at: insertUser.verification_pending === false ? new Date() : null
    };
    
    this.users.set(id, user);
    return user;
  }

  async updateUserVerification(id: number, status: boolean): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      const now = new Date();
      const updatedUser = { 
        ...user, 
        verification_pending: status,
        verified_at: status ? null : now
      };
      this.users.set(id, updatedUser);
      return updatedUser;
    }
    return undefined;
  }
  
  async verifyStudentById(studentId: string): Promise<boolean> {
    try {
      console.log(`[DEBUG] MemStorage - Attempting to verify student ID: ${studentId}`);
      
      // Read and parse the CSV file
      const csvFilePath = path.resolve('data/students.csv');
      console.log(`[DEBUG] MemStorage - CSV file path: ${csvFilePath}`);
      
      const csvData = await readFile(csvFilePath, 'utf8');
      console.log(`[DEBUG] MemStorage - CSV data loaded, length: ${csvData.length} characters`);
      
      // Parse CSV data
      const records: any[] = await new Promise((resolve, reject) => {
        parse(csvData, {
          columns: true,
          skip_empty_lines: true
        }, (err, records) => {
          if (err) return reject(err);
          resolve(records);
        });
      });
      
      console.log(`[DEBUG] MemStorage - Parsed ${records.length} records from CSV`);
      if (records.length > 0) {
        console.log(`[DEBUG] MemStorage - First record:`, JSON.stringify(records[0]));
      }
      
      // Check if studentId exists in the CSV data
      const foundStudent = records.find(record => {
        console.log(`[DEBUG] MemStorage - Comparing record.student_id='${record.student_id}' with studentId='${studentId}'`);
        return record.student_id === studentId;
      });
      
      const isVerified = !!foundStudent;
      console.log(`[DEBUG] MemStorage - Student verified: ${isVerified}`);
      
      return isVerified; // Return true if student was found, false otherwise
    } catch (error) {
      console.error('[DEBUG] MemStorage - Error verifying student ID:', error);
      return false;
    }
  }
  
  // In-memory version of verification logs
  private verificationLogs: Map<number, VerificationLog[]> = new Map();
  private logId = 1;
  
  async logVerificationAttempt(log: InsertVerificationLog): Promise<VerificationLog> {
    const id = this.logId++;
    const verificationLog: VerificationLog = {
      id,
      user_id: log.user_id,
      status: log.status,
      message: log.message || null,
      created_at: new Date()
    };
    
    const userLogs = this.verificationLogs.get(log.user_id) || [];
    userLogs.push(verificationLog);
    this.verificationLogs.set(log.user_id, userLogs);
    
    return verificationLog;
  }
  
  async getVerificationLogs(userId: number): Promise<VerificationLog[]> {
    const logs = this.verificationLogs.get(userId) || [];
    return [...logs].sort((a, b) => 
      b.created_at.getTime() - a.created_at.getTime()
    );
  }
  
  async getPendingAdmins(): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.role === 'admin' && user.verification_pending === true && user.is_active === true
    );
  }
  
  async getPendingFaculty(): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.role === 'faculty' && user.verification_pending === true && user.is_active === true
    );
  }
  
  async verifyAdmin(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user && user.role === 'admin') {
      const now = new Date();
      const updatedUser = {
        ...user,
        verification_pending: false,
        verified_at: now
      };
      this.users.set(id, updatedUser);
      return updatedUser;
    }
    return undefined;
  }
}

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();