const {
  Lecture,
  Course,
  Teacher,
  Student,
  User,
  sequelize,
} = require("../models");
const { uploadFileToS3 } = require("../utils/s3Helper");

// Create a new lecture
const createLecture = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { courseId } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await Teacher.findOne({
      where: { userId },
      transaction,
    });

    if (!teacher) {
      await transaction.rollback();
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Find the course and check ownership
    const course = await Course.findOne({
      where: {
        id: courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ error: "Course not found or unauthorized" });
    }

    // Check if video file was uploaded
    let videoUrl = null;
    let videoKey = null;

    if (req.files && req.files.video) {
      const videoFile = req.files.video;

      // Validate file type
      if (!videoFile.mimetype.startsWith("video/")) {
        await transaction.rollback();
        return res.status(400).json({ error: "Uploaded file must be a video" });
      }

      // Upload to S3
      try {
        const uploadPath = `courses/${course.id}/lectures`;
        const uploadResult = await uploadFileToS3(videoFile, uploadPath);

        videoUrl = uploadResult.url;
        videoKey = uploadResult.key;
      } catch (uploadError) {
        await transaction.rollback();
        console.error("Error uploading video:", uploadError);
        return res.status(500).json({ error: "Failed to upload video" });
      }
    }

    // Create lecture with default reviewDeadline = now + 7 days
    const reviewDeadline =
      req.body.reviewDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const lecture = await Lecture.create(
      {
        title,
        content,
        videoUrl,
        videoKey,
        courseId,
        isReviewed: req.body.isReviewed || false,
        reviewDeadline,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      lecture,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in createLecture:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Update an existing lecture
const updateLecture = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { lectureId } = req.params;
    const { title, content, isReviewed, reviewDeadline } = req.body;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await Teacher.findOne({
      where: { userId },
      transaction,
    });

    if (!teacher) {
      await transaction.rollback();
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Find the lecture
    const lecture = await Lecture.findByPk(lectureId, {
      include: [{ model: Course }],
      transaction,
    });

    if (!lecture) {
      await transaction.rollback();
      return res.status(404).json({ error: "Lecture not found" });
    }

    // Check if teacher has access to this lecture's course
    if (lecture.Course.teacherId !== teacher.id) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ error: "You don't have permission to update this lecture" });
    }

    // Update lecture fields
    if (title) lecture.title = title;
    if (content) lecture.content = content;
    if (isReviewed !== undefined) lecture.isReviewed = isReviewed;
    if (reviewDeadline) lecture.reviewDeadline = new Date(reviewDeadline);

    // Handle video file update if provided
    if (req.files && req.files.video) {
      const videoFile = req.files.video;

      // Validate file type
      if (!videoFile.mimetype.startsWith("video/")) {
        await transaction.rollback();
        return res.status(400).json({ error: "Uploaded file must be a video" });
      }

      // Delete old video from S3 if it exists
      if (lecture.videoKey) {
        try {
          await deleteFileFromS3(lecture.videoKey);
        } catch (deleteError) {
          console.error("Error deleting old video file:", deleteError);
          // Continue with upload even if delete fails
        }
      }

      // Upload new video to S3
      try {
        const uploadPath = `courses/${lecture.courseId}/lectures`;
        const uploadResult = await uploadFileToS3(videoFile, uploadPath);

        lecture.videoUrl = uploadResult.url;
        lecture.videoKey = uploadResult.key;
      } catch (uploadError) {
        await transaction.rollback();
        console.error("Error uploading video:", uploadError);
        return res.status(500).json({ error: "Failed to upload video" });
      }
    }

    // Auto-check if the deadline has passed
    const now = new Date();
    if (
      !lecture.isReviewed &&
      lecture.reviewDeadline &&
      now >= lecture.reviewDeadline
    ) {
      lecture.isReviewed = true;
    }

    await lecture.save({ transaction });
    await transaction.commit();

    return res.json({
      success: true,
      lecture,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in updateLecture:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Get lectures for a course for students
const getCourseLecturesByStudents = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find the student
    const student = await Student.findOne({
      where: { userId },
      include: [{ model: User, attributes: ["name", "email"] }],
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Find the course
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Check if student is enrolled in this course
    const enrollment = await sequelize.models.Enrollment.findOne({
      where: {
        studentId: student.id,
        courseId: course.id,
      },
    });

    if (!enrollment) {
      return res
        .status(403)
        .json({ error: "You are not enrolled in this course" });
    }

    // Find all lectures for this course
    const lectures = await Lecture.findAll({
      where: { courseId },
      attributes: [
        "id",
        "title",
        "content",
        "videoUrl",
        "isReviewed",
        "createdAt",
        "updatedAt",
      ],
      order: [["createdAt", "ASC"]],
    });

    // Auto-update any lectures that have passed their review deadline
    const now = new Date();
    const updatePromises = lectures
      .filter(
        (lecture) =>
          !lecture.isReviewed &&
          lecture.reviewDeadline &&
          now >= lecture.reviewDeadline
      )
      .map(async (lecture) => {
        lecture.isReviewed = true;
        return lecture.save();
      });

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    // Return only the lectures that are reviewed or created by current user
    const accessibleLectures = lectures.filter((lecture) => lecture.isReviewed);

    return res.json(accessibleLectures);
  } catch (error) {
    console.error("Error in getCourseLecturesByStudents:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Get all lectures for a course (teacher view)
const getCourseLectures = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await Teacher.findOne({
      where: { userId },
    });

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Find the course and check ownership
    const course = await Course.findOne({
      where: {
        id: courseId,
        teacherId: teacher.id,
      },
    });

    if (!course) {
      return res
        .status(404)
        .json({ error: "Course not found or unauthorized" });
    }

    // Find all lectures for this course
    const lectures = await Lecture.findAll({
      where: { courseId },
      order: [["createdAt", "ASC"]],
    });

    // Auto-update any lectures that have passed their review deadline
    const now = new Date();
    const updatePromises = lectures
      .filter(
        (lecture) =>
          !lecture.isReviewed &&
          lecture.reviewDeadline &&
          now >= lecture.reviewDeadline
      )
      .map(async (lecture) => {
        lecture.isReviewed = true;
        return lecture.save();
      });

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);

      // Re-fetch lectures to get updated data
      const updatedLectures = await Lecture.findAll({
        where: { courseId },
        order: [["createdAt", "ASC"]],
      });

      return res.json(updatedLectures);
    }

    return res.json(lectures);
  } catch (error) {
    console.error("Error in getCourseLectures:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Get a specific lecture
const getLectureById = async (req, res) => {
  try {
    const { lectureId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Find the lecture
    const lecture = await Lecture.findByPk(lectureId, {
      include: [{ model: Course }],
    });

    if (!lecture) {
      return res.status(404).json({ error: "Lecture not found" });
    }

    // If courseId is in params, verify it matches lecture's course
    if (
      req.params.courseId &&
      lecture.courseId.toString() !== req.params.courseId
    ) {
      return res
        .status(403)
        .json({ error: "Lecture does not belong to specified course" });
    }

    // Check authorization based on role
    if (userRole === "teacher") {
      const teacher = await Teacher.findOne({ where: { userId } });
      if (!teacher || teacher.id !== lecture.Course.teacherId) {
        return res
          .status(403)
          .json({ error: "You don't have permission to view this lecture" });
      }
    } else if (userRole === "student") {
      const student = await Student.findOne({ where: { userId } });

      // Check if student is enrolled in this course
      const enrollment = await sequelize.models.Enrollment.findOne({
        where: {
          studentId: student.id,
          courseId: lecture.Course.id,
        },
      });

      if (!enrollment) {
        return res
          .status(403)
          .json({ error: "You don't have permission to view this lecture" });
      }

      // Students can only view reviewed lectures
      if (!lecture.isReviewed) {
        return res
          .status(403)
          .json({ error: "This lecture is not yet available for viewing" });
      }
    }

    // Check if review deadline has passed and update if needed
    const now = new Date();
    if (
      !lecture.isReviewed &&
      lecture.reviewDeadline &&
      now >= lecture.reviewDeadline
    ) {
      lecture.isReviewed = true;
      await lecture.save();
    }

    return res.json({
      success: true,
      lecture,
    });
  } catch (error) {
    console.error("Error in getLectureById:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Delete a lecture
const deleteLecture = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { lectureId } = req.params;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await Teacher.findOne({
      where: { userId },
      transaction,
    });

    if (!teacher) {
      await transaction.rollback();
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Find the lecture
    const lecture = await Lecture.findByPk(lectureId, {
      include: [{ model: Course }],
      transaction,
    });

    if (!lecture) {
      await transaction.rollback();
      return res.status(404).json({ error: "Lecture not found" });
    }

    // Check if teacher has access to this lecture's course
    if (lecture.Course.teacherId !== teacher.id) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ error: "You don't have permission to delete this lecture" });
    }

    // Delete video from S3 if it exists
    if (lecture.videoKey) {
      try {
        await deleteFileFromS3(lecture.videoKey);
      } catch (deleteError) {
        console.error("Error deleting video file:", deleteError);
        // Continue with lecture deletion even if S3 delete fails
      }
    }

    // Delete the lecture
    await lecture.destroy({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: "Lecture deleted successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in deleteLecture:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Update lecture review status
const updateLectureReviewStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { lectureId } = req.params;
    const { isReviewed, reviewDeadline } = req.body;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await Teacher.findOne({
      where: { userId },
      transaction,
    });

    if (!teacher) {
      await transaction.rollback();
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Find the lecture
    const lecture = await Lecture.findByPk(lectureId, {
      include: [{ model: Course }],
      transaction,
    });

    if (!lecture) {
      await transaction.rollback();
      return res.status(404).json({ error: "Lecture not found" });
    }

    // Check if teacher has access to this lecture's course
    if (lecture.Course.teacherId !== teacher.id) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ error: "You don't have permission to update this lecture" });
    }

    // Update review status
    lecture.isReviewed = isReviewed;

    // If extending the review deadline
    if (reviewDeadline) {
      lecture.reviewDeadline = new Date(reviewDeadline);
    }

    await lecture.save({ transaction });
    await transaction.commit();

    return res.json({
      success: true,
      lecture,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in updateLectureReviewStatus:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Update review status for all lectures in a course
const updateAllLectureReviewStatuses = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await Teacher.findOne({
      where: { userId },
      transaction,
    });

    if (!teacher) {
      await transaction.rollback();
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Find the course and check ownership
    const course = await Course.findOne({
      where: {
        id: courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ error: "Course not found or unauthorized" });
    }

    // Get current time
    const now = new Date();

    // Update all lectures with passed review deadlines
    const result = await Lecture.update(
      { isReviewed: true },
      {
        where: {
          courseId,
          isReviewed: false,
          reviewDeadline: { [sequelize.Op.lte]: now },
        },
        transaction,
      }
    );

    await transaction.commit();

    return res.json({
      success: true,
      message: `${result[0]} lectures were marked as reviewed automatically`,
      modifiedCount: result[0],
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in updateAllLectureReviewStatuses:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createLecture,
  updateLecture,
  getCourseLectures,
  getCourseLecturesByStudents,
  getLectureById,
  deleteLecture,
  updateLectureReviewStatus,
  updateAllLectureReviewStatuses,
};
