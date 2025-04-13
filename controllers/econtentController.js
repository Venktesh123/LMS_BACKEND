// controllers/econtentController.js
const econtentRepository = require("../repository/econtentRepository");
const courseRepository = require("../repository/courseRepository");
const teacherRepository = require("../repository/teacherRepository");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { ErrorHandler } = require("../middleware/errorHandler");
const { uploadFileToS3, deleteFileFromS3 } = require("../utils/s3Helper");

// Create new e-content for a course
exports.createEContent = catchAsyncErrors(async (req, res, next) => {
  const { courseId } = req.params;
  const { moduleNumber, moduleTitle, link } = req.body;

  try {
    // Verify teacher has access to course
    const teacher = await teacherRepository.findByUserId(req.user.id);
    if (!teacher) {
      return next(new ErrorHandler("Teacher profile not found", 404));
    }

    // Check if the course exists and belongs to this teacher
    const course = await courseRepository.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    if (course.teacherId !== teacher.id) {
      return next(
        new ErrorHandler(
          "You don't have permission to add content to this course",
          403
        )
      );
    }

    // Find or create eContent for this course
    let eContent = await econtentRepository.findByCourseId(courseId);
    if (!eContent) {
      eContent = await econtentRepository.create(courseId);
    }

    // Create module
    const moduleData = {
      eContentId: eContent.id,
      moduleNumber: moduleNumber || 1,
      moduleTitle: moduleTitle || "Untitled Module",
      link: link || null,
    };

    const module = await econtentRepository.createModule(moduleData);

    // Handle files upload
    if (req.files && req.files.files) {
      let filesArray = Array.isArray(req.files.files)
        ? req.files.files
        : [req.files.files];

      // Validate file types
      const allowedTypes = [
        "application/pdf",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      // Upload files to S3
      const uploadPromises = filesArray
        .filter((file) => allowedTypes.includes(file.mimetype))
        .map(async (file) => {
          try {
            // Get file type extension
            let fileType = "other";
            if (file.mimetype === "application/pdf") {
              fileType = "pdf";
            } else if (
              file.mimetype.includes("powerpoint") ||
              file.mimetype.includes("presentation")
            ) {
              fileType = file.mimetype.includes("openxmlformats")
                ? "pptx"
                : "ppt";
            }

            // Upload to S3
            const uploadResult = await uploadFileToS3(
              file,
              `econtent/${course.id}/${module.id}`
            );

            // Create file record
            return await econtentRepository.createFile({
              moduleId: module.id,
              fileType,
              fileUrl: uploadResult.url,
              fileKey: uploadResult.key,
              fileName: file.name,
              uploadDate: new Date(),
            });
          } catch (error) {
            console.error("Error uploading file:", error);
            return null;
          }
        });

      await Promise.all(uploadPromises);
    }

    // Get the created module with files
    const createdModule = await econtentRepository.findModuleById(module.id);

    return res.status(201).json({
      success: true,
      message: "E-content module created successfully",
      module: createdModule,
    });
  } catch (error) {
    console.error("Error creating e-content:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get e-content for a course
exports.getEContentByCourse = catchAsyncErrors(async (req, res, next) => {
  const { courseId } = req.params;

  try {
    // Check if the course exists
    const course = await courseRepository.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // If user is a teacher, verify course belongs to them
    if (req.user.role === "teacher") {
      const teacher = await teacherRepository.findByUserId(req.user.id);
      if (!teacher || course.teacherId !== teacher.id) {
        return next(new ErrorHandler("Unauthorized access", 403));
      }
    }
    // For students, check enrollment would be here

    // Get e-content for this course
    const eContent = await econtentRepository.findByCourseId(courseId);

    if (!eContent) {
      return res.status(200).json({
        success: true,
        message: "No e-content available for this course",
        eContent: null,
      });
    }

    return res.status(200).json({
      success: true,
      eContent,
    });
  } catch (error) {
    console.error("Error fetching e-content:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get specific module
exports.getModuleById = catchAsyncErrors(async (req, res, next) => {
  const { courseId, moduleId } = req.params;

  try {
    // Check if the course exists
    const course = await courseRepository.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Check module
    const module = await econtentRepository.findModuleById(moduleId);
    if (!module) {
      return next(new ErrorHandler("Module not found", 404));
    }

    return res.status(200).json({
      success: true,
      module,
    });
  } catch (error) {
    console.error("Error fetching module:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update module
exports.updateModule = catchAsyncErrors(async (req, res, next) => {
  const { courseId, moduleId } = req.params;
  const { moduleNumber, moduleTitle, link } = req.body;

  try {
    // Verify teacher has access to course
    const teacher = await teacherRepository.findByUserId(req.user.id);
    if (!teacher) {
      return next(new ErrorHandler("Teacher profile not found", 404));
    }

    // Check if the course exists and belongs to this teacher
    const course = await courseRepository.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    if (course.teacherId !== teacher.id) {
      return next(
        new ErrorHandler("You don't have permission to modify this course", 403)
      );
    }

    // Check if module exists
    const module = await econtentRepository.findModuleById(moduleId);
    if (!module) {
      return next(new ErrorHandler("Module not found", 404));
    }

    // Prepare update data
    const updateData = {};
    if (moduleNumber) updateData.moduleNumber = moduleNumber;
    if (moduleTitle) updateData.moduleTitle = moduleTitle;
    if (link !== undefined) updateData.link = link;

    // Update module
    const updatedModule = await econtentRepository.updateModule(
      moduleId,
      updateData
    );

    // Handle files upload
    if (req.files && req.files.files) {
      let filesArray = Array.isArray(req.files.files)
        ? req.files.files
        : [req.files.files];

      // Validate file types
      const allowedTypes = [
        "application/pdf",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      // Upload files to S3
      const uploadPromises = filesArray
        .filter((file) => allowedTypes.includes(file.mimetype))
        .map(async (file) => {
          try {
            // Get file type extension
            let fileType = "other";
            if (file.mimetype === "application/pdf") {
              fileType = "pdf";
            } else if (
              file.mimetype.includes("powerpoint") ||
              file.mimetype.includes("presentation")
            ) {
              fileType = file.mimetype.includes("openxmlformats")
                ? "pptx"
                : "ppt";
            }

            // Upload to S3
            const uploadResult = await uploadFileToS3(
              file,
              `econtent/${course.id}/${moduleId}`
            );

            // Create file record
            return await econtentRepository.createFile({
              moduleId: moduleId,
              fileType,
              fileUrl: uploadResult.url,
              fileKey: uploadResult.key,
              fileName: file.name,
              uploadDate: new Date(),
            });
          } catch (error) {
            console.error("Error uploading file:", error);
            return null;
          }
        });

      await Promise.all(uploadPromises);
    }

    // Get updated module with files
    const finalModule = await econtentRepository.findModuleById(moduleId);

    return res.status(200).json({
      success: true,
      message: "Module updated successfully",
      module: finalModule,
    });
  } catch (error) {
    console.error("Error updating module:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Delete module
exports.deleteModule = catchAsyncErrors(async (req, res, next) => {
  const { courseId, moduleId } = req.params;

  try {
    // Verify teacher has access to course
    const teacher = await teacherRepository.findByUserId(req.user.id);
    if (!teacher) {
      return next(new ErrorHandler("Teacher profile not found", 404));
    }

    // Check if the course exists and belongs to this teacher
    const course = await courseRepository.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    if (course.teacherId !== teacher.id) {
      return next(
        new ErrorHandler("You don't have permission to modify this course", 403)
      );
    }

    // Check if module exists
    const module = await econtentRepository.findModuleById(moduleId);
    if (!module) {
      return next(new ErrorHandler("Module not found", 404));
    }

    // Delete all files from S3 first
    if (module.files && module.files.length > 0) {
      for (const file of module.files) {
        try {
          if (file.fileKey) {
            await deleteFileFromS3(file.fileKey);
          }
          await econtentRepository.deleteFile(file.id);
        } catch (error) {
          console.error(`Error deleting file ${file.id}:`, error);
        }
      }
    }

    // Delete the module
    await econtentRepository.deleteModule(moduleId);

    return res.status(200).json({
      success: true,
      message: "Module deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting module:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Delete file from module
exports.deleteFile = catchAsyncErrors(async (req, res, next) => {
  const { courseId, moduleId, fileId } = req.params;

  try {
    // Verify teacher has access to course
    const teacher = await teacherRepository.findByUserId(req.user.id);
    if (!teacher) {
      return next(new ErrorHandler("Teacher profile not found", 404));
    }

    // Check if the course exists and belongs to this teacher
    const course = await courseRepository.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    if (course.teacherId !== teacher.id) {
      return next(
        new ErrorHandler("You don't have permission to modify this course", 403)
      );
    }

    // Check if file exists
    const file = await econtentRepository.findFileById(fileId);
    if (!file) {
      return next(new ErrorHandler("File not found", 404));
    }

    // Check if file belongs to the specified module
    if (file.moduleId.toString() !== moduleId) {
      return next(
        new ErrorHandler("File does not belong to the specified module", 400)
      );
    }

    // Delete file from S3
    if (file.fileKey) {
      await deleteFileFromS3(file.fileKey);
    }

    // Delete file record
    await econtentRepository.deleteFile(fileId);

    return res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});
