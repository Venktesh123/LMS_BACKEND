// controllers/assignmentController.js
const assignmentRepository = require("../repository/assignmentRepository");
const courseRepository = require("../repository/courseRepository");
const teacherRepository = require("../repository/teacherRepository");
const studentRepository = require("../repository/studentRepository");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { ErrorHandler } = require("../middleware/errorHandler");
const { sequelize } = require("../config/database");
const AWS = require("aws-sdk");

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Upload file to S3
const uploadFileToS3 = async (file, path) => {
  console.log("Uploading file to S3");
  return new Promise((resolve, reject) => {
    // Make sure we have the file data in the right format for S3
    const fileContent = file.data;
    if (!fileContent) {
      console.log("No file content found");
      return reject(new Error("No file content found"));
    }

    // Generate a unique filename
    const fileName = `${path}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

    // Set up the S3 upload parameters without ACL
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: fileContent,
      ContentType: file.mimetype,
    };

    console.log("S3 upload params prepared");

    // Upload to S3
    s3.upload(params, (err, data) => {
      if (err) {
        console.log("S3 upload error:", err);
        return reject(err);
      }
      console.log("File uploaded successfully:", fileName);
      resolve({
        url: data.Location,
        key: data.Key,
      });
    });
  });
};

// Create new assignment
exports.createAssignment = catchAsyncErrors(async (req, res, next) => {
  console.log("createAssignment: Started");

  // Start transaction
  const transaction = await sequelize.transaction();

  try {
    const { title, description, dueDate, totalPoints } = req.body;
    const { courseId } = req.params;

    console.log(`Creating assignment for course: ${courseId}`);

    // Validate inputs
    if (!title || !description || !dueDate || !totalPoints) {
      return next(new ErrorHandler("All fields are required", 400));
    }

    // Find teacher
    const teacher = await teacherRepository.findByUserId(req.user.id);
    if (!teacher) {
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Check if course exists and belongs to this teacher
    const course = await courseRepository.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    if (course.teacherId !== teacher.id) {
      return next(
        new ErrorHandler(
          "You don't have permission to create assignments for this course",
          403
        )
      );
    }

    // Create assignment object
    const assignmentData = {
      title,
      description,
      courseId,
      dueDate,
      totalPoints,
      isActive: true, // Default value
      attachments: [],
    };

    // Handle file uploads if any
    if (req.files && req.files.attachments) {
      console.log("Processing file attachments");

      let attachmentsArray = Array.isArray(req.files.attachments)
        ? req.files.attachments
        : [req.files.attachments];

      console.log(`Found ${attachmentsArray.length} attachments`);

      // Validate file types
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      for (const file of attachmentsArray) {
        console.log(
          `Validating file: ${file.name}, type: ${file.mimetype}, size: ${file.size}`
        );

        if (!allowedTypes.includes(file.mimetype)) {
          return next(
            new ErrorHandler(
              `Invalid file type. Allowed types: PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX`,
              400
            )
          );
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          return next(
            new ErrorHandler(`File too large. Maximum size allowed is 5MB`, 400)
          );
        }
      }

      // Upload attachments to S3
      try {
        console.log("Starting file uploads to S3");

        const uploadPromises = attachmentsArray.map((file) =>
          uploadFileToS3(file, "assignment-attachments")
        );

        const uploadedFiles = await Promise.all(uploadPromises);
        console.log(`Successfully uploaded ${uploadedFiles.length} files`);

        // Add attachments to assignment
        assignmentData.attachments = uploadedFiles.map((file) => ({
          name: file.key.split("/").pop(), // Extract filename from key
          url: file.url,
        }));

        console.log("Attachments added to assignment");
      } catch (uploadError) {
        console.error("Error uploading files:", uploadError);
        return next(new ErrorHandler("Failed to upload files", 500));
      }
    }

    // Create the assignment
    const assignment = await assignmentRepository.create(assignmentData);
    console.log(`Assignment saved with ID: ${assignment.id}`);

    // Commit transaction
    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Assignment created successfully",
      assignment,
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();

    console.log(`Error in createAssignment: ${error.message}`);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Submit assignment (for students)
exports.submitAssignment = catchAsyncErrors(async (req, res, next) => {
  console.log("submitAssignment: Started");

  // Start transaction
  const transaction = await sequelize.transaction();

  try {
    // Verify student permissions
    const student = await studentRepository.findByUserId(req.user.id);
    if (!student) {
      return next(new ErrorHandler("Student not found", 404));
    }
    console.log("Student found:", student.id);

    // Get the assignment
    const assignment = await assignmentRepository.findById(
      req.params.assignmentId
    );
    if (!assignment) {
      return next(new ErrorHandler("Assignment not found", 404));
    }
    console.log("Assignment found:", assignment.id);

    // Check if the student is enrolled in the course
    const course = await courseRepository.findById(assignment.courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Check enrollment
    const enrolledCourses = await courseRepository.findByStudentId(student.id);
    const isEnrolled = enrolledCourses.some((c) => c.id === course.id);

    if (!isEnrolled) {
      return next(new ErrorHandler("Not enrolled in this course", 403));
    }
    console.log("Student is enrolled in the course");

    // Check if the assignment is active
    if (!assignment.isActive) {
      return next(
        new ErrorHandler(
          "This assignment is no longer accepting submissions",
          400
        )
      );
    }

    // Check if file is provided
    if (!req.files || !req.files.submissionFile) {
      return next(new ErrorHandler("Please upload your submission file", 400));
    }

    const submissionFile = req.files.submissionFile;
    console.log("Submission file details:", {
      name: submissionFile.name,
      size: submissionFile.size,
      mimetype: submissionFile.mimetype,
    });

    // Validate file type
    const validFileTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "application/zip",
      "application/x-zip-compressed",
    ];

    if (!validFileTypes.includes(submissionFile.mimetype)) {
      return next(
        new ErrorHandler(
          "Invalid file type. Please upload a valid document.",
          400
        )
      );
    }

    // Check if past due date
    const now = new Date();
    const isDueDatePassed = now > assignment.dueDate;
    console.log("Is submission late:", isDueDatePassed);

    try {
      // Upload submission to S3
      console.log("Attempting S3 upload");
      const uploadedFile = await uploadFileToS3(
        submissionFile,
        `assignment-submissions/${assignment.id}`
      );
      console.log("S3 upload successful:", uploadedFile.url);

      // Check if already submitted
      const existingSubmission = await assignmentRepository.findSubmissionById({
        assignmentId: assignment.id,
        studentId: student.id,
      });

      if (existingSubmission) {
        console.log("Updating existing submission");
        // Update existing submission
        await assignmentRepository.updateSubmission(existingSubmission.id, {
          submissionFile: uploadedFile.url,
          submissionDate: now,
          status: "submitted",
          isLate: isDueDatePassed,
        });
      } else {
        console.log("Creating new submission");
        // Create new submission
        await assignmentRepository.createSubmission({
          assignmentId: assignment.id,
          studentId: student.id,
          submissionFile: uploadedFile.url,
          submissionDate: now,
          status: "submitted",
          isLate: isDueDatePassed,
        });
      }

      // Commit transaction
      await transaction.commit();

      res.json({
        success: true,
        message: "Assignment submitted successfully",
        isLate: isDueDatePassed,
      });
    } catch (uploadError) {
      console.log("Error during file upload:", uploadError.message);
      throw new Error(`File upload failed: ${uploadError.message}`);
    }
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();

    console.log("Error in submitAssignment:", error.message);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Grade a submission (for teachers)
exports.gradeSubmission = catchAsyncErrors(async (req, res, next) => {
  console.log("gradeSubmission: Started");

  // Start transaction
  const transaction = await sequelize.transaction();

  try {
    // Verify teacher permissions
    const teacher = await teacherRepository.findByUserId(req.user.id);
    if (!teacher) {
      return next(new ErrorHandler("Teacher not found", 404));
    }
    console.log("Teacher found:", teacher.id);

    // Get the assignment
    const assignment = await assignmentRepository.findById(
      req.params.assignmentId
    );
    if (!assignment) {
      return next(new ErrorHandler("Assignment not found", 404));
    }
    console.log("Assignment found:", assignment.id);

    // Check if the teacher owns the course
    const course = await courseRepository.findById(assignment.courseId);
    if (!course || course.teacherId !== teacher.id) {
      return next(
        new ErrorHandler("Unauthorized to grade this assignment", 403)
      );
    }
    console.log("Teacher authorized for course:", course.id);

    const { grade, feedback } = req.body;
    console.log(
      `Grading with: ${grade} points, feedback: ${
        feedback ? "provided" : "not provided"
      }`
    );

    if (!grade || grade < 0 || grade > assignment.totalPoints) {
      return next(
        new ErrorHandler(
          `Grade must be between 0 and ${assignment.totalPoints}`,
          400
        )
      );
    }

    // Find the submission
    const submission = await assignmentRepository.findSubmissionById(
      req.params.submissionId
    );
    if (!submission) {
      return next(new ErrorHandler("Submission not found", 404));
    }
    console.log("Submission found:", submission.id);

    // Update grade and feedback
    await assignmentRepository.updateSubmission(submission.id, {
      grade,
      feedback,
      status: "graded",
    });
    console.log("Submission updated with grade and feedback");

    // Commit transaction
    await transaction.commit();

    res.json({
      success: true,
      message: "Submission graded successfully",
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();

    console.log("Error in gradeSubmission:", error.message);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get all assignments for a course
exports.getCourseAssignments = catchAsyncErrors(async (req, res, next) => {
  console.log("getCourseAssignments: Started");
  try {
    // Get the course ID from request parameters
    const { courseId } = req.params;
    console.log(`Fetching assignments for course: ${courseId}`);

    // Find the course
    const course = await courseRepository.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }
    console.log("Course found");

    // Verify that the user has access to this course
    if (req.user.role === "teacher") {
      console.log("Verifying teacher access");
      const teacher = await teacherRepository.findByUserId(req.user.id);
      if (!teacher || course.teacherId !== teacher.id) {
        return next(new ErrorHandler("Unauthorized access", 403));
      }
      console.log("Teacher authorized");
    } else if (req.user.role === "student") {
      console.log("Verifying student access");
      const student = await studentRepository.findByUserId(req.user.id);

      // Check enrollment
      const enrolledCourses = await courseRepository.findByStudentId(
        student.id
      );
      const isEnrolled = enrolledCourses.some((c) => c.id === course.id);

      if (!isEnrolled) {
        return next(new ErrorHandler("Unauthorized access", 403));
      }
      console.log("Student authorized");
    }

    // Find all assignments for this course
    console.log("Fetching assignments");
    const assignments = await assignmentRepository.findByCourseId(courseId);
    console.log(`Found ${assignments.length} assignments`);

    // Filter submissions for students (they should only see their own)
    if (req.user.role === "student") {
      console.log("Filtering submissions for student");
      const student = await studentRepository.findByUserId(req.user.id);

      for (const assignment of assignments) {
        // Get student's submissions for this assignment
        const submissions =
          await assignmentRepository.getSubmissionsByAssignment(assignment.id);
        assignment.submissions = submissions.filter(
          (submission) => submission.studentId === student.id
        );
      }
      console.log("Submissions filtered");
    }

    res.status(200).json({
      success: true,
      assignments,
    });
  } catch (error) {
    console.log("Error in getCourseAssignments:", error.message);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get a specific assignment by ID
exports.getAssignmentById = catchAsyncErrors(async (req, res, next) => {
  console.log("getAssignmentById: Started");
  try {
    const { assignmentId } = req.params;
    console.log(`Fetching assignment: ${assignmentId}`);

    // Find the assignment with course information
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) {
      return next(new ErrorHandler("Assignment not found", 404));
    }
    console.log("Assignment found");

    // Get course details
    const course = await courseRepository.findById(assignment.courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Verify that the user has access to this assignment's course
    if (req.user.role === "teacher") {
      console.log("Verifying teacher access");
      const teacher = await teacherRepository.findByUserId(req.user.id);
      if (!teacher || course.teacherId !== teacher.id) {
        return next(new ErrorHandler("Unauthorized access", 403));
      }
      console.log("Teacher authorized");
    } else if (req.user.role === "student") {
      console.log("Verifying student access");
      const student = await studentRepository.findByUserId(req.user.id);

      // Check enrollment
      const enrolledCourses = await courseRepository.findByStudentId(
        student.id
      );
      const isEnrolled = enrolledCourses.some((c) => c.id === course.id);

      if (!isEnrolled) {
        return next(new ErrorHandler("Unauthorized access", 403));
      }
      console.log("Student authorized");

      // If student, only include their own submissions
      const submissions = await assignmentRepository.getSubmissionsByAssignment(
        assignment.id
      );
      assignment.submissions = submissions.filter(
        (submission) => submission.studentId === student.id
      );
    }

    res.status(200).json({
      success: true,
      assignment: {
        ...assignment.toJSON(),
        course: {
          id: course.id,
          title: course.title,
        },
      },
    });
  } catch (error) {
    console.log("Error in getAssignmentById:", error.message);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update an assignment
exports.updateAssignment = catchAsyncErrors(async (req, res, next) => {
  console.log("updateAssignment: Started");

  // Start transaction
  const transaction = await sequelize.transaction();

  try {
    const { assignmentId } = req.params;
    console.log(`Updating assignment: ${assignmentId}`);

    // Verify teacher permissions
    const teacher = await teacherRepository.findByUserId(req.user.id);
    if (!teacher) {
      return next(new ErrorHandler("Teacher not found", 404));
    }
    console.log("Teacher found:", teacher.id);

    // Get the assignment
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) {
      return next(new ErrorHandler("Assignment not found", 404));
    }
    console.log("Assignment found:", assignment.id);

    // Check if the teacher owns the course
    const course = await courseRepository.findById(assignment.courseId);
    if (!course || course.teacherId !== teacher.id) {
      return next(
        new ErrorHandler("Unauthorized to update this assignment", 403)
      );
    }
    console.log("Teacher authorized for course:", course.id);

    // Extract update fields
    const { title, description, dueDate, totalPoints, isActive } = req.body;

    // Prepare update data
    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (dueDate) updateData.dueDate = dueDate;
    if (totalPoints) updateData.totalPoints = totalPoints;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Handle file uploads if any
    if (req.files && req.files.attachments) {
      console.log("Processing new file attachments");

      let attachmentsArray = Array.isArray(req.files.attachments)
        ? req.files.attachments
        : [req.files.attachments];

      console.log(`Found ${attachmentsArray.length} new attachments`);

      // Validate file types
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      for (const file of attachmentsArray) {
        console.log(
          `Validating file: ${file.name}, type: ${file.mimetype}, size: ${file.size}`
        );

        if (!allowedTypes.includes(file.mimetype)) {
          return next(
            new ErrorHandler(
              `Invalid file type. Allowed types: PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX`,
              400
            )
          );
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          return next(
            new ErrorHandler(`File too large. Maximum size allowed is 5MB`, 400)
          );
        }
      }

      // Upload new attachments to S3
      try {
        console.log("Starting file uploads to S3");

        const uploadPromises = attachmentsArray.map((file) =>
          uploadFileToS3(file, "assignment-attachments")
        );

        const uploadedFiles = await Promise.all(uploadPromises);
        console.log(`Successfully uploaded ${uploadedFiles.length} files`);

        // Handle attachment replacement options
        const { replaceAttachments } = req.body;

        // Prepare new attachments
        const newAttachments = uploadedFiles.map((file) => ({
          name: file.key.split("/").pop(),
          url: file.url,
        }));

        if (replaceAttachments === "true") {
          // Replace all existing attachments
          updateData.attachments = newAttachments;
          console.log("Replaced all attachments");
        } else {
          // Append new attachments to existing ones
          updateData.attachments = [
            ...assignment.attachments,
            ...newAttachments,
          ];
          console.log("Added new attachments to existing ones");
        }
      } catch (uploadError) {
        console.error("Error uploading files:", uploadError);
        return next(new ErrorHandler("Failed to upload files", 500));
      }
    }

    // Remove specific attachments if requested
    if (req.body.removeAttachments) {
      const attachmentsToRemove = Array.isArray(req.body.removeAttachments)
        ? req.body.removeAttachments
        : [req.body.removeAttachments];

      console.log(`Removing ${attachmentsToRemove.length} attachments`);

      // Get current attachments
      const currentAttachments =
        updateData.attachments || assignment.attachments;

      // Filter out attachments to remove (by index or id)
      updateData.attachments = currentAttachments.filter(
        (_, index) =>
          !attachmentsToRemove.includes(index.toString()) &&
          !attachmentsToRemove.includes(index)
      );

      console.log("Attachments removed");
    }

    // Update the assignment
    await assignmentRepository.update(assignment.id, updateData);
    console.log("Assignment updated successfully");

    // Commit transaction
    await transaction.commit();

    // Get updated assignment
    const updatedAssignment = await assignmentRepository.findById(
      assignment.id
    );

    res.status(200).json({
      success: true,
      message: "Assignment updated successfully",
      assignment: updatedAssignment,
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();

    console.log(`Error in updateAssignment: ${error.message}`);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Delete assignment
exports.deleteAssignment = catchAsyncErrors(async (req, res, next) => {
  console.log("deleteAssignment: Started");

  // Start transaction
  const transaction = await sequelize.transaction();

  try {
    const { assignmentId } = req.params;
    console.log(`Deleting assignment: ${assignmentId}`);

    // Verify teacher permissions
    const teacher = await teacherRepository.findByUserId(req.user.id);
    if (!teacher) {
      return next(new ErrorHandler("Teacher not found", 404));
    }
    console.log("Teacher found:", teacher.id);

    // Get the assignment
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) {
      return next(new ErrorHandler("Assignment not found", 404));
    }
    console.log("Assignment found:", assignment.id);

    // Check if the teacher owns the course
    const course = await courseRepository.findById(assignment.courseId);
    if (!course || course.teacherId !== teacher.id) {
      return next(
        new ErrorHandler("Unauthorized to delete this assignment", 403)
      );
    }
    console.log("Teacher authorized for course:", course.id);

    // Delete the assignment
    // This will cascade delete submissions due to the database relationships
    await assignmentRepository.delete(assignment.id);
    console.log("Assignment deleted");

    // Commit transaction
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();

    console.log(`Error in deleteAssignment: ${error.message}`);
    return next(new ErrorHandler(error.message, 500));
  }
});
