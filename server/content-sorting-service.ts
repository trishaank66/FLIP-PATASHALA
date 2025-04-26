/**
 * Service to handle content sorting into class folders
 */
import { db } from "./db";
import { content, auditLogs, subjectFacultyAssignments, users, departments } from "@shared/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";

export class ContentSortingService {
  /**
   * Sort content into a class folder (subject-faculty assignment)
   */
  static async sortContent(
    contentId: number, 
    subjectFacultyAssignmentId: number, 
    currentUserId: number
  ): Promise<{ success: boolean; errorMessage?: string }> {
    console.log(`Sorting content ID ${contentId} to assignment ID ${subjectFacultyAssignmentId} by user ${currentUserId}`);
    
    // Verify the content exists and is not deleted
    const [contentItem] = await db
      .select()
      .from(content)
      .where(and(eq(content.id, contentId), eq(content.is_deleted, false)));
    
    if (!contentItem) {
      console.log(`Content ID ${contentId} not found or is deleted`);
      return { success: false, errorMessage: "Content not found or is deleted" };
    }
    console.log('Content found:', contentItem);

    // Verify the subject-faculty assignment exists
    const [assignment] = await db
      .select()
      .from(subjectFacultyAssignments)
      .where(and(
        eq(subjectFacultyAssignments.id, subjectFacultyAssignmentId),
        eq(subjectFacultyAssignments.is_active, true)
      ));
    
    if (!assignment) {
      console.log(`Assignment ID ${subjectFacultyAssignmentId} not found or is not active`);
      return { success: false, errorMessage: "Subject-faculty assignment not found or is not active" };
    }
    console.log('Assignment found:', assignment);

    // Get the current user's role to determine permissions
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, currentUserId));
    
    if (!currentUser) {
      console.log(`User with ID ${currentUserId} not found`);
      return { success: false, errorMessage: "User not found" };
    }
    console.log('Current user found:', currentUser);

    // Check permissions:
    // 1. Admins can sort any content
    // 2. Faculty can only sort their own uploaded content to their own assignments
    if (currentUser.role === 'faculty') {
      // Faculty can only sort content they uploaded
      if (contentItem.uploaded_by !== currentUserId) {
        console.log('Permission denied: Faculty trying to sort content they did not upload');
        return { success: false, errorMessage: "Permission denied: You can only sort content you uploaded" };
      }
      
      // Faculty can only sort to their own assignments
      if (assignment.faculty_id !== currentUserId) {
        console.log('Permission denied: Faculty trying to sort to assignment not assigned to them');
        return { success: false, errorMessage: "Permission denied: You can only sort to classes assigned to you" };
      }
    }
    console.log('Permission checks passed for user:', currentUser.role);

    // Update the content with the new assignment
    await db
      .update(content)
      .set({ 
        subject_faculty_assignment_id: subjectFacultyAssignmentId,
        updated_at: new Date()
      })
      .where(eq(content.id, contentId));

    // Log the action in audit logs
    try {
      await db.insert(auditLogs).values({
        action: 'sort_content',
        user_id: currentUserId, // The user performing the action
        performed_by: currentUserId, // The user who is doing the sorting 
        details: {
          content_id: contentId,
          content_title: contentItem.title,
          uploaded_by: contentItem.uploaded_by,
          subject_faculty_assignment_id: subjectFacultyAssignmentId,
          assignment_details: {
            subject: assignment.subject_name,
            faculty_id: assignment.faculty_id
          }
        },
        affected_user_id: assignment.faculty_id, // The faculty whose class is receiving the content
        ip_address: null // Not tracking IP in this implementation
      });
    } catch (error) {
      // Log the error but don't fail the sorting operation
      console.error('Error creating audit log for content sorting:', error);
    }

    console.log('Content sorted successfully!');
    return { success: true };
  }

  /**
   * Get all class folders (subject-faculty assignments) for a faculty member
   */
  static async getFacultyClassFolders(facultyId: number): Promise<any[]> {
    const assignments = await db
      .select({
        id: subjectFacultyAssignments.id,
        subject_name: subjectFacultyAssignments.subject_name,
        department_name: departments.name,
        folder_name: subjectFacultyAssignments.subject_name
      })
      .from(subjectFacultyAssignments)
      .leftJoin(departments, eq(subjectFacultyAssignments.department_id, departments.id))
      .where(and(
        eq(subjectFacultyAssignments.faculty_id, facultyId),
        eq(subjectFacultyAssignments.is_active, true)
      ));
    
    return assignments.map(a => ({
      ...a,
      folder_name: a.department_name 
        ? `${a.department_name} - ${a.subject_name}`
        : a.subject_name
    }));
  }

  /**
   * Get all class folders for admin view
   */
  static async getAllClassFolders(): Promise<any[]> {
    const assignments = await db
      .select({
        id: subjectFacultyAssignments.id,
        subject_name: subjectFacultyAssignments.subject_name,
        department_name: departments.name,
        faculty_id: subjectFacultyAssignments.faculty_id,
        faculty_first_name: users.first_name,
        faculty_last_name: users.last_name
      })
      .from(subjectFacultyAssignments)
      .leftJoin(departments, eq(subjectFacultyAssignments.department_id, departments.id))
      .leftJoin(users, eq(subjectFacultyAssignments.faculty_id, users.id))
      .where(eq(subjectFacultyAssignments.is_active, true));
    
    return assignments.map(a => ({
      id: a.id,
      subject_name: a.subject_name,
      department_name: a.department_name,
      faculty_id: a.faculty_id,
      faculty_name: a.faculty_first_name && a.faculty_last_name 
        ? `${a.faculty_first_name} ${a.faculty_last_name}` 
        : 'Unknown Faculty',
      folder_name: a.department_name 
        ? `${a.department_name} - ${a.subject_name} (${a.faculty_first_name || ''} ${a.faculty_last_name || ''})`
        : `${a.subject_name} (${a.faculty_first_name || ''} ${a.faculty_last_name || ''})`
    }));
  }

  /**
   * Get content with assignment information for sorting interface
   */
  static async getContentWithAssignments(userId: number, userRole: string): Promise<any[]> {
    let query = db
      .select({
        id: content.id,
        title: content.title,
        type: content.type,
        filename: content.filename,
        uploaded_by: content.uploaded_by,
        subject: content.subject,
        faculty: content.faculty,
        preview_url: content.preview_url,
        views: content.views,
        downloads: content.downloads,
        subject_faculty_assignment_id: content.subject_faculty_assignment_id,
        assignment_id: subjectFacultyAssignments.id,
        subject_name: subjectFacultyAssignments.subject_name,
        department_name: departments.name,
        faculty_id: subjectFacultyAssignments.faculty_id,
        faculty_first_name: users.first_name,
        faculty_last_name: users.last_name
      })
      .from(content)
      .leftJoin(
        subjectFacultyAssignments, 
        eq(content.subject_faculty_assignment_id, subjectFacultyAssignments.id)
      )
      .leftJoin(
        departments, 
        eq(subjectFacultyAssignments.department_id, departments.id)
      )
      .leftJoin(
        users,
        eq(subjectFacultyAssignments.faculty_id, users.id)
      )
      .where(eq(content.is_deleted, false));
    
    // Faculty can only see their own content
    if (userRole === 'faculty') {
      query = query.where(eq(content.uploaded_by, userId));
    }

    const results = await query;

    return results.map(item => ({
      id: item.id,
      title: item.title,
      type: item.type,
      filename: item.filename,
      preview_url: item.preview_url,
      views: item.views,
      downloads: item.downloads,
      uploaded_by: item.uploaded_by,
      subject: item.subject,
      faculty: item.faculty,
      subject_faculty_assignment_id: item.subject_faculty_assignment_id,
      assignment_details: item.assignment_id ? {
        id: item.assignment_id,
        subject_name: item.subject_name,
        department_name: item.department_name,
        faculty_id: item.faculty_id,
        faculty_name: item.faculty_first_name && item.faculty_last_name 
          ? `${item.faculty_first_name} ${item.faculty_last_name}` 
          : 'Unknown Faculty',
        folder_name: item.department_name 
          ? `${item.department_name} - ${item.subject_name} (${item.faculty_first_name || ''} ${item.faculty_last_name || ''})`
          : `${item.subject_name} (${item.faculty_first_name || ''} ${item.faculty_last_name || ''})`
      } : null
    }));
  }

  /**
   * Get unsorted content for a faculty member
   */
  static async getUnsortedContentForFaculty(facultyId: number): Promise<any[]> {
    const unsortedContent = await db
      .select()
      .from(content)
      .where(and(
        eq(content.uploaded_by, facultyId),
        eq(content.is_deleted, false),
        isNull(content.subject_faculty_assignment_id)
      ));
    
    return unsortedContent;
  }
}