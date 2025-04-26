  /**
   * Update content file and metadata
   */
  static async updateContentWithFile(
    id: number, 
    data: UpdateContent, 
    file: Express.Multer.File, 
    uploadedBy: number
  ): Promise<ContentWithRelations | undefined> {
    try {
      // First check if the content exists
      const existingContent = await db
        .select()
        .from(content)
        .where(and(
          eq(content.id, id),
          eq(content.uploaded_by, uploadedBy)
        ));

      if (!existingContent || existingContent.length === 0) {
        console.error(`Content with ID ${id} not found or does not belong to user ${uploadedBy}`);
        return undefined;
      }

      // Get the old file path to delete later
      const oldFilePath = this.getFullFilePath(existingContent[0].url);

      // Get the file type and create a unique filename
      const contentType = this.getContentType(file.originalname);
      const timestamp = new Date().getTime();
      const filename = `${timestamp}_${file.originalname.replace(/\s+/g, '_')}`;
      const filepath = path.join(process.cwd(), 'content/uploads', filename);

      // Ensure the uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'content/uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Write the new file - handle different possible file formats from multer
      if (file.path && fs.existsSync(file.path)) {
        // File is on disk, copy it to the final location
        fs.copyFileSync(file.path, filepath);
      } else if (file.buffer) {
        // File is in memory, write buffer to disk
        fs.writeFileSync(filepath, file.buffer);
      } else {
        throw new Error("File data is missing - neither path nor buffer is available");
      }

      // Update the content with the new file and data
      const [updatedContent] = await db
        .update(content)
        .set({
          ...data,
          filename: file.originalname,
          url: `/content/uploads/${filename}`,
          type: contentType,
          updated_at: new Date()
        })
        .where(eq(content.id, id))
        .returning();

      if (!updatedContent) {
        console.error(`Failed to update content with ID ${id}`);
        // Clean up the new file
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        return undefined;
      }

      // Delete the old file
      try {
        if (fs.existsSync(oldFilePath) && !oldFilePath.includes('/content/samples/')) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (deleteError) {
        console.error(`Error deleting old file ${oldFilePath}:`, deleteError);
        // Continue even if deleting the old file fails
      }

      // Fetch the updated content with relations
      return this.getContentById(id);
    } catch (error) {
      console.error(`Error updating content with file with ID ${id}:`, error);
      return undefined;
    }
  }
