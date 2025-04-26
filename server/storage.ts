import { 
  users, verificationLogs, departments, auditLogs, content, facultyContentPermissions,
  content_views, content_downloads, subjectFacultyAssignments, subjects,
  type User, type InsertUser, type VerificationLog, type InsertVerificationLog,
  type Department, type InsertDepartment, type UserWithDepartment,
  type AuditLog, type InsertAuditLog, type Content, type InsertContent, 
  type ContentWithRelations, type FacultyContentPermission, type InsertFacultyContentPermission,
  type SubjectFacultyAssignment, type InsertSubjectFacultyAssignment, type SubjectFacultyAssignmentWithRelations,
  type Subject, type InsertSubject, type UpdateSubject, type SubjectWithRelations
} from "@shared/schema";
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
  // User-related methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserVerification(id: number, status: boolean): Promise<User | undefined>;
  getUserWithDepartment(id: number): Promise<UserWithDepartment | undefined>;
  updateUserDepartment(userId: number, departmentId: number | null): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Student management functionality
  deleteStudent(studentId: number, adminId: number): Promise<User | undefined>;
  getAllStudents(): Promise<User[]>;
  getDeletedStudents(): Promise<User[]>;

  // Faculty management functionality
  deleteFaculty(facultyId: number, adminId: number): Promise<User | undefined>;
  getDeletedFaculty(): Promise<User[]>;

  // Admin related endpoints
  getPendingAdmins(): Promise<User[]>;
  verifyAdmin(adminId: number): Promise<User | undefined>;
  rejectAdmin(adminId: number): Promise<User | undefined>;

  // Audit logging functionality
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(): Promise<AuditLog[]>;

  // Verification-related methods
  verifyStudentById(studentId: string): Promise<boolean>;
  logVerificationAttempt(log: InsertVerificationLog): Promise<VerificationLog>;
  getVerificationLogs(userId: number): Promise<VerificationLog[]>;
  getPendingFaculty(): Promise<User[]>;
  verifyFacultyById(id: number): Promise<User | undefined>;

  // Student approval methods 
  getPendingStudents(): Promise<User[]>;
  approveStudentById(id: number): Promise<User | undefined>;

  // Department-related methods
  createDepartment(department: InsertDepartment): Promise<Department>;
  getDepartmentById(id: number): Promise<Department | undefined>;
  getDepartments(): Promise<Department[]>;
  getDepartmentByName(name: string): Promise<Department | undefined>;
  deleteDepartment(departmentId: number, adminId: number): Promise<Department | undefined>;

  // Bulk operations
  syncStudents(students: Array<{
    email: string;
    student_id: string;
    department_name: string | null;
    first_name?: string;
    last_name?: string;
  }>): Promise<{
    success: number;
    failed: number;
    errors: Array<{ email: string; reason: string }>;
  }>;

  // Content Management Module methods
  getContentByDepartment(deptId: number): Promise<ContentWithRelations[]>;
  getAllContent(): Promise<ContentWithRelations[]>;
  getContentById(id: number): Promise<ContentWithRelations | undefined>;
  createContent(content: InsertContent): Promise<Content>;

  // Faculty content permission methods
  getFacultyContentPermissionStatus(facultyId: number): Promise<{
    status: 'granted' | 'revoked' | 'pending' | 'none';
    requested_at?: string;
    reviewed_at?: string;
    reviewed_by?: string;
  }>;
  requestFacultyContentPermission(facultyId: number, reason: string): Promise<boolean>;
  getFacultyWithContentAccess(): Promise<Array<{
    id: number;
    email: string;
    role_id: string;
    first_name: string | null;
    last_name: string | null;
    department_id: number | null;
    department_name: string | null;
    content_permission: 'granted' | 'revoked' | 'pending';
    content_upload_count?: number;
    last_upload_date?: string;
  }>>;
  updateFacultyContentPermission(
    facultyId: number, 
    status: 'granted' | 'revoked', 
    adminId: number, 
    notes?: string
  ): Promise<boolean>;

  // Subject-Faculty Assignment methods
  createSubjectFacultyAssignment(assignment: InsertSubjectFacultyAssignment): Promise<SubjectFacultyAssignment>;
  getSubjectFacultyAssignments(facultyId?: number, departmentId?: number): Promise<SubjectFacultyAssignmentWithRelations[]>;
  getSubjectFacultyAssignment(id: number): Promise<SubjectFacultyAssignmentWithRelations | undefined>;
  removeSubjectFacultyAssignment(id: number, adminId: number): Promise<SubjectFacultyAssignment | undefined>;
  updateSubjectFacultyAssignment(
    id: number, 
    adminId: number, 
    updates: {subject_name: string, department_id?: number | null}
  ): Promise<SubjectFacultyAssignment | undefined>;
  getSubjectsByFaculty(facultyId: number): Promise<string[]>;

  // Subject management methods
  createSubject(subject: InsertSubject): Promise<Subject>;
  getSubjectById(id: number): Promise<SubjectWithRelations | undefined>;
  getAllSubjects(): Promise<SubjectWithRelations[]>;
  getSubjectsByDepartment(departmentId: number): Promise<SubjectWithRelations[]>;
  updateSubject(id: number, updates: UpdateSubject): Promise<Subject | undefined>;
  deleteSubject(id: number, adminId: number): Promise<Subject | undefined>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });

    // Create test accounts for different roles
    this.createTestAccounts();
  }

  // Methods to implement IStorage interface for subject-faculty assignments
  async createSubjectFacultyAssignment(assignment: InsertSubjectFacultyAssignment): Promise<SubjectFacultyAssignment> {
    try {
      const result = await db.insert(subjectFacultyAssignments).values({
        faculty_id: assignment.faculty_id,
        subject_name: assignment.subject_name,
        department_id: assignment.department_id || null,
        assigned_by: assignment.assigned_by,
        assigned_at: new Date(),
        is_active: true
      }).returning();

      return result[0];
    } catch (error) {
      console.error('Error creating subject-faculty assignment:', error);
      throw error;
    }
  }

  async getSubjectFacultyAssignments(facultyId?: number, departmentId?: number): Promise<SubjectFacultyAssignmentWithRelations[]> {
    try {
      let query = db.select().from(subjectFacultyAssignments);

      // Add filters if provided
      if (facultyId !== undefined && departmentId !== undefined) {
        query = query.where(and(
          eq(subjectFacultyAssignments.faculty_id, facultyId),
          eq(subjectFacultyAssignments.department_id, departmentId),
          eq(subjectFacultyAssignments.is_active, true)
        ));
      } else if (facultyId !== undefined) {
        query = query.where(and(
          eq(subjectFacultyAssignments.faculty_id, facultyId),
          eq(subjectFacultyAssignments.is_active, true)
        ));
      } else if (departmentId !== undefined) {
        query = query.where(and(
          eq(subjectFacultyAssignments.department_id, departmentId),
          eq(subjectFacultyAssignments.is_active, true)
        ));
      } else {
        query = query.where(eq(subjectFacultyAssignments.is_active, true));
      }

      const assignments = await query;

      // Get related data for each assignment
      const assignmentsWithRelations: SubjectFacultyAssignmentWithRelations[] = await Promise.all(
        assignments.map(async (assignment) => {
          const faculty = await this.getUser(assignment.faculty_id);
          const admin = await this.getUser(assignment.assigned_by);
          let department = null;
          if (assignment.department_id) {
            department = await this.getDepartmentById(assignment.department_id);
          }

          return {
            ...assignment,
            faculty,
            department,
            admin
          };
        })
      );

      return assignmentsWithRelations;
    } catch (error) {
      console.error('Error getting subject-faculty assignments:', error);
      return [];
    }
  }

  async getSubjectFacultyAssignment(id: number): Promise<SubjectFacultyAssignmentWithRelations | undefined> {
    try {
      const [assignment] = await db.select().from(subjectFacultyAssignments)
        .where(and(
          eq(subjectFacultyAssignments.id, id),
          eq(subjectFacultyAssignments.is_active, true)
        ));

      if (!assignment) return undefined;

      // Get related data
      const faculty = await this.getUser(assignment.faculty_id);
      const admin = await this.getUser(assignment.assigned_by);
      let department = null;
      if (assignment.department_id) {
        department = await this.getDepartmentById(assignment.department_id);
      }

      return {
        ...assignment,
        faculty,
        department,
        admin
      };
    } catch (error) {
      console.error('Error getting subject-faculty assignment:', error);
      return undefined;
    }
  }

  async removeSubjectFacultyAssignment(id: number, adminId: number): Promise<SubjectFacultyAssignment | undefined> {
    try {
      // Soft delete the assignment
      const [updatedAssignment] = await db.update(subjectFacultyAssignments)
        .set({ is_active: false })
        .where(and(
          eq(subjectFacultyAssignments.id, id),
          eq(subjectFacultyAssignments.is_active, true)
        ))
        .returning();

      if (!updatedAssignment) return undefined;

      // Log this action
      await this.createAuditLog({
        action: 'SUBJECT_ASSIGNMENT_REMOVED',
        user_id: updatedAssignment.faculty_id,
        performed_by: adminId,
        details: {
          subject_name: updatedAssignment.subject_name,
          department_id: updatedAssignment.department_id
        }
      });

      return updatedAssignment;
    } catch (error) {
      console.error('Error removing subject-faculty assignment:', error);
      return undefined;
    }
  }

  async updateSubjectFacultyAssignment(
    id: number, 
    adminId: number, 
    updates: {subject_name: string, department_id?: number | null}
  ): Promise<SubjectFacultyAssignment | undefined> {
    try {
      // Check if the assignment exists and is active
      const [existingAssignment] = await db.select()
        .from(subjectFacultyAssignments)
        .where(and(
          eq(subjectFacultyAssignments.id, id),
          eq(subjectFacultyAssignments.is_active, true)
        ));

      if (!existingAssignment) return undefined;

      // Update the assignment
      const [updatedAssignment] = await db.update(subjectFacultyAssignments)
        .set({
          subject_name: updates.subject_name.trim(),
          department_id: updates.department_id === undefined ? existingAssignment.department_id : updates.department_id
        })
        .where(and(
          eq(subjectFacultyAssignments.id, id),
          eq(subjectFacultyAssignments.is_active, true)
        ))
        .returning();

      if (!updatedAssignment) return undefined;

      // Log this action
      await this.createAuditLog({
        action: 'SUBJECT_ASSIGNMENT_UPDATED',
        user_id: updatedAssignment.faculty_id,
        performed_by: adminId,
        details: {
          old_subject_name: existingAssignment.subject_name,
          new_subject_name: updatedAssignment.subject_name,
          old_department_id: existingAssignment.department_id,
          new_department_id: updatedAssignment.department_id
        }
      });

      return updatedAssignment;
    } catch (error) {
      console.error('Error updating subject-faculty assignment:', error);
      return undefined;
    }
  }

  async getSubjectsByFaculty(facultyId: number): Promise<string[]> {
    try {
      // Get all active subject assignments for this faculty
      const assignments = await db.select().from(subjectFacultyAssignments)
        .where(and(
          eq(subjectFacultyAssignments.faculty_id, facultyId),
          eq(subjectFacultyAssignments.is_active, true)
        ));

      // Extract unique subject names
      const subjects = new Set<string>();
      for (const assignment of assignments) {
        subjects.add(assignment.subject_name);
      }

      return Array.from(subjects);
    } catch (error) {
      console.error('Error getting subjects by faculty:', error);
      return [];
    }
  }

  // Student deletion methods
  async deleteStudent(studentId: number, adminId: number): Promise<User | undefined> {
    // First check if the user exists and is a student
    const user = await this.getUser(studentId);
    if (!user || user.role !== "student") {
      return undefined;
    }

    // Update the user to mark as inactive (soft delete)
    const [updatedUser] = await db
      .update(users)
      .set({ is_active: false })
      .where(eq(users.id, studentId))
      .returning();

    // Create audit log entry for this deletion
    if (updatedUser) {
      await this.createAuditLog({
        action: "delete_student",
        user_id: studentId,
        performed_by: adminId,
        details: {
          email: updatedUser.email,
          role_id: updatedUser.role_id,
          department_id: updatedUser.department_id
        }
      });
    }

    return updatedUser;
  }

  async getAllStudents(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, "student"));
  }

  async getDeletedStudents(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "student"),
          eq(users.is_active, false)
        )
      );
  }

  // Faculty management methods
  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users);
  }

  async deleteFaculty(facultyId: number, adminId: number): Promise<User | undefined> {
    // First check if the user exists and is a faculty
    const user = await this.getUser(facultyId);
    if (!user || user.role !== "faculty") {
      return undefined;
    }

    // Update the user to mark as inactive (soft delete)
    const [updatedUser] = await db
      .update(users)
      .set({ is_active: false })
      .where(eq(users.id, facultyId))
      .returning();

    // Create audit log entry for this deletion
    if (updatedUser) {
      await this.createAuditLog({
        action: "FACULTY_DELETE",
        user_id: facultyId,
        performed_by: adminId,
        details: {
          email: updatedUser.email,
          role_id: updatedUser.role_id,
          department_id: updatedUser.department_id,
          name: updatedUser.first_name && updatedUser.last_name ? 
                `${updatedUser.first_name} ${updatedUser.last_name}` : 'Unknown'
        }
      });
    }

    return updatedUser;
  }

  async getDeletedFaculty(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "faculty"),
          eq(users.is_active, false)
        )
      );
  }

  // Admin self-deletion method
  async deleteSelf(adminId: number): Promise<User | undefined> {
    // First check if the user exists and is an admin
    const user = await this.getUser(adminId);
    if (!user || user.role !== "admin") {
      return undefined;
    }

    // Update the user to mark as inactive (soft delete)
    const [updatedUser] = await db
      .update(users)
      .set({ is_active: false })
      .where(eq(users.id, adminId))
      .returning();

    // Create audit log entry for this self-deletion
    if (updatedUser) {
      await this.createAuditLog({
        action: "ADMIN_SELF_DELETE",
        user_id: adminId,
        performed_by: adminId, // Admin performed action on themselves
        details: {
          email: updatedUser.email,
          role_id: updatedUser.role_id,
          message: "Admin voluntarily signed off from the system"
        }
      });
    }

    return updatedUser;
  }

  // Audit logging methods
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db
      .insert(auditLogs)
      .values(log)
      .returning();

    return auditLog;
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.created_at));
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

  async getPendingFaculty(): Promise<User[]> {
    // Get all faculty users with pending verification
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "faculty"),
          eq(users.verification_pending, true)
        )
      );
  }

  async getPendingAdmins(): Promise<User[]> {
    // Get all admin users with pending verification
    const pendingAdmins = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "admin"),
          eq(users.verification_pending, true),
          eq(users.is_active, true)
        )
      );

    // Remove passwords from response
    return pendingAdmins.map(admin => {
      const { password, ...adminWithoutPassword } = admin;
      return adminWithoutPassword as User;
    });
  }

  async verifyAdmin(id: number): Promise<User | undefined> {
    // First check if the user exists and is an admin
    const [adminUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, id),
          eq(users.role, "admin")
        )
      );

    if (!adminUser) {
      return undefined;
    }

    // Update the admin verification status
    const now = new Date();
    const [updatedAdmin] = await db
      .update(users)
      .set({
        verification_pending: false,
        verified_at: now
      })
      .where(eq(users.id, id))
      .returning();

    if (!updatedAdmin) {
      return undefined;
    }

    // Remove password from response
    const { password, ...adminWithoutPassword } = updatedAdmin;
    return adminWithoutPassword as User;
  }

  async rejectAdmin(id: number): Promise<User | undefined> {
    // First check if the user exists and is an admin
    const [adminUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, id),
          eq(users.role, "admin"),
          eq(users.verification_pending, true)
        )
      );

    if (!adminUser) {
      return undefined;
    }

    // Mark the admin as inactive (soft delete)
    const [updatedAdmin] = await db
      .update(users)
      .set({
        is_active: false
      })
      .where(eq(users.id, id))
      .returning();

    if (!updatedAdmin) {
      return undefined;
    }

    // Remove password from response
    const { password, ...adminWithoutPassword } = updatedAdmin;
    return adminWithoutPassword as User;
  }

  async verifyFacultyById(id: number): Promise<User | undefined> {
    // First check if the user exists and is a faculty member
    const [facultyUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, id),
          eq(users.role, "faculty")
        )
      );

    if (!facultyUser) {
      return undefined;
    }

    // Update the faculty verification status
    return this.updateUserVerification(id, false); // false = not pending = verified
  }

  // Department-related methods
  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db
      .insert(departments)
      .values(department)
      .returning();
    return newDepartment;
  }

  async getDepartmentById(id: number): Promise<Department | undefined> {
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, id));
    return department;
  }

  async getDepartments(): Promise<Department[]> {
    return await db
      .select()
      .from(departments);
  }

  async getDepartmentByName(name: string): Promise<Department | undefined> {
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.name, name));
    return department;
  }

  async deleteDepartment(departmentId: number, adminId: number): Promise<Department | undefined> {
    // First check if the department exists
    const department = await this.getDepartmentById(departmentId);
    if (!department) {
      return undefined;
    }

    // Begin transaction to ensure atomicity of operations
    return await db.transaction(async (tx) => {
      // 1. Update all users in this department to have null department_id
      await tx
        .update(users)
        .set({ department_id: null })
        .where(eq(users.department_id, departmentId));

      // 2. Delete the department
      const [deletedDepartment] = await tx
        .delete(departments)
        .where(eq(departments.id, departmentId))
        .returning();

      // 3. Create audit log entry for this deletion
      if (deletedDepartment) {
        await this.createAuditLog({
          action: "DEPARTMENT_DELETE",
          user_id: adminId, // The admin who performed the deletion
          performed_by: adminId,
          details: {
            department_id: deletedDepartment.id,
            department_name: deletedDepartment.name,
            description: deletedDepartment.description
          }
        });
      }

      return deletedDepartment;
    });
  }

  async syncStudents(students: Array<{
    email: string;
    student_id: string;
    department_name: string | null;
    first_name?: string;
    last_name?: string;
  }>): Promise<{
    success: number;
    failed: number;
    errors: Array<{ email: string; reason: string }>;
  }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ email: string; reason: string }> = [];

    // Get all departments for mapping department names to IDs
    const allDepartments = await this.getDepartments();
    const departmentMap = new Map<string, number>();
    allDepartments.forEach(dept => departmentMap.set(dept.name.toLowerCase(), dept.id));

    // Process each student in the list
    for (const student of students) {
      try {
        // Check if email is valid
        if (!student.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) {
          errors.push({ 
            email: student.email || 'Invalid email', 
            reason: 'Invalid email format' 
          });
          failedCount++;
          continue;
        }

        // Check if user already exists
        const existingUser = await this.getUserByEmail(student.email);
        if (existingUser) {
          errors.push({ 
            email: student.email, 
            reason: 'User with this email already exists' 
          });
          failedCount++;
          continue;
        }

        // Find department ID based on name if provided
        let departmentId: number | null = null;
        if (student.department_name) {
          const deptName = student.department_name.toLowerCase();
          if (departmentMap.has(deptName)) {
            departmentId = departmentMap.get(deptName) || null;
          } else {
            // Department doesn't exist, add to errors but still create the user
            errors.push({ 
              email: student.email, 
              reason: `Department '${student.department_name}' not found, user created without department` 
            });
          }
        }

        // Create a password hash for the initial student account
        // Use student ID as the initial password - students will need to change it
        const bcrypt = await import('bcrypt');
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(student.student_id, saltRounds);

        // Create the student user with auto-verification
        await this.createUser({
          email: student.email,
          password: hashedPassword,
          role: 'student',
          role_id: student.student_id,
          department_id: departmentId,
          verification_pending: false // Auto-verified
        });

        // Log verification for the newly created student
        // We'll need to get the user ID first
        const newUser = await this.getUserByEmail(student.email);
        if (newUser) {
          await this.logVerificationAttempt({
            user_id: newUser.id,
            status: 'verified',
            message: 'User automatically verified through bulk import'
          });
        }

        successCount++;
      } catch (error) {
        console.error(`Error importing student ${student.email}:`, error);
        errors.push({ 
          email: student.email, 
          reason: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
        failedCount++;
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      errors
    };
  }

  // User with department methods
  async getUserWithDepartment(id: number): Promise<UserWithDepartment | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id));

    if (result.length === 0) return undefined;

    const user = result[0];

    if (user.department_id) {
      const [department] = await db
        .select()
        .from(departments)
        .where(eq(departments.id, user.department_id));

      return {
        ...user,
        department
      };
    }

    return {
      ...user,
      department: null
    };
  }

  // Student approval methods
  async getPendingStudents(): Promise<User[]> {
    // Get all student users with pending verification
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "student"),
          eq(users.verification_pending, true),
          eq(users.is_active, true)
        )
      );
  }

  async approveStudentById(id: number): Promise<User | undefined> {
    // First check if the user exists and is a student
    const [studentUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, id),
          eq(users.role, "student"),
          eq(users.verification_pending, true)
        )
      );

    if (!studentUser) {
      return undefined;
    }

    // Update the student verification status
    return this.updateUserVerification(id, false); // false = not pending = verified
  }

  async updateUserDepartment(userId: number, departmentId: number | null): Promise<User | undefined> {
    // Verify department exists if not null
    if (departmentId !== null) {
      const department = await this.getDepartmentById(departmentId);
      if (!department) {
        throw new Error(`Department with ID ${departmentId} not found`);
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({ department_id: departmentId })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser;
  }

  // Content Management Module methods
  async getContentByDepartment(deptId: number): Promise<ContentWithRelations[]> {
    try {
      const contentItems = await db
        .select()
        .from(content)
        .leftJoin(departments, eq(content.dept_id, departments.id))
        .leftJoin(users, eq(content.uploaded_by, users.id))
        .where(eq(content.dept_id, deptId))
        .orderBy(desc(content.created_at));

      return contentItems.map(item => ({
        ...item.content,
        department: item.departments,
        uploader: item.users
      })) as ContentWithRelations[];
    } catch (error) {
      console.error("Error fetching content by department:", error);
      return [];
    }
  }

  async getAllContent(): Promise<ContentWithRelations[]> {
    try {
      const contentItems = await db
        .select()
        .from(content)
        .leftJoin(departments, eq(content.dept_id, departments.id))
        .leftJoin(users, eq(content.uploaded_by, users.id))
        .orderBy(desc(content.created_at));

      return contentItems.map(item => ({
        ...item.content,
        department: item.departments,
        uploader: item.users
      })) as ContentWithRelations[];
    } catch (error) {
      console.error("Error fetching all content:", error);
      return [];
    }
  }

  async getContentById(id: number): Promise<ContentWithRelations | undefined> {
    try {
      const [contentItem] = await db
        .select()
        .from(content)
        .leftJoin(departments, eq(content.dept_id, departments.id))
        .leftJoin(users, eq(content.uploaded_by, users.id))
        .where(eq(content.id, id));

      if (!contentItem) return undefined;

      return {
        ...contentItem.content,
        department: contentItem.departments,
        uploader: contentItem.users
      } as ContentWithRelations;
    } catch (error) {
      console.error(`Error fetching content with ID ${id}:`, error);
      return undefined;
    }
  }

  async createContent(insertContent: InsertContent): Promise<Content> {
    const [newContent] = await db
      .insert(content)
      .values(insertContent)
      .returning();

    return newContent;
  }

  // Subject management methods
  async createSubject(subject: InsertSubject): Promise<Subject> {
    try {
      const [newSubject] = await db
        .insert(subjects)
        .values({
          ...subject,
          created_at: new Date(),
          updated_at: new Date(),
          is_active: true
        })
        .returning();

      // Log the creation
      await this.createAuditLog({
        action: 'SUBJECT_CREATED',
        user_id: subject.created_by,
        performed_by: subject.created_by,
        details: {
          subject_name: subject.name,
          department_id: subject.department_id
        }
      });

      return newSubject;
    } catch (error) {
      console.error('Error creating subject:', error);
      throw error;
    }
  }

  async getSubjectById(id: number): Promise<SubjectWithRelations | undefined> {
    try {
      const [subjectData] = await db
        .select()
        .from(subjects)
        .where(and(
          eq(subjects.id, id),
          eq(subjects.is_active, true)
        ));

      if (!subjectData) return undefined;

      // Get related data
      const department = await this.getDepartmentById(subjectData.department_id);
      const creator = await this.getUser(subjectData.created_by);

      return {
        ...subjectData,
        department,
        creator
      };
    } catch (error) {
      console.error('Error getting subject by ID:', error);
      return undefined;
    }
  }

  async getAllSubjects(): Promise<SubjectWithRelations[]> {
    try {
      const allSubjects = await db
        .select()
        .from(subjects)
        .where(eq(subjects.is_active, true));

      // Get related data for each subject
      const subjectsWithRelations: SubjectWithRelations[] = await Promise.all(
        allSubjects.map(async (subject) => {
          const department = await this.getDepartmentById(subject.department_id);
          const creator = await this.getUser(subject.created_by);

          return {
            ...subject,
            department,
            creator
          };
        })
      );

      return subjectsWithRelations;
    } catch (error) {
      console.error('Error getting all subjects:', error);
      return [];
    }
  }

  async getSubjectsByDepartment(departmentId: number): Promise<SubjectWithRelations[]> {
    try {
      const departmentSubjects = await db
        .select()
        .from(subjects)
        .where(and(
          eq(subjects.department_id, departmentId),
          eq(subjects.is_active, true)
        ));

      // Get related data for each subject
      const subjectsWithRelations: SubjectWithRelations[] = await Promise.all(
        departmentSubjects.map(async (subject) => {
          const department = await this.getDepartmentById(subject.department_id);
          const creator = await this.getUser(subject.created_by);

          return {
            ...subject,
            department,
            creator
          };
        })
      );

      return subjectsWithRelations;
    } catch (error) {
      console.error('Error getting subjects by department:', error);
      return [];
    }
  }

  async updateSubject(id: number, updates: UpdateSubject): Promise<Subject | undefined> {
    try {
      // Get the original subject for audit log
      const [originalSubject] = await db
        .select()
        .from(subjects)
        .where(and(
          eq(subjects.id, id),
          eq(subjects.is_active, true)
        ));

      if (!originalSubject) return undefined;

      // Update the subject
      const [updatedSubject] = await db
        .update(subjects)
        .set({
          ...updates,
          updated_at: new Date()
        })
        .where(and(
          eq(subjects.id, id),
          eq(subjects.is_active, true)
        ))
        .returning();

      if (!updatedSubject) return undefined;

      // Log the update
      await this.createAuditLog({
        action: 'SUBJECT_UPDATED',
        user_id: updates.updated_by || originalSubject.created_by,
        performed_by: updates.updated_by || originalSubject.created_by,
        details: {
          subject_id: id,
          old_name: originalSubject.name,
          new_name: updates.name || originalSubject.name,
          old_department_id: originalSubject.department_id,
          new_department_id: updates.department_id || originalSubject.department_id
        }
      });

      return updatedSubject;
    } catch (error) {
      console.error('Error updating subject:', error);
      return undefined;
    }
  }

  async deleteSubject(id: number, adminId: number): Promise<Subject | undefined> {
    try {
      // Get the subject first to ensure it exists and is active
      const [subject] = await db
        .select()
        .from(subjects)
        .where(and(
          eq(subjects.id, id),
          eq(subjects.is_active, true)
        ));

      if (!subject) return undefined;

      // Soft delete by marking as inactive
      const [deletedSubject] = await db
        .update(subjects)
        .set({
          is_active: false,
          updated_at: new Date()
        })
        .where(eq(subjects.id, id))
        .returning();

      // Log the deletion
      await this.createAuditLog({
        action: 'SUBJECT_DELETED',
        user_id: adminId,
        performed_by: adminId,
        details: {
          subject_id: id,
          subject_name: subject.name,
          department_id: subject.department_id
        }
      });

      return deletedSubject;
    } catch (error) {
      console.error('Error deleting subject:', error);
      return undefined;
    }
  }

  // Faculty content permission methods
  async getFacultyContentPermissionStatus(facultyId: number): Promise<{
    status: 'granted' | 'revoked' | 'pending' | 'none';
    requested_at?: string;
    reviewed_at?: string;
    reviewed_by?: string;
  }> {
    try {
      // Check if the user is a faculty member
      const faculty = await this.getUser(facultyId);
      if (!faculty || faculty.role !== 'faculty') {
        return { status: 'none' };
      }

      // Find the most recent active permission request
      const [permission] = await db
        .select()
        .from(facultyContentPermissions)
        .where(
          and(
            eq(facultyContentPermissions.faculty_id, facultyId),
            eq(facultyContentPermissions.is_active, true)
          )
        )
        .orderBy(desc(facultyContentPermissions.requested_at))
        .limit(1);

      if (!permission) {
        return { status: 'none' };
      }

      return {
        status: permission.status as 'granted' | 'revoked' | 'pending',
        requested_at: permission.requested_at.toISOString(),
        reviewed_at: permission.reviewed_at ? permission.reviewed_at.toISOString() : undefined,
        reviewed_by: permission.reviewed_by ? String(permission.reviewed_by) : undefined
      };
    } catch (error) {
      console.error('Error checking faculty permission status:', error);
      return { status: 'none' };
    }
  }

  async requestFacultyContentPermission(facultyId: number, reason: string): Promise<boolean> {
    try {
      // Check if there's already an active request
      const existingStatus = await this.getFacultyContentPermissionStatus(facultyId);
      if (existingStatus.status === 'pending' || existingStatus.status === 'granted') {
        return false; // Already has a pending request or permission granted
      }

      // Create a new permission request
      await db
        .insert(facultyContentPermissions)
        .values({
          faculty_id: facultyId,
          status: 'pending',
          reason: reason,
          is_active: true
        });

      return true;
    } catch (error) {
      console.error('Error requesting faculty content permission:', error);
      return false;
    }
  }

  async getFacultyWithContentAccess(): Promise<Array<{
    id: number;
    email: string;
    role_id: string;
    first_name: string | null;
    last_name: string | null;
    department_id: number | null;
    department_name: string | null;
    content_permission: 'granted' | 'revoked' | 'pending';
    content_upload_count?: number;
    last_upload_date?: string;
  }>> {
    try {
      // Get all active faculty
      const faculty = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.role, 'faculty'),
            eq(users.is_active, true)
          )
        );

      // For each faculty, get their department and permission status
      const result = await Promise.all(faculty.map(async (f) => {
        // Get department information
        let departmentName = null;
        if (f.department_id) {
          const dept = await this.getDepartmentById(f.department_id);
          departmentName = dept?.name || null;
        }

        // Get permission status
        const permissionStatus = await this.getFacultyContentPermissionStatus(f.id);

        // Get content upload stats
        const facultyContent = await db
          .select()
          .from(content)
          .where(
            and(
              eq(content.uploaded_by, f.id),
              eq(content.is_deleted, false)
            )
          );

        // Get latest upload date and count
        const contentUploadCount = facultyContent.length;
        let lastUploadDate: string | undefined = undefined;

        if (contentUploadCount > 0) {
          // Find the most recent upload
          const latestContent = facultyContent.reduce((latest, current) => {
            return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
          }, facultyContent[0]);

          lastUploadDate = latestContent.created_at.toISOString();
        }

        // Remove password before returning
        const { password, ...facultyWithoutPassword } = f;

        return {
          ...facultyWithoutPassword,
          department_name: departmentName,
          content_permission: permissionStatus.status === 'none' ? 'revoked' : permissionStatus.status,
          content_upload_count: contentUploadCount,
          last_upload_date: lastUploadDate
        };
      }));

      return result;
    } catch (error) {
      console.error('Error fetching faculty with content access:', error);
      return [];
    }
  }

  async updateFacultyContentPermission(
    facultyId: number, 
    status: 'granted' | 'revoked', 
    adminId: number, 
    notes?: string
  ): Promise<boolean> {
    try {
      // Check if there's an existing permission record
      const [existingPermission] = await db
        .select()
        .from(facultyContentPermissions)
        .where(
          and(
            eq(facultyContentPermissions.faculty_id, facultyId),
            eq(facultyContentPermissions.is_active, true)
          )
        )
        .orderBy(desc(facultyContentPermissions.requested_at))
        .limit(1);

      if (!existingPermission) {
        // Create a new permission record if none exists
        await db
          .insert(facultyContentPermissions)
          .values({
            faculty_id: facultyId,
            status: status,
            review_notes: notes || null,
            reviewed_by: adminId,
            reviewed_at: new Date(),
            is_active: true
          });
      } else {
        // Update existing permission
        await db
          .update(facultyContentPermissions)
          .set({
            status: status,
            review_notes: notes || existingPermission.review_notes,
            reviewed_by: adminId,
            reviewed_at: new Date()
          })
          .where(eq(facultyContentPermissions.id, existingPermission.id));
      }

      return true;
    } catch (error) {
      console.error('Error updating faculty content permission:', error);
      return false;
    }
  }

  // Method to create test accounts for different roles
  private async createTestAccounts() {
    try {
      // Create admin account if it doesn't exist
      const adminUser = await this.getUserByEmail("admin@activelearn.edu");
      if (!adminUser) {
        console.log("Creating admin test account...");
        await this.createUser({
          email: "admin@activelearn.edu",
          password: "$2b$10$pig.eclqqBJFUexvAksD4urtYbxH.MVbb9uxPae6OXvlebQyjASla", // "password123"
          role: "admin",
          role_id: "ADMIN001",
          verification_pending: false,
          is_active: true,
          first_name: "Vikram",
          last_name: "Sharma"
        });
      }

      // Create test student account if it doesn't exist
      const studentUser = await this.getUserByEmail("test_student@activelearn.edu");
      if (!studentUser) {
        console.log("Creating student test account...");
        await this.createUser({
          email: "test_student@activelearn.edu",
          password: "$2b$10$pig.eclqqBJFUexvAksD4urtYbxH.MVbb9uxPae6OXvlebQyjASla", // "password123"
          role: "student",
          role_id: "STUDENT001",
          verification_pending: false, // Already verified
          is_active: true,
          first_name: "Arjun",
          last_name: "Reddy"
        });
      }

      // Create test faculty account if it doesn't exist
      const facultyUser = await this.getUserByEmail("test_faculty@activelearn.edu");
      if (!facultyUser) {
        console.log("Creating faculty test account...");
        await this.createUser({
          email: "test_faculty@activelearn.edu",
          password: "$2b$10$pig.eclqqBJFUexvAksD4urtYbxH.MVbb9uxPae6OXvlebQyjASla", // "password123"
          role: "faculty",
          role_id: "FACULTY001",
          verification_pending: false, // Already verified
          is_active: true,
          first_name: "Priya",
          last_name: "Mehta"
        });
      }

      console.log("Test accounts setup complete");
    } catch (error) {
      console.error("Error creating test accounts:", error);
    }
  }
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  currentId: number;
  sessionStore: session.Store;

  // For audit logs
  private auditLogs: AuditLog[] = [];
  private auditLogId = 1;

  // For subject-faculty assignments
  private subjectFacultyAssignments: SubjectFacultyAssignment[] = [];
  private subjectFacultyAssignmentId = 1;

  // For faculty content permissions
  private facultyContentPermissions: FacultyContentPermission[] = [];
  private facultyContentPermissionId = 1;

  // For content
  private content: Content[] = [];
  private contentId = 1;

  // For subjects
  private subjects: Subject[] = [];
  private subjectId = 1;

  constructor() {
    this.users = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });

    // Create test accounts for different roles
    this.createTestAccounts();
  }

  // Student deletion methods
  async deleteStudent(studentId: number, adminId: number): Promise<User | undefined> {
    const user = this.users.get(studentId);
    if (!user || user.role !== "student") {
      return undefined;
    }

    // Mark the user as inactive (soft delete)
    const updatedUser = { 
      ...user, 
      is_active: false 
    };
    this.users.set(studentId, updatedUser);

    // Create audit log entry
    await this.createAuditLog({
      action: "delete_student",
      user_id: studentId,
      performed_by: adminId,
      details: {
        email: updatedUser.email,
        role_id: updatedUser.role_id,
        department_id: updatedUser.department_id
      }
    });

    return updatedUser;
  }

  async getAllStudents(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === "student");
  }

  async getDeletedStudents(): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      user => user.role === "student" && user.is_active === false
    );
  }

  // Faculty management methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async deleteFaculty(facultyId: number, adminId: number): Promise<User | undefined> {
    const user = this.users.get(facultyId);
    if (!user || user.role !== "faculty") {
      return undefined;
    }

    // Mark the user as inactive (soft delete)
    const updatedUser = { 
      ...user, 
      is_active: false 
    };
    this.users.set(facultyId, updatedUser);

    // Create audit log entry
    this.createAuditLog({
      action: "FACULTY_DELETE",
      user_id: facultyId,
      performed_by: adminId,
      details: {
        email: updatedUser.email,
        role_id: updatedUser.role_id,
        department_id: updatedUser.department_id,
        name: updatedUser.first_name && updatedUser.last_name ? 
              `${updatedUser.first_name} ${updatedUser.last_name}` : 'Unknown'
      }
    });

    return updatedUser;
  }

  async getDeletedFaculty(): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      user => user.role === "faculty" && user.is_active === false
    );
  }

  // Admin self-deletion method
  async deleteSelf(adminId: number): Promise<User | undefined> {
    const user = this.users.get(adminId);
    if (!user || user.role !== "admin") {
      return undefined;
    }

    // Mark the user as inactive (soft delete)
    const updatedUser = { 
      ...user, 
      is_active: false 
    };

    // Update the user in the map
    this.users.set(adminId, updatedUser);

    // Create audit log entry for this self-deletion
    await this.createAuditLog({
      action: "ADMIN_SELF_DELETE",
      user_id: adminId,
      performed_by: adminId, // Admin performed action on themselves
      details: {
        email: updatedUser.email,
        role_id: updatedUser.role_id,
        message: "Admin voluntarily signed off from the system"
      }
    });

    return updatedUser;
  }

  // Audit logging methods
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = this.auditLogId++;
    const auditLog: AuditLog = {
      id,
      action: log.action,
      user_id: log.user_id,
      performed_by: log.performed_by,
      details: log.details || null,
      created_at: new Date()
    };

    this.auditLogs.push(auditLog);

    return auditLog;
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    // Sort by creation date, most recent first
    return [...this.auditLogs].sort((a, b) => 
      b.created_at.getTime() - a.created_at.getTime()
    );
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
      ...insertUser, 
      id,
      role: insertUser.role || 'student',
      role_id: insertUser.role_id || null,
      department_id: insertUser.department_id || null,
      verification_pending: insertUser.verification_pending !== undefined ? insertUser.verification_pending : true,
      verified_at: insertUser.verification_pending === false ? new Date() : null,
      is_active: true, // Default to active
      first_name: insertUser.first_name || null,
      last_name: insertUser.last_name || null
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
        verified_at: status ? null : now,
        is_active: user.is_active // Preserve is_active status
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

  async getPendingFaculty(): Promise<User[]> {
    // Get all faculty users with pending verification
    return Array.from(this.users.values()).filter(
      user => user.role === "faculty" && user.verification_pending === true
    );
  }

  async getPendingAdmins(): Promise<User[]> {
    // Get all admin users with pending verification
    return Array.from(this.users.values()).filter(
      user => user.role === "admin" && user.verification_pending === true && user.is_active !== false
    );
  }

  async verifyAdmin(id: number): Promise<User | undefined> {
    // Find the admin user
    const user = this.users.get(id);
    if (!user || user.role !== "admin") {
      return undefined;
    }

    // Update verification status
    const updatedUser = {
      ...user,
      verification_pending: false,
      verified_at: new Date()
    };

    // Update the user in the map
    this.users.set(id, updatedUser);

    return updatedUser;
  }

  async rejectAdmin(id: number): Promise<User | undefined> {
    // Find the admin user
    const user = this.users.get(id);
    if (!user || user.role !== "admin" || !user.verification_pending) {
      return undefined;
    }

    // Mark the admin as inactive (soft delete)
    const updatedUser = { 
      ...user, 
      is_active: false 
    };

    // Update the user in the map
    this.users.set(id, updatedUser);

    return updatedUser;
  }

  async verifyFacultyById(id: number): Promise<User | undefined> {
    const user = this.users.get(id);

    // Check if user exists and is a faculty member
    if (!user || user.role !== "faculty") {
      return undefined;
    }

    // Update the faculty verification status
    return this.updateUserVerification(id, false); // false = not pending = verified
  }

  // Department-related methods
  private departments: Map<number, Department> = new Map();
  private departmentId = 1;

  async createDepartment(department: InsertDepartment): Promise<Department> {
    const id = this.departmentId++;
    const newDepartment: Department = {
      id,
      name: department.name,
      description: department.description || null,
      created_at: new Date()
    };

    this.departments.set(id, newDepartment);
    return newDepartment;
  }

  async getDepartmentById(id: number): Promise<Department | undefined> {
    return this.departments.get(id);
  }

  async getDepartments(): Promise<Department[]> {
    return Array.from(this.departments.values());
  }

  async getDepartmentByName(name: string): Promise<Department | undefined> {
    return Array.from(this.departments.values()).find(
      dept => dept.name.toLowerCase() === name.toLowerCase()
    );
  }

  async deleteDepartment(departmentId: number, adminId: number): Promise<Department | undefined> {
    // First check if the department exists
    const department = this.departments.get(departmentId);
    if (!department) {
      return undefined;
    }

    // Store department details for audit log and return value
    const deletedDepartment = { ...department };

    // Remove the department from map
    this.departments.delete(departmentId);

    // Update all users to clear department_id if they belonged to this department
    for (const [userId, user] of this.users.entries()) {
      if (user.department_id === departmentId) {
        this.users.set(userId, { 
          ...user, 
          department_id: null 
        });
      }
    }

    // Create audit log entry
    await this.createAuditLog({
      action: "DEPARTMENT_DELETE",
      user_id: adminId,
      performed_by: adminId,
      details: {
        department_id: deletedDepartment.id,
        department_name: deletedDepartment.name,
        description: deletedDepartment.description
      }
    });

    return deletedDepartment;
  }

  async syncStudents(students: Array<{
    email: string;
    student_id: string;
    department_name: string | null;
    first_name?: string;
    last_name?: string;
  }>): Promise<{
    success: number;
    failed: number;
    errors: Array<{ email: string; reason: string }>;
  }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ email: string; reason: string }> = [];

    // Get all departments for mapping department names to IDs
    const allDepartments = await this.getDepartments();
    const departmentMap = new Map<string, number>();
    allDepartments.forEach(dept => departmentMap.set(dept.name.toLowerCase(), dept.id));

    // Process each student in the list
    for (const student of students) {
      try {
        // Check if email is valid
        if (!student.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) {
          errors.push({ 
            email: student.email || 'Invalid email', 
            reason: 'Invalid email format' 
          });
          failedCount++;
          continue;
        }

        // Check if user already exists
        const existingUser = await this.getUserByEmail(student.email);
        if (existingUser) {
          errors.push({ 
            email: student.email, 
            reason: 'User with this email already exists' 
          });
          failedCount++;
          continue;
        }

        // Find department ID based on name if provided
        let departmentId: number | null = null;
        if (student.department_name) {
          const deptName = student.department_name.toLowerCase();
          if (departmentMap.has(deptName)) {
            departmentId = departmentMap.get(deptName) || null;
          } else {
            // Department doesn't exist, add to errors but still create the user
            errors.push({ 
              email: student.email, 
              reason: `Department '${student.department_name}' not found, user created without department` 
            });
          }
        }

        // Create a password hash for the initial student account
        // Use student ID as the initial password - students will need to change it
        const bcrypt = await import('bcrypt');
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(student.student_id, saltRounds);

        // Create the student user with auto-verification
        const newUser = await this.createUser({
          email: student.email,
          password: hashedPassword,
          role: 'student',
          role_id: student.student_id,
          department_id: departmentId,
          verification_pending: false // Auto-verified
        });

        // Log verification for the newly created student
        await this.logVerificationAttempt({
          user_id: newUser.id,
          status: 'verified',
          message: 'User automatically verified through bulk import'
        });

        successCount++;
      } catch (error) {
        console.error(`Error importing student ${student.email}:`, error);
        errors.push({ 
          email: student.email, 
          reason: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
        failedCount++;
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      errors
    };
  }

  // User with department methods
  async getUserWithDepartment(id: number): Promise<UserWithDepartment | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    if (user.department_id) {
      const department = await this.getDepartmentById(user.department_id);
      return {
        ...user,
        department
      };
    }

    return {
      ...user,
      department: null
    };
  }

  async updateUserDepartment(userId: number, departmentId: number | null): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;

    // Verify department exists if not null
    if (departmentId !== null) {
      const department = await this.getDepartmentById(departmentId);
      if (!department) {
        throw new Error(`Department with ID ${departmentId} not found`);
      }
    }

    const updatedUser: User = {
      ...user,
      department_id: departmentId,
      is_active: user.is_active // Preserve is_active status
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Student approval methods
  async getPendingStudents(): Promise<User[]> {
    // Get all student users with pending verification
    return Array.from(this.users.values()).filter(
      user => user.role === "student" && 
              user.verification_pending === true &&
              user.is_active === true
    );
  }

  async approveStudentById(id: number): Promise<User | undefined> {
    const user = this.users.get(id);

    // Check if user exists, is a student, and has pending verification
    if (!user || 
        user.role !== "student" || 
        user.verification_pending !== true) {
      return undefined;
    }

    // Update the student verification status
    return this.updateUserVerification(id, false); // false = not pending = verified
  }

  // Faculty content permission methods
  async getFacultyContentPermissionStatus(facultyId: number): Promise<{
    status: 'granted' | 'revoked' | 'pending' | 'none';
    requested_at?: string;
    reviewed_at?: string;
    reviewed_by?: string;
  }> {
    try {
      // Check if the user is a faculty member
      const faculty = this.users.get(facultyId);
      if (!faculty || faculty.role !== 'faculty') {
        return { status: 'none' };
      }

      // Find the most recent active permission request
      const activePermissions = this.facultyContentPermissions
        .filter(p => p.faculty_id === facultyId && p.is_active === true)
        .sort((a, b) => b.requested_at.getTime() - a.requested_at.getTime());

      if (activePermissions.length === 0) {
        return { status: 'none' };
      }

      const permission = activePermissions[0];

      return {
        status: permission.status as 'granted' | 'revoked' | 'pending',
        requested_at: permission.requested_at.toISOString(),
        reviewed_at: permission.reviewed_at ? permission.reviewed_at.toISOString() : undefined,
        reviewed_by: permission.reviewed_by ? String(permission.reviewed_by) : undefined
      };
    } catch (error) {
      console.error('Error checking faculty permission status:', error);
      return { status: 'none' };
    }
  }

  async requestFacultyContentPermission(facultyId: number, reason: string): Promise<boolean> {
    try {
      // Check if there's already an active request
      const existingStatus = await this.getFacultyContentPermissionStatus(facultyId);
      if (existingStatus.status === 'pending' || existingStatus.status === 'granted') {
        return false; // Already has a pending request or permission granted
      }

      // Create a new permission request
      const id = this.facultyContentPermissionId++;
      const permission: FacultyContentPermission = {
        id,
        faculty_id: facultyId,
        status: 'pending',
        reason: reason,
        requested_at: new Date(),
        reviewed_at: null,
        reviewed_by: null,
        review_notes: null,
        is_active: true
      };

      this.facultyContentPermissions.push(permission);

      return true;
    } catch (error) {
      console.error('Error requesting faculty content permission:', error);
      return false;
    }
  }

  async getFacultyWithContentAccess(): Promise<Array<{
    id: number;
    email: string;
    role_id: string;
    first_name: string | null;
    last_name: string | null;
    department_id: number | null;
    department_name: string | null;
    content_permission: 'granted' | 'revoked' | 'pending';
    content_upload_count?: number;
    last_upload_date?: string;
  }>> {
    try {
      // Get all active faculty
      const faculty = Array.from(this.users.values()).filter(
        user => user.role === 'faculty' && user.is_active === true
      );

      // For each faculty, get their department and permission status
      const result = faculty.map(f => {
        // Get department information
        let departmentName = null;
        if (f.department_id) {
          const dept = this.departments.get(f.department_id);
          departmentName = dept?.name || null;
        }

        // Get permission status
        const permissionsForFaculty = this.facultyContentPermissions
          .filter(p => p.faculty_id === f.id && p.is_active === true)
          .sort((a, b) => b.requested_at.getTime() - a.requested_at.getTime());

        let contentPermission: 'granted' | 'revoked' | 'pending' = 'revoked';
        if (permissionsForFaculty.length > 0) {
          contentPermission = permissionsForFaculty[0].status as 'granted' | 'revoked' | 'pending';
        }

        // Get content upload stats
        const facultyContent = this.content.filter(
          c => c.uploaded_by === f.id && !c.is_deleted
        );

        // Get latest upload date and count
        const contentUploadCount = facultyContent.length;
        let lastUploadDate: string | undefined = undefined;

        if (contentUploadCount > 0) {
          // Find the most recent upload
          const latestContent = facultyContent.reduce((latest, current) => {
            return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
          }, facultyContent[0]);

          lastUploadDate = latestContent.created_at.toISOString();
        }

        // Remove password before returning
        const { password, ...facultyWithoutPassword } = f;

        return {
          ...facultyWithoutPassword,
          department_name: departmentName,
          content_permission: contentPermission,
          content_upload_count: contentUploadCount,
          last_upload_date: lastUploadDate,
          role_id: f.role_id || ''  // Ensure role_id is never null
        };
      });

      return result;
    } catch (error) {
      console.error('Error fetching faculty with content access:', error);
      return [];
    }
  }

  async updateFacultyContentPermission(
    facultyId: number, 
    status: 'granted' | 'revoked', 
    adminId: number, 
    notes?: string
  ): Promise<boolean> {
    try {
      // Check if the faculty exists
      const faculty = this.users.get(facultyId);
      if (!faculty || faculty.role !== 'faculty') {
        return false;
      }

      // Find existing active permission record
      const activePermissionIndex = this.facultyContentPermissions.findIndex(
        p => p.faculty_id === facultyId && p.is_active === true
      );

      if (activePermissionIndex === -1) {
        // Create a new permission record if none exists
        const id = this.facultyContentPermissionId++;
        const permission: FacultyContentPermission = {
          id,
          faculty_id: facultyId,
          status: status,
          reason: '',
          requested_at: new Date(),
          reviewed_at: new Date(),
          reviewed_by: adminId,
          review_notes: notes || null,
          is_active: true
        };

        this.facultyContentPermissions.push(permission);
      } else {
        // Update existing permission
        const existingPermission = this.facultyContentPermissions[activePermissionIndex];
        this.facultyContentPermissions[activePermissionIndex] = {
          ...existingPermission,
          status: status,
          review_notes: notes || existingPermission.review_notes,
          reviewed_by: adminId,
          reviewed_at: new Date()
        };
      }

      return true;
    } catch (error) {
      console.error('Error updating faculty content permission:', error);
      return false;
    }
  }

  // Note: The subject-faculty assignment methods were already added above

  // Subject-Faculty Assignment methods - These methods are implemented in DatabaseStorage
  // We use MemStorage only for testing purposes, so these are simplified implementations

  // Subject-Faculty Assignment Methods
  // These methods implement the same interface as the DatabaseStorage class
  // but use in-memory data structures instead of database queries

  /**
   * Creates a new subject-faculty assignment
   */
  async createSubjectFacultyAssignment(assignment: InsertSubjectFacultyAssignment): Promise<SubjectFacultyAssignment> {
    try {
      const id = this.subjectFacultyAssignmentId++;
      const newAssignment: SubjectFacultyAssignment = {
        ...assignment,
        id,
        assigned_at: new Date(),
        is_active: true
      };

      this.subjectFacultyAssignments.push(newAssignment);

      // Log this action for consistency
      this.createAuditLog({
        action: 'SUBJECT_ASSIGNMENT_CREATED',
        user_id: assignment.faculty_id,
        performed_by: assignment.assigned_by,
        details: {
          subject_name: assignment.subject_name,
          department_id: assignment.department_id
        }
      });

      return newAssignment;
    } catch (error) {
      console.error('Error creating subject-faculty assignment:', error);
      throw error;
    }
  }

  /**
   * Gets all subject-faculty assignments, optionally filtered by faculty and/or department
   */
  async getSubjectFacultyAssignments(facultyId?: number, departmentId?: number): Promise<SubjectFacultyAssignmentWithRelations[]> {
    try {
      // Start with all active assignments
      let assignments = this.subjectFacultyAssignments.filter(a => a.is_active);

      // Filter by faculty ID if provided
      if (facultyId) {
        assignments = assignments.filter(a => a.faculty_id === facultyId);
      }

      // Filter by department ID if provided
      if (departmentId) {
        assignments = assignments.filter(a => a.department_id === departmentId);
      }

      // Add related entities (faculty, department, admin)
      return assignments.map(a => ({
        ...a,
        faculty: this.users.get(a.faculty_id),
        department: a.department_id ? this.departments.get(a.department_id) : undefined,
        admin: this.users.get(a.assigned_by)
      }));
    } catch (error) {
      console.error('Error getting subject-faculty assignments:', error);
      return [];
    }
  }

  /**
   * Gets a specific subject-faculty assignment by ID
   */
  async getSubjectFacultyAssignment(id: number): Promise<SubjectFacultyAssignmentWithRelations | undefined> {
    try {
      const assignment = this.subjectFacultyAssignments.find(a => a.id === id && a.is_active);
      if (!assignment) return undefined;

      // Add related entities (faculty, department, admin)
      return {
        ...assignment,
        faculty: this.users.get(assignment.faculty_id),
        department: assignment.department_id ? this.departments.get(assignment.department_id) : undefined,
        admin: this.users.get(assignment.assigned_by)
      };
    } catch (error) {
      console.error('Error getting subject-faculty assignment:', error);
      return undefined;
    }
  }

  /**
   * Soft-deletes a subject-faculty assignment by setting is_active to false
   */
  async removeSubjectFacultyAssignment(id: number, adminId: number): Promise<SubjectFacultyAssignment | undefined> {
    try {
      const assignmentIndex = this.subjectFacultyAssignments.findIndex(a => a.id === id && a.is_active);
      if (assignmentIndex === -1) return undefined;

      const assignment = this.subjectFacultyAssignments[assignmentIndex];
      this.subjectFacultyAssignments[assignmentIndex] = {
        ...assignment,
        is_active: false
      };

      // Log the removal action
      this.createAuditLog({
        action: 'SUBJECT_ASSIGNMENT_REMOVED',
        user_id: assignment.faculty_id,
        performed_by: adminId,
        details: {
          subject_name: assignment.subject_name,
          department_id: assignment.department_id
        }
      });

      return this.subjectFacultyAssignments[assignmentIndex];
    } catch (error) {
      console.error('Error removing subject-faculty assignment:', error);
      return undefined;
    }
  }

  /**
   * Updates an existing subject-faculty assignment
   */
  async updateSubjectFacultyAssignment(
    id: number, 
    adminId: number, 
    updates: {subject_name: string, department_id?: number | null}
  ): Promise<SubjectFacultyAssignment | undefined> {
    try {
      const assignmentIndex = this.subjectFacultyAssignments.findIndex(a => a.id === id && a.is_active);
      if (assignmentIndex === -1) return undefined;

      const oldAssignment = this.subjectFacultyAssignments[assignmentIndex];
      const updatedAssignment = {
        ...oldAssignment,
        subject_name: updates.subject_name.trim(),
        department_id: updates.department_id
      };

      this.subjectFacultyAssignments[assignmentIndex] = updatedAssignment;

      // Log the update action
      this.createAuditLog({
        action: 'SUBJECT_ASSIGNMENT_UPDATED',
        user_id: oldAssignment.faculty_id,
        performed_by: adminId,
        details: {
          old_subject_name: oldAssignment.subject_name,
          new_subject_name: updates.subject_name,
          old_department_id: oldAssignment.department_id,
          new_department_id: updates.department_id
        }
      });

      return updatedAssignment;
    } catch (error) {
      console.error('Error updating subject-faculty assignment:', error);
      return undefined;
    }
  }

  /**
   * Gets the list of unique subjects assigned to a faculty member
   */
  async getSubjectsByFaculty(facultyId: number): Promise<string[]> {
    try {
      const assignments = this.subjectFacultyAssignments.filter(
        a => a.faculty_id === facultyId && a.is_active
      );

      // Convert the mapped array to a Set to remove duplicates, then back to an array
      return Array.from(new Set(assignments.map(a => a.subject_name)));
    } catch (error) {
      console.error('Error getting subjects by faculty:', error);
      return [];
    }
  }

  // Content management methods
  async getContentByDepartment(deptId: number): Promise<ContentWithRelations[]> {
    return this.content
      .filter(c => c.department_id === deptId && !c.is_deleted)
      .map(c => ({
        ...c,
        department: this.departments.get(c.department_id) || undefined,
        uploader: this.users.get(c.uploaded_by) || undefined
      }));
  }

  async getAllContent(): Promise<ContentWithRelations[]> {
    return this.content
      .filter(c => !c.is_deleted)
      .map(c => ({
        ...c,
        department: this.departments.get(c.department_id) || undefined,
        uploader: this.users.get(c.uploaded_by) || undefined
      }));
  }

  async getContentById(id: number): Promise<ContentWithRelations | undefined> {
    const contentItem = this.content.find(c => c.id === id && !c.is_deleted);
    if (!contentItem) return undefined;

    return {
      ...contentItem,
      department: this.departments.get(contentItem.department_id) || undefined,
      uploader: this.users.get(contentItem.uploaded_by) || undefined
    };
  }

  async createContent(insertContent: InsertContent): Promise<Content> {
    const id = this.contentId++;
    const content: Content = {
      ...insertContent,
      id,
      is_deleted: false,
      views: 0,
      downloads: 0,
      likes_percent: 0,
      likes_count: 0,
      dislikes_count: 0,
      tags: insertContent.tags || [],
      created_at: new Date(),
      updated_at: new Date()
    };

    this.content.push(content);
    return content;
  }

  // Subject management methods
  async createSubject(subject: InsertSubject): Promise<Subject> {
    const id = this.subjectId++;
    const newSubject: Subject = {
      ...subject,
      id,
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true
    };

    this.subjects.push(newSubject);

    // Log the creation
    await this.createAuditLog({
      action: 'SUBJECT_CREATED',
      user_id: subject.created_by,
      performed_by: subject.created_by,
      details: {
        subject_name: subject.name,
        department_id: subject.department_id
      }
    });

    return newSubject;
  }

  async getSubjectById(id: number): Promise<SubjectWithRelations | undefined> {
    const subject = this.subjects.find(s => s.id === id && s.is_active === true);
    if (!subject) return undefined;

    // Get related data
    const department = subject.department_id ? this.departments.get(subject.department_id) : undefined;
    const creator = this.users.get(subject.created_by);

    return {
      ...subject,
      department,
      creator
    };
  }

  async getAllSubjects(): Promise<SubjectWithRelations[]> {
    const activeSubjects = this.subjects.filter(s => s.is_active === true);

    // Get related data for each subject
    return activeSubjects.map(subject => {
      const department = subject.department_id ? this.departments.get(subject.department_id) : undefined;
      const creator = this.users.get(subject.created_by);

      return {
        ...subject,
        department,
        creator
      };
    });
  }

  async getSubjectsByDepartment(departmentId: number): Promise<SubjectWithRelations[]> {
    const departmentSubjects = this.subjects.filter(
      s => s.department_id === departmentId && s.is_active === true
    );

    // Get related data for each subject
    return departmentSubjects.map(subject => {
      const department = subject.department_id ? this.departments.get(subject.department_id) : undefined;
      const creator = this.users.get(subject.created_by);

      return {
        ...subject,
        department,
        creator
      };
    });
  }

  async updateSubject(id: number, updates: UpdateSubject): Promise<Subject | undefined> {
    const subjectIndex = this.subjects.findIndex(s => s.id === id && s.is_active === true);
    if (subjectIndex === -1) return undefined;

    // Get the original subject for audit log
    const originalSubject = this.subjects[subjectIndex];

    // Update the subject
    const updatedSubject = {
      ...originalSubject,
      ...updates,
      updated_at: new Date()
    };

    this.subjects[subjectIndex] = updatedSubject;

    // Log the update
    await this.createAuditLog({
      action: 'SUBJECT_UPDATED',
      user_id: updates.updated_by || originalSubject.created_by,
      performed_by: updates.updated_by || originalSubject.created_by,
      details: {
        subject_id: id,
        old_name: originalSubject.name,
        new_name: updates.name || originalSubject.name,
        old_department_id: originalSubject.department_id,
        new_department_id: updates.department_id || originalSubject.department_id
      }
    });

    return updatedSubject;
  }

  async deleteSubject(id: number, adminId: number): Promise<Subject | undefined> {
    const subjectIndex = this.subjects.findIndex(s => s.id === id && s.is_active === true);
    if (subjectIndex === -1) return undefined;

    // Get the subject to be deleted
    const subject = { ...this.subjects[subjectIndex] };

    // Soft delete by marking as inactive
    this.subjects[subjectIndex] = {
      ...subject,
      is_active: false,
      updated_at: new Date()
    };

    // Log the deletion
    await this.createAuditLog({
      action: 'SUBJECT_DELETED',
      user_id: adminId,
      performed_by: adminId,
      details: {
        subject_id: id,
        subject_name: subject.name,
        department_id: subject.department_id
      }
    });

    return subject;
  }

  // Method to create test accounts for all roles
  private createTestAccounts() {
    try {
      // Create admin account if it doesn't exist
      const adminExists = Array.from(this.users.values()).some(user => user.email === "admin@activelearn.edu");
      if (!adminExists) {
        console.log("Creating admin test account...");
        this.createUser({
          email: "admin@activelearn.edu",
          password: "$2b$10$pig.eclqqBJFUexvAksD4urtYbxH.MVbb9uxPae6OXvlebQyjASla", // "password123"
          role: "admin",
          role_id: "ADMIN001",
          verification_pending: false,
          first_name: "Vikram",
          last_name: "Sharma",
          is_active: true
        });
      }

      // Create test student account if it doesn't exist
      const studentExists = Array.from(this.users.values()).some(user => user.email === "test_student@activelearn.edu");
      if (!studentExists) {
        console.log("Creating student test account...");
        this.createUser({
          email: "test_student@activelearn.edu",
          password: "$2b$10$pig.eclqqBJFUexvAksD4urtYbxH.MVbb9uxPae6OXvlebQyjASla", // "password123"
          role: "student",
          role_id: "STUDENT001",
          verification_pending: false, // Already verified
          first_name: "Arjun",
          last_name: "Reddy",
          is_active: true
        });
      }

      // Create test faculty account if it doesn't exist
      const facultyExists = Array.from(this.users.values()).some(user => user.email === "test_faculty@activelearn.edu");
      if (!facultyExists) {
        console.log("Creating faculty test account...");
        this.createUser({
          email: "test_faculty@activelearn.edu",
          password: "$2b$10$pig.eclqqBJFUexvAksD4urtYbxH.MVbb9uxPae6OXvlebQyjASla", // "password123"
          role: "faculty",
          role_id: "F001",
          verification_pending: false, // Already verified
          first_name: "Priya",
          last_name: "Mehta",
          department_id: 1,
          is_active: true
        });
      }

      console.log("Test accounts setup complete");
    } catch (error) {
      console.error("Error creating test accounts:", error);
    }
  }
}

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();