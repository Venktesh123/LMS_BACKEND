const express = require("express");
const router = express.Router();
const lectureController = require("../controllers/lectureController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Get all lectures for a course
router.get("/:courseId/lectures", auth, lectureController.getCourseLectures);

// Get student view of course lectures
router.get(
  "/student/:courseId/lectures",
  auth,
  checkRole(["student"]),
  lectureController.getCourseLecturesByStudents
);

// Get specific lecture
router.get(
  "/:courseId/lectures/:lectureId",
  auth,
  lectureController.getLectureById
);

// Create lecture (teacher only)
router.post(
  "/:courseId/lectures",
  auth,
  checkRole(["teacher"]),
  lectureController.createLecture
);

// Update lecture (teacher only)
router.put(
  "/:courseId/lectures/:lectureId",
  auth,
  checkRole(["teacher"]),
  lectureController.updateLecture
);

// Delete lecture (teacher only)
router.delete(
  "/:courseId/lectures/:lectureId",
  auth,
  checkRole(["teacher"]),
  lectureController.deleteLecture
);

// Update lecture review status (teacher only)
router.put(
  "/:courseId/lectures/:lectureId/review",
  auth,
  checkRole(["teacher"]),
  lectureController.updateLectureReviewStatus
);

// Update all expired lecture review statuses (teacher only)
router.put(
  "/:courseId/lectures/review-all",
  auth,
  checkRole(["teacher"]),
  lectureController.updateAllLectureReviewStatuses
);

module.exports = router;
